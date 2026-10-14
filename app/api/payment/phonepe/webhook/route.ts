import { readJsonObject, inputErrorStatus } from '@/lib/api-input';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { confirmPaidOrderAndGrantReferral, releaseReferralReservation } from '@/lib/referral-admin';
import { isTrustedPaymentAttempt } from '@/lib/payment-attempt';
function isAuthorizedWebhook(req: NextRequest) {
  const username = process.env.PHONEPE_WEBHOOK_USERNAME;
  const password = process.env.PHONEPE_WEBHOOK_PASSWORD;
  const authorization = req.headers.get('authorization') ?? '';
  if (!username || !password) return false;

  const provided = Buffer.from(authorization.toLowerCase(), 'utf8');
  const expected = Buffer.from(
    crypto.createHash('sha256').update(`${username}:${password}`).digest('hex'),
    'utf8',
  );
  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorizedWebhook(req)) {
      return NextResponse.json({ error: 'Invalid webhook credentials.' }, { status: 401 });
    }

    const eventBody = await readJsonObject(req);
    if (eventBody.event !== 'checkout.order.completed' && eventBody.event !== 'checkout.order.failed') {
      return NextResponse.json({ status: 'ignored' });
    }
    const payload = eventBody.payload;
    const isCompleted = payload?.state === 'COMPLETED';
    const isFailed = payload?.state === 'FAILED';
    if (!isCompleted && !isFailed) return NextResponse.json({ status: 'ignored' });

    const merchantOrderId = typeof payload.merchantOrderId === 'string'
      ? payload.merchantOrderId
      : '';
    if (!/^[A-Za-z0-9_-]+$/.test(merchantOrderId)) return NextResponse.json({ error: 'Missing merchant order reference.' }, { status: 400 });

    const db = getAdminDb();
    const attemptSnapshot = await db.collection('phonepePaymentAttempts').doc(merchantOrderId).get();
    const paymentAttempt = attemptSnapshot.data();
    if (!paymentAttempt || typeof paymentAttempt.orderId !== 'string') {
      return NextResponse.json({ error: 'Payment order not found.' }, { status: 404 });
    }
    const orderDoc = await db.collection('orders').doc(paymentAttempt.orderId).get();
    const order = orderDoc.data();
    if (!order || !isTrustedPaymentAttempt(paymentAttempt, orderDoc.id, order.ownerUid, merchantOrderId)) {
      return NextResponse.json({ error: 'Payment order not found.' }, { status: 404 });
    }
    const expectedAmount = paymentAttempt.amount;
    if (typeof expectedAmount !== 'number' || payload.amount !== Math.round(expectedAmount * 100)) {
      console.error('PhonePe webhook amount mismatch for order:', order.orderId);
      return NextResponse.json({ error: 'PhonePe payment amount mismatch.' }, { status: 409 });
    }

    const completedPayment = Array.isArray(payload.paymentDetails)
      ? payload.paymentDetails.find((payment: { state?: string }) => payment.state === 'COMPLETED')
      : undefined;
    if (isCompleted) {
      await confirmPaidOrderAndGrantReferral(orderDoc.id, {
        transactionId: completedPayment?.transactionId ?? merchantOrderId,
        merchantOrderId,
      });
    } else if (isFailed) {
      await releaseReferralReservation(orderDoc.id, merchantOrderId, 'FAILED');
    }

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    const status = inputErrorStatus(error);
    if (status) return NextResponse.json({ error: status === 401 ? 'Sign in again to continue.' : (error as Error).message }, { status });
    console.error('PhonePe webhook processing error:', error);
    return NextResponse.json({ error: 'PhonePe webhook handling failed.' }, { status: 500 });
  }
}
