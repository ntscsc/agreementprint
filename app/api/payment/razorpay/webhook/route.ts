import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { validRazorpaySignature } from '@/lib/payment-gateway';
import { settleRazorpayCheckout } from '@/lib/gateway-settlement';

export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 503 });
  try {
    const reader = req.body?.getReader();
    if (!reader) return NextResponse.json({ error: 'Missing body.' }, { status: 400 });
    const chunks: Uint8Array[] = []; let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        length += value.length;
        if (length > 64 * 1024) { await reader.cancel(); return NextResponse.json({ error: 'Body too large.' }, { status: 413 }); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const raw = Buffer.concat(chunks);
    if (!validRazorpaySignature(raw.toString('utf8'), req.headers.get('x-razorpay-signature'), secret)) return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
    let body;
    try { body = JSON.parse(raw.toString('utf8')); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }
    if (!['order.paid', 'payment.captured'].includes(body?.event)) return NextResponse.json({ status: 'ignored' });
    const orderId = body.payload?.payment?.entity?.order_id ?? body.payload?.order?.entity?.id;
    if (typeof orderId !== 'string' || !/^order_[A-Za-z0-9]+$/.test(orderId)) return NextResponse.json({ error: 'Invalid order reference.' }, { status: 400 });
    const record = (await getAdminDb().collection('razorpayOrderReferences').doc(orderId).get()).data();
    if (!record) return NextResponse.json({ error: 'Payment reference is not available yet.' }, { status: 503 });
    // Re-fetch authoritative order and capture status; never settle solely from event fields.
    await settleRazorpayCheckout(record.merchantOrderId);
    return NextResponse.json({ status: 'success' });
  } catch {
    console.error('Razorpay webhook needs reconciliation.');
    return NextResponse.json({ error: 'Payment verification must be retried.' }, { status: 503 });
  }
}
