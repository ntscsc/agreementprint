import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { customIdentity, customError } from '@/lib/custom-request-server';
import { ApiInputError, readJsonObject, validDocumentId } from '@/lib/api-input';
import { workflowPatch, type WorkflowInput } from '@/lib/order-workflow';
import type { Order } from '@/lib/types';

export const runtime = 'nodejs';
function record(channel: unknown, orderId: unknown) {
  if (!['Online', 'Counter'].includes(String(channel)) || !validDocumentId(orderId)) throw new ApiInputError('Select a valid order and channel.');
  return getAdminDb().collection(channel === 'Counter' ? 'counterOrders' : 'orders').doc(orderId as string);
}
export async function GET(req: NextRequest) {
  try {
    if (!(await customIdentity(req)).admin) throw new ApiInputError('Administrator access required.', 403);
    const ref = record(req.nextUrl.searchParams.get('channel'), req.nextUrl.searchParams.get('orderId'));
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new ApiInputError('Order not found.', 404);
    return NextResponse.json({ order: { ...snapshot.data(), orderId: snapshot.id } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return customError(error); }
}
export async function POST(req: NextRequest) {
  try {
    const identity = await customIdentity(req);
    if (!identity.admin) throw new ApiInputError('Administrator access required.', 403);
    const body = await readJsonObject(req), ref = record(body.channel, body.orderId), db = getAdminDb();
    const order = await db.runTransaction(async tx => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) throw new ApiInputError('Order not found.', 404);
      const existing = { ...snapshot.data(), orderId: snapshot.id } as Order;
      if (body.updatedAt !== existing.updatedAt) throw new ApiInputError('This order changed. Refresh before continuing.', 409);
      const now = new Date(Math.max(Date.now(), Date.parse(existing.updatedAt) + 1 || 0)).toISOString();
      let patch: Partial<Order>;
      try { patch = workflowPatch(existing, body.channel, body as WorkflowInput, now); }
      catch (error) { throw new ApiInputError((error as Error).message, 409); }
      const next = Object.fromEntries(Object.entries({ ...existing, ...patch, ...(body.channel === 'Counter' && body.action === 'complete' ? { collectedAt: now } : {}) }).filter(([, value]) => value !== undefined)) as unknown as Order;
      tx.set(ref, next);
      tx.create(db.collection('adminLogs').doc(), { orderId: existing.orderId, adminUid: identity.uid, adminEmail: identity.email,
        source: body.channel, action: `WORKFLOW_${String(body.action).toUpperCase()}`, previousStatus: existing.status, newStatus: next.status,
        timestamp: now, ...(patch.preparationChecks ? { checks: patch.preparationChecks } : {}) });
      return next;
    });
    return NextResponse.json({ order }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return customError(error); }
}
