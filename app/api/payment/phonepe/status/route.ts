import { readJsonObject, inputErrorStatus, validDocumentId } from '@/lib/api-input';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, verifyFirebaseIdToken } from '@/lib/firebase-admin';
import { fetchPhonePeOrderStatus, getPhonePeAccessToken, getPhonePeCredentials } from '@/lib/phonepe';
import { confirmPaidOrderAndGrantReferral, releaseReferralReservation } from '@/lib/referral-admin';
import { isTrustedPaymentAttempt } from '@/lib/payment-attempt';

export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!idToken) return NextResponse.json({ error: 'Sign in is required.' }, { status: 401 });

    const decodedToken = await verifyFirebaseIdToken(idToken);
    const body = await readJsonObject(req);
    const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';
    const requestedMerchantOrderId =
      typeof body?.merchantOrderId === 'string' ? body.merchantOrderId.trim() : '';
    if (!validDocumentId(orderId)) return NextResponse.json({ error: 'A valid order reference is required.' }, { status: 400 });

    if (requestedMerchantOrderId && !validDocumentId(requestedMerchantOrderId)) return NextResponse.json({ error: 'Invalid payment reference.' }, { status: 400 });
    const db = getAdminDb();
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    const order = orderSnap.data()!;
    if (order.ownerUid !== decodedToken.uid) return NextResponse.json({ error: 'Order access denied.' }, { status: 403 });
    if (order.payment?.status === 'Paid') return NextResponse.json({ paid: true });

    const credentials = getPhonePeCredentials();
    const merchantOrderId = requestedMerchantOrderId || order.payment?.phonepeMerchantOrderId;
    if (!credentials || typeof merchantOrderId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(merchantOrderId)) {
      return NextResponse.json({ error: 'No payment attempt was found for this order.' }, { status: 404 });
    }
    const attemptSnapshot = await db.collection('phonepePaymentAttempts').doc(merchantOrderId).get();
    const paymentAttempt = attemptSnapshot.data();
    if (!isTrustedPaymentAttempt(paymentAttempt, orderId, decodedToken.uid, merchantOrderId)) {
      return NextResponse.json({ error: 'Payment attempt was not found for this order.' }, { status: 404 });
    }
    const expectedAmount = paymentAttempt.amount;
    const initiatedAt = paymentAttempt.initiatedAt;

    const accessToken = await getPhonePeAccessToken(credentials);
    const paymentStatus = await fetchPhonePeOrderStatus(credentials, accessToken, merchantOrderId);
    const completedPayment = paymentStatus.paymentDetails?.find((payment) => payment.state === 'COMPLETED');
    if (paymentStatus.state === 'COMPLETED') {
      if (typeof expectedAmount !== 'number' || paymentStatus.amount !== Math.round(expectedAmount * 100)) {
        console.error('PhonePe amount mismatch for order:', orderId);
        return NextResponse.json({ error: 'Payment amount did not match the order.' }, { status: 409 });
      }

      await confirmPaidOrderAndGrantReferral(orderId, {
        transactionId: completedPayment?.transactionId ?? merchantOrderId,
        merchantOrderId,
      });
      return NextResponse.json({ paid: true });
    }

    if (paymentStatus.state === 'FAILED' || paymentStatus.state === 'EXPIRED') {
      await releaseReferralReservation(orderId, merchantOrderId, paymentStatus.state);
      return NextResponse.json({ paid: false, state: paymentStatus.state });
    }

    return NextResponse.json({
      paid: false,
      state: paymentStatus.state ?? 'PENDING',
      expireAt: paymentStatus.expireAt,
      initiatedAt,
    });
  } catch (error) {
    const status = inputErrorStatus(error);
    if (status) return NextResponse.json({ error: status === 401 ? 'Sign in again to continue.' : (error as Error).message }, { status });
    console.error('PhonePe status verification error:', error);
    return NextResponse.json({ error: 'Unable to verify payment right now.' }, { status: 500 });
  }
}
