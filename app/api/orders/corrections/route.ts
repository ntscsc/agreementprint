import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { customIdentity, customError } from '@/lib/custom-request-server';
import { ApiInputError, readJsonObject, validDocumentId } from '@/lib/api-input';
import { validateAgreement } from '@/lib/agreement-validation';
import { preparationHasStarted } from '@/lib/order-replacement';
import type { DocumentData } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
const detailKeys = ['ownerDetails', 'tenantDetails', 'propertyDetails', 'agreementTerms'] as const;
function changedValues(before: unknown, after: unknown, path = ''): { field: string; before: unknown; after: unknown }[] {
  if (before && after && typeof before === 'object' && typeof after === 'object' && !Array.isArray(before) && !Array.isArray(after)) {
    const old = before as Record<string, unknown>, next = after as Record<string, unknown>;
    return [...new Set([...Object.keys(old), ...Object.keys(next)])].flatMap(key => changedValues(old[key], next[key], path ? `${path}.${key}` : key));
  }
  return before === after ? [] : [{ field: path, before: before ?? null, after: after ?? null }];
}

export async function GET(req: NextRequest) {
  try {
    const identity = await customIdentity(req), id = req.nextUrl.searchParams.get('orderId');
    if (!validDocumentId(id)) throw new ApiInputError('Invalid order reference.');
    const ref = getAdminDb().collection('orders').doc(id), order = (await ref.get()).data();
    if (!order || (!identity.admin && order.ownerUid !== identity.uid)) throw new ApiInputError('Order not found.', 404);
    const history = await ref.collection('corrections').orderBy('requestedAt', 'desc').limit(100).get();
    const records: DocumentData[] = history.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    if (!order.correctionRequestId && order.correctionMessage) records.unshift({ id: 'legacy', message: order.correctionMessage, requestedAt: order.updatedAt, status: 'Requested', changes: [] });
    return NextResponse.json({ history: records }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return customError(error); }
}

export async function POST(req: NextRequest) {
  try {
    const identity = await customIdentity(req), body = await readJsonObject(req), db = getAdminDb();
    if (!validDocumentId(body.orderId)) throw new ApiInputError('Invalid order reference.');
    if (!['request', 'resubmit'].includes(body.action)) throw new ApiInputError('Invalid correction action.');
    if (body.action === 'request' && !identity.admin) throw new ApiInputError('Administrator access required.', 403);
    const ref = db.collection('orders').doc(body.orderId);
    const result = await db.runTransaction(async tx => {
      const order = (await tx.get(ref)).data();
      if (!order || (body.action === 'resubmit' && order.ownerUid !== identity.uid)) throw new ApiInputError('Order not found.', 404);
      const historyRef = ref.collection('corrections').doc(order.correctionRequestId || randomUUID());
      const previous = (await tx.get(historyRef)).data();
      if (body.action === 'resubmit' && order.correctionStatus === 'Submitted' && previous?.submissionKey && previous.submissionKey === body.submissionKey) return order;
      if (order.payment?.status !== 'Paid' || order.replacedByOrderId || order.replacementPendingId || order.cancellationRefundId || order.modificationReviewId || order.status === 'Cancelled' || await preparationHasStarted(tx, body.orderId, order)) throw new ApiInputError('Details are locked because preparation has begun or this order is not eligible. Contact the admin team for review.', 409);
      if (body.updatedAt !== order.updatedAt) throw new ApiInputError('This order has changed. Reopen the correction form to use the latest details.', 409);
      const now = new Date().toISOString();
      if (body.action === 'request') {
        if (typeof body.message !== 'string' || body.message.trim().length < 5 || body.message.length > 3000) throw new ApiInputError('Enter the required corrections in 5 to 3000 characters.');
        const newRef = ref.collection('corrections').doc(randomUUID());
        if (!order.correctionRequestId && order.correctionMessage) tx.create(historyRef, { message: order.correctionMessage, requestedAt: order.updatedAt, status: 'Previous request', changes: [] });
        tx.create(newRef, { message: body.message.trim(), requestedAt: now, requestedBy: identity.uid, status: 'Requested', changes: [] });
        const updates = { status: 'Documents needed', correctionMessage: body.message.trim(), correctionRequestId: newRef.id, correctionStatus: 'Requested', correctionChangedFields: [], correctionSubmittedAt: null, updatedAt: now };
        tx.update(ref, updates);
        tx.create(db.collection('adminLogs').doc(), { orderId: body.orderId, adminUid: identity.uid, action: 'CORRECTION_REQUESTED', notes: body.message.trim(), previousStatus: order.status, newStatus: 'Documents needed', timestamp: now });
        return { ...order, ...updates };
      }
      if (order.status !== 'Documents needed' || typeof body.submissionKey !== 'string' || !/^[a-f0-9]{32}$/.test(body.submissionKey)) throw new ApiInputError('This order does not have an open correction request.', 409);
      const details = Object.fromEntries(detailKeys.map(key => [key, body[key]]));
      for (const key of ['stampPaperDenomination', 'includeNotary', 'deliveryLocation']) {
        if (body.agreementTerms?.[key] !== order.agreementTerms?.[key]) throw new ApiInputError('Paid package options are locked. Use Modify / Replace Order for package changes.', 409);
      }
      if ((body.agreementTerms?.extraCopies ?? 0) !== (order.agreementTerms?.extraCopies ?? 0)) throw new ApiInputError('Paid copy quantities are locked. Use Modify / Replace Order to change copies.', 409);
      validateAgreement(details);
      const before = Object.fromEntries(detailKeys.map(key => [key, order[key]]));
      const changes = changedValues(before, details);
      if (!changes.length) throw new ApiInputError('Correct the requested details before resubmitting.');
      tx.set(historyRef, { ...(previous || { message: order.correctionMessage || '', requestedAt: order.updatedAt }), status: 'Submitted', submittedAt: now, submittedBy: identity.uid, submissionKey: body.submissionKey, changes });
      const updates = { ...details, customerPhone: body.ownerDetails.phone, status: 'Under verification', correctionRequestId: historyRef.id, correctionStatus: 'Submitted', correctionSubmittedAt: now, correctionChangedFields: changes.map(change => change.field), updatedAt: now };
      tx.update(ref, updates);
      tx.create(db.collection('adminLogs').doc(), { orderId: body.orderId, actorUid: identity.uid, action: 'CUSTOMER_CORRECTIONS_SUBMITTED', changedFields: changes.map(change => change.field), previousStatus: order.status, newStatus: 'Under verification', timestamp: now });
      return { ...order, ...updates };
    });
    return NextResponse.json({ order: result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return customError(error); }
}
