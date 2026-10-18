import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { customIdentity, customError } from '@/lib/custom-request-server';
import { ApiInputError, readJsonObject, validDocumentId } from '@/lib/api-input';
import { preparationHasStarted } from '@/lib/order-replacement';
import { refundableCredits, type CreditSource } from '@/lib/refundable-credits';
import { createHash } from 'node:crypto';

export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  try {
    const identity = await customIdentity(req), body = await readJsonObject(req), db = getAdminDb();
    if (!validDocumentId(body.orderId)) throw new ApiInputError('Invalid order reference.');
    const ref = db.collection('orders').doc(body.orderId);
    // One cancellation/refund reference for this order, including repeat clicks.
    const requestId = `CREF${createHash('sha256').update(`cancel:${body.orderId}`).digest('hex').slice(0, 32)}`;
    const result = await db.runTransaction(async tx => {
      const order = (await tx.get(ref)).data();
      if (!order || (!identity.admin && order.ownerUid !== identity.uid)) throw new ApiInputError('Order not found.', 404);
      if (order.cancellationRefundId === requestId) return order;
      if (order.replacedByOrderId) throw new ApiInputError('This historical order has been replaced. Cancel the active replacement instead.', 409);
      if (order.replacementPendingId || order.modificationReviewId) throw new ApiInputError('Resolve the pending replacement or admin review before cancellation.', 409);
      if (order.payment?.status !== 'Paid' || !['Submitted', 'Under verification', 'Documents needed'].includes(order.status) || await preparationHasStarted(tx, body.orderId, order)) throw new ApiInputError('Cancellation is available only for paid orders before preparation begins. Contact the admin team for review.', 409);
      if (body.updatedAt !== order.updatedAt) throw new ApiInputError('This order has changed. Refresh before cancelling.', 409);
      const existing = (await tx.get(db.collection('creditRefundRequests').doc(requestId))).data();
      if (existing) throw new ApiInputError('A refund already exists for this order. Contact the admin team.', 409);
      const sources = await refundableCredits(order.ownerUid, tx);
      const cash = sources.cashOnOrder(body.orderId), usedCustomerCredits = sources.creditsOnOrder(body.orderId);
      const paidCash = order.payment.amount, paidCredits = order.payment.referralCreditApplied || 0;
      const refundableUsedCredits = usedCustomerCredits.reduce((sum, source) => sum + source.amount, 0);
      if (!Number.isSafeInteger(paidCash) || paidCash < 0 || !Number.isSafeInteger(paidCredits) || paidCredits < 0 || refundableUsedCredits > paidCredits || cash.reduce((sum, source) => sum + source.amount, 0) !== paidCash) throw new ApiInputError('The original payment needs admin reconciliation before this order can be cancelled.', 409);
      const allocations: CreditSource[] = [...cash, ...usedCustomerCredits].filter(source => source.amount > 0);
      const refundAmount = paidCash + refundableUsedCredits, rewardCreditReturn = paidCredits - refundableUsedCredits;
      const ids = [...new Set(allocations.map(source => source.merchantOrderId))];
      if (ids.length > 10) throw new ApiInputError('This order has several linked payments and needs admin reconciliation.', 409);
      const accountRef = db.collection('referralAccounts').doc(order.ownerUid);
      const account = rewardCreditReturn > 0 ? (await tx.get(accountRef)).data() : null;
      if (rewardCreditReturn > 0 && (!account || !Number.isSafeInteger(account.balance) || account.balance < 0 || !Number.isSafeInteger(account.balance + rewardCreditReturn))) throw new ApiInputError('Your reward credits need admin reconciliation before cancellation.', 409);
      const now = new Date().toISOString();
      const updates = { status: 'Cancelled', cancellationRefundId: requestId, cancellationRefundAmount: refundAmount,
        cancellationRefundStatus: refundAmount > 0 ? 'Awaiting approval' : 'Not required', cancelledAt: now, updatedAt: now,
        cancellationRewardCreditsReturned: rewardCreditReturn };
      tx.update(ref, updates);
      tx.create(db.collection('creditRefundRequests').doc(requestId), { requestId, source: 'Order cancellation', orderId: body.orderId, ownerUid: order.ownerUid,
        amount: refundAmount, state: refundAmount > 0 ? 'Awaiting approval' : 'Completed', createdAt: now, updatedAt: now,
        legs: ids.map((id, index) => ({ merchantRefundId: `${requestId}_${index}`, originalMerchantOrderId: id,
          amount: allocations.filter(source => source.merchantOrderId === id).reduce((sum, source) => sum + source.amount, 0),
          allocations: allocations.filter(source => source.merchantOrderId === id), state: 'Reserved' })) });
      if (rewardCreditReturn > 0) {
        const sequence = Number(account!.creditSequence || 0) + 1;
        tx.update(accountRef, { balance: account!.balance + rewardCreditReturn, creditSequence: sequence, updatedAt: now });
        tx.create(db.collection('referralLedger').doc(`cancel_reward_${body.orderId}`), { ownerUid: order.ownerUid, type: 'cancellation_reward_return', amount: rewardCreditReturn, orderId: body.orderId, sequence, createdAt: now });
      }
      tx.create(db.collection('adminLogs').doc(), { orderId: body.orderId, actorUid: identity.uid, action: 'CANCEL_BEFORE_PREPARATION', refundRequestId: requestId, refundAmount, previousStatus: order.status, newStatus: 'Cancelled', timestamp: now });
      return { ...order, ...updates };
    });
    return NextResponse.json({ order: result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return customError(error); }
}
