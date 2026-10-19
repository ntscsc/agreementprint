import { getAdminDb } from '@/lib/firebase-admin';
import { randomUUID } from 'node:crypto';
import { ApiInputError } from '@/lib/api-input';
import { fetchGatewayOrderStatus as fetchPhonePeOrderStatus, getGatewayAccessToken as getPhonePeAccessToken } from '@/lib/payment-gateway';
import { gatewayRefundRequest as phonePeRefundRequest, credentialsForPaymentReference } from '@/lib/gateway-refunds';

const activeStates = ['Awaiting approval', 'Processing'];
export async function settleCreditRefundLeg(requestId: string, merchantRefundId: string, state: string, amount?: number, originalMerchantOrderId?: string) {
  if (!['COMPLETED', 'FAILED', 'REJECTED'].includes(state)) return;
  const db = getAdminDb(), ref = db.collection('creditRefundRequests').doc(requestId);
  await db.runTransaction(async tx => {
    const record = (await tx.get(ref)).data();
    if (!record || !activeStates.includes(record.state)) return;
    const index = record.legs.findIndex((leg: { merchantRefundId: string }) => leg.merchantRefundId === merchantRefundId);
    if (index < 0) throw new ApiInputError('Refund reference was not found.', 404);
    const leg = record.legs[index];
    if (['COMPLETED', 'FAILED', 'REJECTED'].includes(leg.state)) return;
    if (state === 'REJECTED' && record.state !== 'Awaiting approval') throw new ApiInputError('A submitted refund cannot be released until the payment gateway confirms failure.', 409);
    if (state !== 'REJECTED' && (record.state !== 'Processing' || amount !== leg.amount * 100 || originalMerchantOrderId !== leg.originalMerchantOrderId)) throw new ApiInputError('Refund confirmation does not match the original payment.', 409);
    if (record.source === 'Order cancellation') {
      const orderRef = db.collection('orders').doc(record.orderId), order = (await tx.get(orderRef)).data();
      if (!order || order.cancellationRefundId !== requestId || order.status !== 'Cancelled') throw new Error('Cancellation refund does not match the original order');
      const legs = record.legs.map((item: object, i: number) => i === index ? { ...item, state } : item);
      const done = legs.every((item: { state: string }) => ['COMPLETED', 'FAILED', 'REJECTED'].includes(item.state));
      const completed = legs.filter((item: { state: string }) => item.state === 'COMPLETED').length;
      const nextState = done ? completed === legs.length ? 'Completed' : completed > 0 ? 'Partially refunded' : 'Failed' : 'Processing';
      const now = new Date().toISOString();
      tx.update(ref, { legs, state: nextState, updatedAt: now });
      tx.update(orderRef, { cancellationRefundStatus: nextState, ...(nextState === 'Completed' ? { 'payment.status': 'Refunded' } : {}), updatedAt: now });
      tx.create(db.collection('orderRefundHistory').doc(`${merchantRefundId}_${state}`), { requestId, orderId: record.orderId, merchantRefundId, amount: leg.amount, state, createdAt: now });
      return;
    }
    const accountRef = db.collection('referralAccounts').doc(record.ownerUid), account = (await tx.get(accountRef)).data();
    if (!account || account.activeCreditRefundId !== requestId || !Number.isSafeInteger(account.balance) || account.balance < 0 || !Number.isSafeInteger(account.balance + leg.amount) || !Number.isSafeInteger(account.refundReserved) || account.refundReserved < leg.amount) throw new Error('Invalid reserved refund balance');
    const legs = record.legs.map((item: object, i: number) => i === index ? { ...item, state } : item);
    const done = legs.every((item: { state: string }) => ['COMPLETED', 'FAILED', 'REJECTED'].includes(item.state));
    const completed = legs.filter((item: { state: string }) => item.state === 'COMPLETED').length;
    const nextState = done ? completed === legs.length ? 'Completed' : completed > 0 ? 'Partially refunded' : state === 'REJECTED' ? 'Declined' : 'Failed' : record.state;
    const now = new Date().toISOString();
    tx.update(ref, { legs, state: nextState, updatedAt: now });
    tx.update(accountRef, { balance: account.balance + (state === 'COMPLETED' ? 0 : leg.amount), creditSequence: Number(account.creditSequence || 0) + 1, refundReserved: account.refundReserved - leg.amount, ...(done ? { activeCreditRefundId: null } : {}), updatedAt: now });
    tx.create(db.collection('referralLedger').doc(`refund_${state === 'COMPLETED' ? 'completed' : 'release'}_${merchantRefundId}`), { ownerUid: record.ownerUid, type: state === 'COMPLETED' ? 'refund_completed' : 'refund_release', sequence: Number(account.creditSequence || 0) + 1, amount: leg.amount, allocations: leg.allocations, requestId, createdAt: now });
  });
}

