import { getAdminDb } from '@/lib/firebase-admin';
import { ApiInputError } from '@/lib/api-input';
import { calculateOrderPrice, type PricingConfig } from '@/src/config/pricing';
import type { AgreementTerms } from '@/lib/types';
import type { DocumentData, Transaction } from 'firebase-admin/firestore';

export function replacementQuote(order: DocumentData, terms: AgreementTerms, pricing: PricingConfig) {
  const subtotal = calculateOrderPrice(pricing, terms.stampPaperDenomination, terms.deliveryLocation, terms.includeNotary, terms.extraCopies).totalPayable;
  const cash = order.payment?.amount, credits = order.payment?.referralCreditApplied ?? 0;
  const discount = Math.min(order.payment?.couponDiscount ?? 0, subtotal);
  if (![cash, credits, discount].every(value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)) throw new ApiInputError('Your saved payment needs administrator review before replacement.', 409);
  const total = subtotal - discount, creditsUsed = Math.min(credits, total), cashUsed = Math.min(cash, total - creditsUsed);
  return { subtotal, discount, total, alreadyPaid: cash + credits, creditsUsed, cashUsed,
    due: Math.max(0, total - cash - credits), excessCash: cash - cashUsed, excessCredits: credits - creditsUsed,
    surplus: Math.max(0, cash + credits - total) };
}

export async function preparationHasStarted(tx: Transaction, orderId: string, order: DocumentData) {
  if (order.preparationStartedAt || order.courier || ['Drafting', 'Dispatched', 'Delivered'].includes(order.status)) return true;
  const history = await tx.get(getAdminDb().collection('adminLogs').where('orderId', '==', orderId));
  return history.docs.some(log => ['Drafting', 'Dispatched', 'Delivered'].includes(log.data().newStatus) || ['Drafting', 'Dispatched', 'Delivered'].includes(log.data().previousStatus));
}

