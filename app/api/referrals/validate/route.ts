import { readJsonObject, inputErrorStatus } from '@/lib/api-input';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, verifyFirebaseIdToken } from '@/lib/firebase-admin';
import { normalizeReferralCode, isValidReferralCode } from '@/lib/referral-utils';

export async function POST(request: NextRequest) {
  try {
    const idToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!idToken) return NextResponse.json({ error: 'Sign in before applying a referral code.' }, { status: 401 });

    const { uid } = await verifyFirebaseIdToken(idToken);
    const body = await readJsonObject(request);
    const code = normalizeReferralCode(body?.code);
    if (!isValidReferralCode(code)) {
      return NextResponse.json({ valid: false, error: 'Enter a valid referral code.' }, { status: 400 });
    }

    const db = getAdminDb();
    const codeSnapshot = await db.collection('referralCodes').doc(code).get();
    const referrerUid = codeSnapshot.data()?.uid;
    if (!codeSnapshot.exists || typeof referrerUid !== 'string') {
      return NextResponse.json({ valid: false, error: 'That referral code was not found.' }, { status: 404 });
    }
    if (referrerUid === uid) {
      return NextResponse.json({ valid: false, error: 'You cannot use your own referral code.' }, { status: 400 });
    }

    const [firstPaidOrder, previousOrders] = await Promise.all([
      db.collection('referralFirstPaidOrders').doc(uid).get(),
      db.collection('orders')
        .where('ownerUid', '==', uid)
        .get(),
    ]);
    const hasPaidOrder = previousOrders.docs.some((order) => order.data().payment?.status === 'Paid');
    if (firstPaidOrder.exists || hasPaidOrder) {
      return NextResponse.json({
        valid: false,
        error: 'Referral codes are available for a customer’s first paid order only.',
      }, { status: 409 });
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    const status = inputErrorStatus(error);
    if (status) return NextResponse.json({ error: status === 401 ? 'Sign in again to continue.' : (error as Error).message }, { status });
    console.error('Referral code validation failed:', error);
    return NextResponse.json({ error: 'Could not validate that referral code right now.' }, { status: 500 });
  }
}