export async function reconcileCreditRefund(requestId: string) {
  const ref = getAdminDb().collection('creditRefundRequests').doc(requestId), record = (await ref.get()).data();
  if (!record) throw new ApiInputError('Refund request not found.', 404);
  if (record.state !== 'Processing') return;
  for (const leg of record.legs) {
    if (['COMPLETED', 'FAILED', 'REJECTED'].includes(leg.state)) continue;
    try {
      const result = await phonePeRefundRequest(leg.merchantRefundId, undefined, undefined, leg.originalMerchantOrderId);
      if (result.emptyResponse) {
        await ref.update({ statusMessage: 'The payment gateway has not returned a refund status yet. The refund remains unconfirmed. Check the original provider before retrying.', updatedAt: new Date().toISOString() });
        continue;
      }
      // Status is fetched using our fixed refund ID. Some documented responses
      // contain only PhonePe's refundId, so verify the echoed merchant ID if present.
      if (result.merchantRefundId && result.merchantRefundId !== leg.merchantRefundId) throw new Error('Refund reference mismatch');
      if (result.originalMerchantOrderId !== leg.originalMerchantOrderId || result.amount !== leg.amount * 100) throw new ApiInputError('Payment gateway refund status does not match the reserved original payment. The refund remains pending for admin review.', 409);
      await settleCreditRefundLeg(requestId, leg.merchantRefundId, result.state || 'PENDING', result.amount, result.originalMerchantOrderId);
      await ref.update({ statusMessage: ['COMPLETED', 'FAILED'].includes(result.state || '') ? 'The payment gateway returned a confirmed refund result.' : 'The payment gateway is processing the refund. The original refund request remains pending until confirmation.', updatedAt: new Date().toISOString() });
    } catch (error) { if ((error as { status?: number }).status !== 404) throw error; }
  }
}

export async function approveCreditRefund(requestId: string, adminUid: string, notes: string) {
  const db = getAdminDb(), ref = db.collection('creditRefundRequests').doc(requestId);
  const preflight = (await ref.get()).data();
  if (!preflight) throw new ApiInputError('Refund request not found.', 404);
  for (const leg of preflight.legs) {
    const credentials = await credentialsForPaymentReference(leg.originalMerchantOrderId);
    if (!credentials) throw new ApiInputError('Original payment gateway credentials are unavailable.', 503);
    if (!credentials.production) throw new ApiInputError('Refunds are unavailable in test mode. The request remains saved for admin review.', 409);
  }
  // Recovery always checks the original refund IDs before any retry.
  await reconcileCreditRefund(requestId);
  const leaseId = randomUUID();
  const lease = await db.runTransaction(async tx => {
    const record = (await tx.get(ref)).data();
    if (!record) throw new ApiInputError('Refund request not found.', 404);
    if (!activeStates.includes(record.state)) return null;
    if (record.leaseUntil > Date.now()) throw new ApiInputError('Refund processing is already in progress. Check its status shortly.', 409);
    const orderRef = record.source === 'Order cancellation' ? db.collection('orders').doc(record.orderId) : null;
    const order = orderRef ? (await tx.get(orderRef)).data() : null;
    if (orderRef && (!order || order.cancellationRefundId !== requestId || order.status !== 'Cancelled')) throw new ApiInputError('This refund does not match a cancelled order.', 409);
    tx.update(ref, { state: 'Processing', approvedBy: record.approvedBy || adminUid, approvalNotes: record.approvalNotes || notes, leaseId, leaseUntil: Date.now() + 900000, updatedAt: new Date().toISOString() });
    if (orderRef) tx.update(orderRef, { cancellationRefundStatus: 'Processing', updatedAt: new Date().toISOString() });
    return record;
  });
  if (!lease) return;
  try {
    for (const leg of lease.legs) {
      if (['COMPLETED', 'FAILED', 'REJECTED'].includes(leg.state)) continue;
      let submitOriginalReference = false;
      try {
        const result = await phonePeRefundRequest(leg.merchantRefundId, undefined, undefined, leg.originalMerchantOrderId);
        // An explicit admin retry may re-submit ONLY the original unique refund
        // reference. Never generate a new refund ID for an uncertain response.
        submitOriginalReference = result.emptyResponse === true;
      }
      catch (error) { if ((error as { status?: number }).status === 404) submitOriginalReference = true; else throw error; }
      if (!submitOriginalReference) continue;
      const credentials = await credentialsForPaymentReference(leg.originalMerchantOrderId);
      if (!credentials) throw new ApiInputError('Original payment verification is unavailable.', 503);
      const token = await getPhonePeAccessToken(credentials);
      const payment = await fetchPhonePeOrderStatus(credentials, token, leg.originalMerchantOrderId);
      const fundedAmount = leg.allocations[0].fundedAmount;
      if (!Number.isSafeInteger(fundedAmount) || fundedAmount < leg.amount || leg.allocations.some((source: { fundedAmount: number }) => source.fundedAmount !== fundedAmount) || payment.state !== 'COMPLETED' || payment.amount !== fundedAmount * 100) throw new ApiInputError('The original payment could not be verified. The refund remains pending for admin review.', 409);
      await ref.update({ statusMessage: 'Submitting the approved refund to the original payment method using its existing refund reference.', updatedAt: new Date().toISOString() });
      await phonePeRefundRequest(leg.merchantRefundId, leg.originalMerchantOrderId, leg.amount * 100);
    }
    await reconcileCreditRefund(requestId);
  } finally {
    await db.runTransaction(async tx => { const latest = (await tx.get(ref)).data(); if (latest?.leaseId === leaseId) tx.update(ref, { leaseUntil: 0 }); });
  }
}

