import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { customIdentity, customError } from '@/lib/custom-request-server';
import { ApiInputError, readJsonObject, validDocumentId } from '@/lib/api-input';
import { allocatePublicOrderReference } from '@/lib/public-order-reference';

export async function POST(req: NextRequest) {
  try {
    const identity = await customIdentity(req), body = await readJsonObject(req);
    if (!validDocumentId(body.orderId)) throw new ApiInputError('Invalid order reference.');
    const db = getAdminDb(), ref = db.collection('orders').doc(body.orderId);
    const reference = await db.runTransaction(async tx => {
      const order = (await tx.get(ref)).data();
      if (!order || (!identity.admin && order.ownerUid !== identity.uid)) throw new ApiInputError('Order not found.', 404);
      if (order.publicReference) return order.publicReference;
      const allocation = await allocatePublicOrderReference(db, tx, body.orderId);
      allocation.write();
      tx.update(ref, { publicReference: allocation.reference });
      return allocation.reference;
    });
    return NextResponse.json({ reference }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return customError(error); }
}