// Authenticated webhook data or server-to-server PhonePe verification only.
export async function settleReplacement(requestId: string, state: string, amount?: number, transactionId?: string) {
  const db = getAdminDb(), requestRef = db.collection('orderReplacements').doc(requestId);
  const preflight = (await requestRef.get()).data();
  if (!preflight) throw new ApiInputError('Replacement not found.', 404);
  return db.runTransaction(async tx => {
    const request = (await tx.get(requestRef)).data();
    if (!request) throw new ApiInputError('Replacement not found.', 404);
    if (request.state === 'Completed') return { completed: true, replacementOrderId: request.replacementOrderId };
    if (request.state === 'Abandoned' || request.state === 'Failed') {
      if (state === 'COMPLETED') {
        if (amount !== request.quote.due * 100 || !transactionId) throw new ApiInputError('Late replacement payment needs verified amount and transaction reference.', 409);
        if (!request.latePaymentTransactionId) {
          const now = new Date().toISOString();
          tx.update(requestRef, { latePaymentTransactionId: transactionId, latePaymentAt: now, refundStatus: 'Requested', refundAmount: amount / 100, updatedAt: now });
          tx.create(db.collection('adminLogs').doc(), { orderId: request.originalOrderId, requestId, action: 'ABANDONED_REPLACEMENT_PAYMENT_REFUND_REQUIRED', transactionId, amount: amount / 100, timestamp: now });
        }
        return { completed: false, state: request.state, refundPending: true };
      }
      return { completed: false, state: request.state };
    }
    if (request.state !== 'Awaiting payment' && request.state !== 'Ready') throw new ApiInputError('Replacement is not ready for payment.', 409);
    const originalRef = db.collection('orders').doc(request.originalOrderId), original = (await tx.get(originalRef)).data();
    if (!original || original.ownerUid !== request.ownerUid || original.payment?.status !== 'Paid' || original.replacementPendingId !== requestId) throw new ApiInputError('The original order has changed. Contact support.', 409);
    const now = new Date().toISOString();
    if (['FAILED', 'EXPIRED'].includes(state)) {
      tx.update(requestRef, { state: 'Failed', gatewayState: state, updatedAt: now });
      tx.update(originalRef, { replacementPendingId: null, updatedAt: now });
      return { completed: false, state: 'Failed' };
    }
    if (state !== 'COMPLETED') return { completed: false, state: 'Pending' };
    const q = request.quote;
    if (q.surplus > 0 || q.excessCash > 0 || q.excessCredits > 0 || q.total < q.alreadyPaid) throw new ApiInputError('This lower-value replacement can no longer be submitted. Contact the admin team to cancel it and refund the original payment.', 409);
    if (amount !== q.due * 100) throw new ApiInputError('Payment does not match the replacement balance.', 409);
    if (await preparationHasStarted(tx, request.originalOrderId, original)) throw new ApiInputError('Preparation has begun. Contact support for review of this replacement payment.', 409);
    const replacement = {
      orderId: request.replacementOrderId, ownerUid: original.ownerUid, customerEmail: original.customerEmail,
      customerPhone: request.details.ownerDetails.phone, proofUploads: original.proofUploads || {},
      ...request.details, status: 'Under verification', createdAt: now, updatedAt: now,
      replacesOrderId: request.originalOrderId, replacementRequestId: requestId,
      replacementAdjustment: { additionalPayment: q.due, creditReturned: 0,
        refundAmount: 0,
        refundStatus: 'Not required' },
      payment: { status: 'Paid', amount: q.cashUsed + q.due, referralCreditApplied: q.creditsUsed,
        subtotal: q.subtotal, couponDiscount: q.discount, couponCode: original.payment.couponCode || '', totalBeforeCredits: q.total,
        gateway: q.due > 0 ? request.gateway ?? 'PhonePe' : original.payment.gateway || 'PhonePe', paidAt: now,
        ...(q.due > 0 ? { phonepeMerchantOrderId: requestId, ...(request.gateway === 'Razorpay' ? { razorpayPaymentId: transactionId || requestId } : { phonepeTransactionId: transactionId || requestId }) } : {}),
        carriedFromOrderId: request.originalOrderId, carriedCash: q.cashUsed, carriedCredit: q.creditsUsed, additionalPayment: q.due,
      },
    };
    tx.create(db.collection('orders').doc(request.replacementOrderId), replacement);
    tx.update(originalRef, { status: 'Cancelled', replacedByOrderId: request.replacementOrderId, replacementPendingId: null, updatedAt: now });
    tx.update(requestRef, { state: 'Completed', updatedAt: now, transactionId: transactionId || '',
      refundStatus: 'Not required',
      refundAmount: 0, creditReturned: 0 });
    tx.create(db.collection('orderEditHistory').doc(requestId), { orderId: request.originalOrderId, replacementOrderId: request.replacementOrderId, actorUid: request.ownerUid, createdAt: now, before: { ownerDetails: original.ownerDetails, tenantDetails: original.tenantDetails, propertyDetails: original.propertyDetails, agreementTerms: original.agreementTerms }, after: request.details, quote: q });
    return { completed: true, replacementOrderId: request.replacementOrderId };
  });
}


export async function abandonReplacement(orderId: string, actorUid: string, admin = false) {
  const db = getAdminDb(), originalRef = db.collection('orders').doc(orderId);
  return db.runTransaction(async tx => {
    const original = (await tx.get(originalRef)).data();
    if (!original || (!admin && original.ownerUid !== actorUid)) throw new ApiInputError('Order not found.', 404);
    if (!original.replacementPendingId) throw new ApiInputError('No replacement is pending. Refresh the order.', 409);
    const requestId = original.replacementPendingId, ref = db.collection('orderReplacements').doc(requestId);
    const request = (await tx.get(ref)).data();
    if (!request || request.originalOrderId !== orderId || request.ownerUid !== original.ownerUid || !['Awaiting payment', 'Ready', 'Failed'].includes(request.state)) throw new ApiInputError('Replacement changed. Refresh the order.', 409);
    if (request.checkoutLeaseUntil > Date.now()) throw new ApiInputError('Checkout is opening. Wait a few seconds and retry.', 409);
    const now = new Date().toISOString();
    tx.update(ref, { state: 'Abandoned', abandonedAt: now, abandonedBy: actorUid, updatedAt: now });
    tx.update(originalRef, { replacementPendingId: null, updatedAt: now });
    tx.create(db.collection('adminLogs').doc(), { orderId, actorUid, action: 'REPLACEMENT_ABANDONED', replacementRequestId: requestId, timestamp: now });
    return { ...original, replacementPendingId: null, updatedAt: now };
  });
}
