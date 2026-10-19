import { getAdminDb } from '@/lib/firebase-admin';
import { ApiInputError } from '@/lib/api-input';
import { gatewayCredentials, razorpayRequest } from '@/lib/payment-gateway';
import { phonePeRefundRequest, type PhonePeRefundResponse } from '@/lib/phonepe';

export async function credentialsForPaymentReference(merchantOrderId: string) {
  const row = (await getAdminDb().collection('razorpayCheckouts').doc(merchantOrderId).get()).data();
  const credentials = gatewayCredentials(row ? 'Razorpay' : 'PhonePe');
  if (row && row.keyId !== credentials?.keyId) throw new ApiInputError('The original payment credentials are required to process this refund.', 409);
  return credentials;
}

export async function gatewayRefundRequest(merchantRefundId: string, originalMerchantOrderId?: string, amount?: number, originalReferenceHint?: string): Promise<PhonePeRefundResponse> {
  const db = getAdminDb(), ref = db.collection('razorpayRefunds').doc(merchantRefundId);
  const saved = (await ref.get()).data();
  const reference = originalMerchantOrderId ?? saved?.originalMerchantOrderId ?? originalReferenceHint;
  const checkout = reference ? (await db.collection('razorpayCheckouts').doc(reference).get()).data() : null;
  if (!checkout) {
    if (saved) throw new ApiInputError('The original Razorpay payment needs reconciliation.', 409);
    return phonePeRefundRequest(merchantRefundId, originalMerchantOrderId, amount);
  }
  const credentials = gatewayCredentials('Razorpay');
  if (!credentials || checkout.keyId !== credentials.keyId) throw new ApiInputError('Razorpay refund credentials are unavailable.', 503);
  if (!originalMerchantOrderId) {
    if (!saved) throw Object.assign(new Error('Refund has not been submitted.'), { status: 404 });
    if (!saved.refundId) return { state: 'UNKNOWN', emptyResponse: true };
  }
  let result;
  let expectedAmount = saved?.amount;
  let paymentId = saved?.paymentId;
  if (originalMerchantOrderId) {
    if (!Number.isSafeInteger(amount) || amount! <= 0 || amount! > checkout.amount) throw new ApiInputError('Invalid refund amount.');
    // Always verify capture against the original provider, independent of the active setting.
    const orderPayments = await razorpayRequest(`orders/${encodeURIComponent(checkout.razorpayOrderId)}/payments`, credentials);
    const payment = orderPayments.items?.find((item: { id: string; order_id: string; currency: string; amount: number; status: string; captured: boolean }) => item.order_id === checkout.razorpayOrderId && item.currency === 'INR' && item.amount === checkout.amount && item.status === 'captured' && item.captured === true);
    if (!payment) throw new ApiInputError('The original captured payment could not be verified.', 409);
    expectedAmount = amount; paymentId = payment.id;
    await db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data();
      if (current && (current.amount !== amount || current.originalMerchantOrderId !== reference || current.paymentId !== paymentId)) throw new ApiInputError('Refund details changed. Reconcile the original request.', 409);
      if (!current) tx.create(ref, { originalMerchantOrderId: reference, paymentId, amount, keyId: credentials.keyId, createdAt: new Date().toISOString() });
    });
    result = await razorpayRequest(`payments/${encodeURIComponent(paymentId)}/refund`, credentials, { amount, receipt: merchantRefundId, speed: 'normal' }, { 'X-Refund-Idempotency': merchantRefundId });
  } else result = await razorpayRequest(`refunds/${encodeURIComponent(saved!.refundId)}`, credentials);
  if (result.payment_id !== paymentId || result.amount !== expectedAmount || result.currency !== 'INR' || result.receipt !== merchantRefundId || typeof result.id !== 'string' || !/^rfnd_[A-Za-z0-9]+$/.test(result.id)) throw new ApiInputError('Razorpay refund does not match the original payment.', 409);
  await db.runTransaction(async tx => { await tx.get(ref); tx.update(ref, { refundId: result.id, state: result.status, updatedAt: new Date().toISOString() }); });
  return { merchantRefundId, originalMerchantOrderId: reference, amount: result.amount, refundId: result.id, state: result.status === 'processed' ? 'COMPLETED' : result.status === 'failed' ? 'FAILED' : 'PENDING' };
}