export async function rejectCreditRefund(requestId: string, adminUid: string, notes: string) {
  const db = getAdminDb(), ref = db.collection('creditRefundRequests').doc(requestId);
  await db.runTransaction(async tx => {
    const record = (await tx.get(ref)).data();
    if (!record) throw new ApiInputError('Refund request not found.', 404);
    if (record.state === 'Declined') return;
    if (record.state !== 'Awaiting approval') throw new ApiInputError('A submitted refund must be checked with its payment gateway; it cannot be manually released.', 409);
    if (record.source === 'Order cancellation') {
      const orderRef = db.collection('orders').doc(record.orderId), order = (await tx.get(orderRef)).data();
      if (!order || order.cancellationRefundId !== requestId) throw new Error('Cancellation refund does not match the original order');
      const now = new Date().toISOString();
      tx.update(ref, { state: 'Declined', declinedBy: adminUid, declineNotes: notes, updatedAt: now, legs: record.legs.map((leg: object) => ({ ...leg, state: 'REJECTED' })) });
      tx.update(orderRef, { cancellationRefundStatus: 'Declined', cancellationRefundNote: notes, updatedAt: now });
      return;
    }
    const accountRef = db.collection('referralAccounts').doc(record.ownerUid), account = (await tx.get(accountRef)).data();
    if (!account || account.activeCreditRefundId !== requestId || !Number.isSafeInteger(account.balance) || account.balance < 0 || !Number.isSafeInteger(account.balance + record.amount) || !Number.isSafeInteger(account.refundReserved) || account.refundReserved < record.amount) throw new Error('Invalid reserved credit balance');
    const now = new Date().toISOString();
    tx.update(ref, { state: 'Declined', declinedBy: adminUid, declineNotes: notes, updatedAt: now, legs: record.legs.map((leg: object) => ({ ...leg, state: 'REJECTED' })) });
    tx.update(accountRef, { balance: account.balance + record.amount, creditSequence: Number(account.creditSequence || 0) + 1, refundReserved: account.refundReserved - record.amount, activeCreditRefundId: null, updatedAt: now });
    tx.create(db.collection('referralLedger').doc(`refund_release_${requestId}`), { ownerUid: record.ownerUid, type: 'refund_release', sequence: Number(account.creditSequence || 0) + 1, amount: record.amount, allocations: record.legs.flatMap((leg: { allocations: unknown[] }) => leg.allocations), requestId, createdAt: now });
  });
}
