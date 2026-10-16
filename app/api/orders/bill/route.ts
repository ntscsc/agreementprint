import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, verifyFirebaseIdToken } from '@/lib/firebase-admin';
import { inputErrorStatus, readJsonObject, validDocumentId } from '@/lib/api-input';
import { getOrderBill } from '@/lib/order-bill';
import { renderOrderBill } from '@/lib/order-bill-pdf';
import { VENDOR_CONFIG } from '@/src/config/vendor';
import type { Order } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'Sign in to download your bill.' }, { status: 401 });
    const user = await verifyFirebaseIdToken(token);
    const { orderId } = await readJsonObject(req);
    if (typeof orderId !== 'string' || !validDocumentId(orderId)) return NextResponse.json({ error: 'A valid order reference is required.' }, { status: 400 });
    const db = getAdminDb();
    const snapshot = await db.collection('orders').doc(orderId).get();
    if (!snapshot.exists || snapshot.data()?.ownerUid !== user.uid) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    const order = { ...snapshot.data(), orderId } as Order;
    if (order.payment?.status !== 'Paid') return NextResponse.json({ error: 'Your bill is available after payment is confirmed.' }, { status: 409 });
    let bill;
    try { bill = getOrderBill(order); }
    catch { return NextResponse.json({ error: 'The saved payment details need review. Please contact support.' }, { status: 409 }); }
    const support = await db.collection('settings').doc('support').get();
    const email = support.data()?.email;
    const pdf = await renderOrderBill(bill, typeof email === 'string' && email.trim() ? email.trim() : VENDOR_CONFIG.email);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="AgreementPrint-Bill-${orderId.replace(/[^A-Za-z0-9_-]/g, '_')}.pdf"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const status = inputErrorStatus(error);
    if (status) return NextResponse.json({ error: status === 401 ? 'Sign in again to download your bill.' : (error as Error).message }, { status });
    console.error('Bill download failed:', error);
    return NextResponse.json({ error: 'Unable to create your bill right now. Please try again.' }, { status: 500 });
  }
}
