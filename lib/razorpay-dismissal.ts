import { getAdminDb } from '@/lib/firebase-admin';
import { ApiInputError } from '@/lib/api-input';
import { gatewayCredentials, fetchGatewayOrderStatus, paymentReturnPath } from '@/lib/payment-gateway';
import { settleRazorpayCheckout } from '@/lib/gateway-settlement';

export async function dismissRazorpayCheckout(id: string, ownerUid: string) {
  const db = getAdminDb(), ref = db.collection('razorpayCheckouts').doc(id);
  const record = (await ref.get()).data(), credentials = gatewayCredentials('Razorpay');
  if (!record || record.ownerUid !== ownerUid) throw new ApiInputError('Payment not found.', 404);
  if (!credentials || record.keyId !== credentials.keyId) throw new ApiInputError('Payment verification is unavailable.', 503);
  const status = await fetchGatewayOrderStatus(credentials, '', id, true);
  if (status.state === 'COMPLETED') return settleRazorpayCheckout(id);
  const retryAvailable = status.retrySafe === true;
  const custom = /^CUSTOMPAY[a-f0-9]{32}$/.test(id);
  const regular = !custom && !/^REPLPAY[a-f0-9]{32}$/.test(id) && !/^RZTEST[a-f0-9]{32}$/.test(id);
  await db.runTransaction(async tx => {
    const latest = (await tx.get(ref)).data();
    const attemptRef = db.collection(custom ? 'customPhonepeAttempts' : 'phonepePaymentAttempts').doc(id);
    const attempt = custom || regular ? (await tx.get(attemptRef)).data() : null;
    const orderRef = attempt ? db.collection(custom ? 'customAgreementRequests' : 'orders').doc(custom ? attempt.requestId : attempt.orderId) : null;
    const order = orderRef ? (await tx.get(orderRef)).data() : null;
    if (!latest || latest.state === 'COMPLETED' || order?.payment?.status === 'Paid') throw new ApiInputError('Payment changed. Check its status.', 409);
    if ((custom || regular) && (!attempt || attempt.ownerUid !== ownerUid || attempt.gateway !== 'Razorpay' || attempt.amount * 100 !== record.amount || !order || order.ownerUid !== ownerUid || (custom ? order.payment?.merchantOrderId : order.payment?.phonepeMerchantOrderId) !== id)) throw new ApiInputError('Payment association needs verification.', 409);
    const now = new Date().toISOString();
    tx.update(ref, { dismissedAt: now, retryAvailable });
    if (attempt && orderRef) {
      tx.update(attemptRef, { dismissedAt: now });
      tx.update(orderRef, { 'payment.checkoutClosed': true, 'payment.retryAvailable': retryAvailable, 'payment.reviewRequired': false, 'payment.lastCheckedAt': now });
    }
  });
  return { paid: false, retryAvailable, returnUrl: regular ? '/my-orders' : paymentReturnPath(record.returnUrl) };
}
