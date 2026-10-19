import { getAdminDb } from '@/lib/firebase-admin';
import { ApiInputError } from '@/lib/api-input';
import { gatewayCredentials, fetchGatewayOrderStatus, paymentReturnPath } from '@/lib/payment-gateway';
import { settleCustomPayment } from '@/lib/custom-payment';
import { settleReplacement } from '@/lib/order-replacement';
import { confirmPaidOrderAndGrantReferral } from '@/lib/referral-admin';
import { isTrustedPaymentAttempt } from '@/lib/payment-attempt';
import { settleRazorpayTestPayment } from '@/lib/razorpay-test-payment';

export async function settleRazorpayCheckout(merchantOrderId: string) {
  const db = getAdminDb(), ref = db.collection('razorpayCheckouts').doc(merchantOrderId);
  const record = (await ref.get()).data();
  const credentials = gatewayCredentials('Razorpay');
  if (!record || !credentials || record.keyId !== credentials.keyId) throw new ApiInputError('Payment verification is unavailable.', 503);
  const status = await fetchGatewayOrderStatus(credentials, '', merchantOrderId);
  if (status.state !== 'COMPLETED') return { paid: false, returnUrl: paymentReturnPath(record.returnUrl) };
  const transactionId = status.paymentDetails?.find(payment => payment.state === 'COMPLETED')?.transactionId;
  if (/^RZTEST[a-f0-9]{32}$/.test(merchantOrderId)) {
    await settleRazorpayTestPayment(merchantOrderId, record.ownerUid, status.amount, transactionId);
  } else if (/^CUSTOMPAY[a-f0-9]{32}$/.test(merchantOrderId)) {
    const attempt = (await db.collection('customPhonepeAttempts').doc(merchantOrderId).get()).data();
    if (attempt?.gateway !== 'Razorpay' || attempt.ownerUid !== record.ownerUid || attempt.amount * 100 !== record.amount) throw new Error('Custom payment association mismatch.');
    await settleCustomPayment(merchantOrderId, status.amount, status.state, transactionId);
  } else if (/^REPLPAY[a-f0-9]{32}$/.test(merchantOrderId)) {
    const attempt = (await db.collection('orderReplacements').doc(merchantOrderId).get()).data();
    if (attempt?.gateway !== 'Razorpay' || attempt.ownerUid !== record.ownerUid || attempt.quote.due * 100 !== record.amount) throw new Error('Replacement payment association mismatch.');
    await settleReplacement(merchantOrderId, status.state, status.amount, transactionId);
  } else {
    const attempt = (await db.collection('phonepePaymentAttempts').doc(merchantOrderId).get()).data();
    if (!attempt || attempt.gateway !== 'Razorpay' || !isTrustedPaymentAttempt(attempt, attempt.orderId, record.ownerUid, merchantOrderId) || attempt.amount * 100 !== record.amount) throw new Error('Order payment association mismatch.');
    await confirmPaidOrderAndGrantReferral(attempt.orderId, { merchantOrderId, transactionId });
  }
  await db.runTransaction(async tx => {
    await tx.get(ref);
    tx.update(ref, { state: 'COMPLETED', razorpayPaymentId: transactionId, updatedAt: new Date().toISOString() });
  });
  return { paid: true, returnUrl: paymentReturnPath(record.returnUrl) };
}
