import { getAdminDb } from '@/lib/firebase-admin';
import { ApiInputError } from '@/lib/api-input';
import { customQuoteStatus } from '@/lib/custom-agreement';

export function payableCustomQuote(request: { status?: string; quoteAmount?: number; quoteValidUntil?: string; acceptedAt?: string; payment?: { status?: string } }) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  if (request.quoteValidUntil && request.quoteValidUntil < today) throw new ApiInputError('This quote has expired. Ask our team for a revised quote.', 409);
  const acceptedByContact = request.status === 'Accepted' && !!request.acceptedAt && request.payment?.status !== 'Paid';
  if ((!acceptedByContact && !['Quote Sent', 'Quoted / Awaiting Payment'].includes(customQuoteStatus(request) ?? '')) || !Number.isSafeInteger(request.quoteAmount) || request.quoteAmount! < 1 || request.quoteAmount! > 1_000_000) {
    throw new ApiInputError('This request does not have a payable quote.', 409);
  }
  return request.quoteAmount!;
}

// Called only with authenticated webhook data or a server-to-server status response.
export async function settleCustomPayment(merchantOrderId: string, amount: unknown, state: string, transactionId?: string) {
  const db = getAdminDb(), attemptRef = db.collection('customPhonepeAttempts').doc(merchantOrderId);
  return db.runTransaction(async (tx) => {
    const attempt = (await tx.get(attemptRef)).data();
    if (!attempt) throw new ApiInputError('Payment attempt not found.', 404);
    const ref = db.collection('customAgreementRequests').doc(attempt.requestId);
    const current = (await tx.get(ref)).data();
    if (!current || current.ownerUid !== attempt.ownerUid || current.payment?.merchantOrderId !== merchantOrderId || current.quoteAmount !== attempt.amount) throw new ApiInputError('Payment reference does not match this request.', 409);
    if (current.payment.status === 'Paid') return { paid: true };
    if (state === 'COMPLETED') {
      if (amount !== attempt.amount * 100) throw new ApiInputError('Payment amount does not match the quote.', 409);
      const now = new Date().toISOString();
      const closed = ['Cancelled', 'Declined'].includes(current.status);
      tx.update(ref, { ...(closed ? { latePaymentReceivedAt: now } : { status: 'Accepted', stageChangedAt: now, acceptedAt: now }), updatedAt: now, payment: { status: 'Paid', gateway: attempt.gateway ?? 'PhonePe', amount: attempt.amount, merchantOrderId, transactionId: transactionId || merchantOrderId, paidAt: now, ...(closed ? { reviewRequired: true } : {}) } });
      tx.update(attemptRef, { state: 'COMPLETED' });
      return { paid: true };
    }
    if (['FAILED', 'EXPIRED'].includes(state)) {
      tx.update(attemptRef, { state });
      tx.update(ref, { 'payment.status': 'Failed', updatedAt: new Date().toISOString() });
    }
    return { paid: false, state };
  });
}
