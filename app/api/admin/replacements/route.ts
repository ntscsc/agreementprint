import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { customIdentity, customError } from '@/lib/custom-request-server';
import { ApiInputError, readJsonObject } from '@/lib/api-input';

export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  try {
    if (!(await customIdentity(req)).admin) throw new ApiInputError('Administrator access required.', 403);
    const collection = getAdminDb().collection('orderReplacements');
    const [reviews, refunds] = await Promise.all([
      collection.where('state', '==', 'Review required').limit(100).get(),
      collection.where('refundStatus', '==', 'Requested').limit(100).get(),
    ]);
    const records = new Map([...reviews.docs, ...refunds.docs].map(doc => [doc.id, doc.data()]));
    return NextResponse.json({ requests: [...records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return customError(error); }
}
export async function PATCH(req: NextRequest) {
  try {
    const identity = await customIdentity(req);
    if (!identity.admin) throw new ApiInputError('Administrator access required.', 403);
    const body = await readJsonObject(req);
    if (!/^REPLPAY[a-f0-9]{32}$/.test(body.requestId || '') || typeof body.notes !== 'string' || body.notes.trim().length < 5 || body.notes.length > 2000) throw new ApiInputError('Select a request and enter review notes or the refund transfer reference.');
    const db = getAdminDb(), ref = db.collection('orderReplacements').doc(body.requestId);
    await db.runTransaction(async tx => {
      const record = (await tx.get(ref)).data();
      if (!record) throw new ApiInputError('Request not found.', 404);
      const originalRef = db.collection('orders').doc(record.originalOrderId), original = (await tx.get(originalRef)).data();
      const now = new Date().toISOString();
      if (body.action === 'refund-recorded' && ['Completed', 'Abandoned', 'Failed'].includes(record.state) && record.refundStatus === 'Requested' && record.refundAmount > 0) {
        tx.update(ref, { refundStatus: 'Refunded', refundReference: body.notes.trim(), refundedAt: now, refundedBy: identity.uid, updatedAt: now });
        if (record.state === 'Completed') tx.update(db.collection('orders').doc(record.replacementOrderId), { 'replacementAdjustment.refundStatus': 'Refunded', updatedAt: now });
      } else if (body.action === 'reviewed' && record.state === 'Review required') {
        tx.update(ref, { state: 'Reviewed', reviewNotes: body.notes.trim(), reviewedBy: identity.uid, reviewedAt: now, updatedAt: now });
        if (original?.modificationReviewId === body.requestId) tx.update(originalRef, { modificationReviewId: null, modificationReviewOutcome: body.notes.trim(), updatedAt: now });
      } else throw new ApiInputError('This action is not available for the request.', 409);
      tx.create(db.collection('adminLogs').doc(), { orderId: record.originalOrderId, requestId: body.requestId, adminUid: identity.uid, action: body.action, notes: body.notes.trim(), timestamp: now });
    });
    return NextResponse.json({ saved: true });
  } catch (error) { return customError(error); }
}
