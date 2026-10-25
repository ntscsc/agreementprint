import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { customIdentity, customError } from '@/lib/custom-request-server';
import { ApiInputError, readJsonObject, validDocumentId } from '@/lib/api-input';
import { checkoutDetailsChanged } from '@/lib/order-checkout-details';
import { validateCounterAgreement } from '@/lib/counter-order';
import { allocatePublicOrderReference } from '@/lib/public-order-reference';
import { getOrderBill } from '@/lib/order-bill';
import { renderOrderBill } from '@/lib/order-bill-pdf';
import { VENDOR_CONFIG } from '@/src/config/vendor';
import type { CounterOrder } from '@/lib/counter-order';

export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  try {
    if (!(await customIdentity(req)).admin) throw new ApiInputError('Administrator access required.', 403);
    const snapshot = await getAdminDb().collection('counterOrders').orderBy('updatedAt', 'desc').limit(200).get();
    return NextResponse.json({ orders: snapshot.docs.map(doc => doc.data()) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return customError(error); }
}
export async function POST(req: NextRequest) {
  try {
    const identity = await customIdentity(req);
    if (!identity.admin) throw new ApiInputError('Administrator access required.', 403);
    const body = await readJsonObject(req);
    if (!validDocumentId(body.orderId) || !/^COUNTER_[a-f0-9]{32}$/.test(body.orderId)) throw new ApiInputError('Invalid counter order.');
    const db = getAdminDb(), ref = db.collection('counterOrders').doc(body.orderId);
    if (body.action === 'bill') {
      const order = (await ref.get()).data() as CounterOrder | undefined;
      if (!order || order.payment.status !== 'Paid') throw new ApiInputError('Record payment before printing the bill.', 409);
      const bill = getOrderBill(order);
      bill.description = `${order.agreementTerms.agreementType || 'Rental'} agreement, stamp paper and counter collection`;
      bill.gateway = order.counterPaymentMethod;
      bill.transaction = order.counterPaymentReference || undefined;
      const support = (await db.collection('settings').doc('support').get()).data()?.email;
      const bytes = await renderOrderBill(bill, support || VENDOR_CONFIG.email);
      return new NextResponse(new Uint8Array(bytes), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="Bill-${order.publicReference}.pdf"`, 'Cache-Control': 'private, no-store' } });
    }
    const order = await db.runTransaction(async tx => {
      const existing = (await tx.get(ref)).data() as CounterOrder | undefined;
      const previousTime = existing ? Date.parse(existing.updatedAt) : 0;
      const now = new Date(Math.max(Date.now(), Number.isFinite(previousTime) ? previousTime + 1 : 0)).toISOString();
      let next: CounterOrder;
      if (body.action === 'save') {
        if (existing?.collectedAt) throw new ApiInputError('Collected orders cannot be edited.', 409);
        if (existing && body.updatedAt !== existing.updatedAt) {
          if (body.saveKey && body.saveKey === (existing as CounterOrder & { saveKey?: string }).saveKey) return existing;
          throw new ApiInputError('This order changed. Reopen it before saving.', 409);
        }
        if (typeof body.saveKey !== 'string' || !/^[a-f0-9]{32}$/.test(body.saveKey)) throw new ApiInputError('Invalid save reference.');
        const details = Object.fromEntries(['ownerDetails', 'tenantDetails', 'propertyDetails', 'agreementTerms'].map(key => [key, body[key]]));
        validateCounterAgreement(details);
        if (existing?.payment.status === 'Paid' && (body.counterAmount !== existing.counterAmount || body.counterPaymentMethod !== existing.counterPaymentMethod || body.counterPaymentReference !== existing.counterPaymentReference)) throw new ApiInputError('Recorded payment cannot be changed. Contact the administrator for reconciliation.', 409);
        if (!Number.isSafeInteger(body.counterAmount) || body.counterAmount < 1 || body.counterAmount > 1000000) throw new ApiInputError('Enter a counter charge from Rs.1 to Rs.10,00,000 in whole rupees.');
        if (!['Cash', 'UPI', 'Card', 'Unpaid'].includes(body.counterPaymentMethod)) throw new ApiInputError('Select a counter payment method.');
        if (typeof body.counterPaymentReference !== 'string' || body.counterPaymentReference.length > 150) throw new ApiInputError('Payment reference must be under 150 characters.');
        if (['UPI', 'Card'].includes(body.counterPaymentMethod) && !body.counterPaymentReference.trim()) throw new ApiInputError('Enter the counter payment reference.');
        const allocation = existing ? null : await allocatePublicOrderReference(db, tx, body.orderId);
        const paid = body.counterPaymentMethod !== 'Unpaid';
        next = { ...(existing || {}), ...details, orderId: body.orderId, publicReference: existing?.publicReference || allocation!.reference,
          source: 'Counter', ownerUid: `counter_${body.orderId}`, customerEmail: body.ownerDetails.email || '', customerPhone: body.ownerDetails.phone,
          proofUploads: {}, status: existing?.status || 'Under verification', createdAt: existing?.createdAt || now, updatedAt: now, createdBy: existing?.createdBy || identity.uid,
          counterAmount: body.counterAmount, counterPaymentMethod: body.counterPaymentMethod, counterPaymentReference: body.counterPaymentReference.trim(),
          payment: { status: paid ? 'Paid' : 'Pending', amount: paid ? body.counterAmount : 0, totalBeforeCredits: body.counterAmount, subtotal: body.counterAmount, gateway: 'Counter', ...(paid ? { paidAt: existing?.payment.paidAt || now } : {}) },
          saveKey: body.saveKey,
        } as CounterOrder;
        if (existing && checkoutDetailsChanged({ ...existing }, details)) { next.status = 'Under verification'; delete next.preparationStartedAt; }
        allocation?.write();
      } else {
        if (!existing) throw new ApiInputError('Counter order not found.', 404);
        if (body.updatedAt !== existing.updatedAt) throw new ApiInputError('Order changed. Refresh and try again.', 409);
        next = { ...existing, updatedAt: now };
        if (body.action === 'print') {
          if (existing.payment.status !== 'Paid' && body.allowUnpaid !== true) throw new ApiInputError('Confirm printing without payment.', 409);
          if (!existing.collectedAt) { next.status = 'Drafting'; next.preparationStartedAt = existing.preparationStartedAt || now; }
        } else if (body.action === 'collect') {
          if (existing.payment.status !== 'Paid') throw new ApiInputError('Record the counter payment before collection.', 409);
          if (!existing.preparationStartedAt) throw new ApiInputError('Prepare the print copy before collection.', 409);
          next.status = 'Delivered'; next.collectedAt = existing.collectedAt || now;
        } else throw new ApiInputError('Invalid counter action.');
      }
      tx.set(ref, next);
      tx.create(db.collection('adminLogs').doc(), { orderId: body.orderId, adminUid: identity.uid, action: `COUNTER_${body.action.toUpperCase()}`, source: 'Counter', timestamp: now, ...(existing && body.action === 'save' ? { before: existing } : {}), ...(body.action === 'save' ? { after: next } : {}), allowUnpaid: body.allowUnpaid === true });
      return next;
    });
    return NextResponse.json({ order }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return customError(error); }
}
