import { readJsonObject, inputErrorStatus, ApiInputError } from '@/lib/api-input';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, verifyFirebaseIdToken } from '@/lib/firebase-admin';
import { ADMIN_EMAILS } from '@/src/config/admin';
import { getReferralRewardAmount } from '@/lib/referral-admin';
import { isValidReferralRewardAmount } from '@/lib/referral-utils';
import { couponDiscountAmount } from '@/lib/coupon';
import { randomUUID } from 'node:crypto';

async function requireAdmin(request: NextRequest) {
  const idToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!idToken) throw new ApiInputError('Sign in is required.', 401);

  const user = await verifyFirebaseIdToken(idToken);
  const email = user.email?.toLowerCase();
  if (!user.email_verified || !email || !ADMIN_EMAILS.some((admin) => admin.toLowerCase() === email)) {
    return null;
  }

  return user;
}

export async function GET(request: NextRequest) {
  try {
    if (!await requireAdmin(request)) {
      return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 });
    }

    const db = getAdminDb();
    const [settings, rewards, legacyDiscounts, paidOrders] = await Promise.all([
      db.collection('settings').doc('referrals').get(),
      db.collection('referralRewards').get(),
      db.collection('settings').doc('coupons').get(),
      db.collection('orders').where('payment.status', '==', 'Paid').get(),
    ]);
    const confirmedOrders = new Map(paidOrders.docs.map(doc => [doc.id, doc.data().ownerUid]));
    const confirmedRewards = rewards.docs.filter(reward => {
      const data = reward.data();
      return data.kind !== 'agent' && typeof data.orderId === 'string' &&
        typeof data.referredUid === 'string' && !!data.referredUid && reward.id === data.referredUid &&
        typeof data.referrerUid === 'string' && !!data.referrerUid && data.referrerUid !== data.referredUid &&
        confirmedOrders.has(data.orderId) && confirmedOrders.get(data.orderId) === data.referredUid &&
        isValidReferralRewardAmount(data.amount);
    });
    return NextResponse.json({
      rewardAmount: getReferralRewardAmount(settings.data()),
      refereeDiscountAmount: couponDiscountAmount({}, { ...legacyDiscounts.data(), ...settings.data() }),
      rewardedReferrals: confirmedRewards.length,
      totalCreditsIssued: confirmedRewards.reduce(
        (total, reward) => total + Number(reward.data().amount || 0),
        0,
      ),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = inputErrorStatus(error);
    if (status) return NextResponse.json({ error: status === 401 ? 'Sign in again to continue.' : (error as Error).message }, { status });
    console.error('Could not load referral administration settings:', error);
    return NextResponse.json({ error: 'Could not load referral settings.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 });
    }

    const body = await readJsonObject(request);
    if (!isValidReferralRewardAmount(body?.rewardAmount) || !isValidReferralRewardAmount(body?.refereeDiscountAmount)) {
      return NextResponse.json({
        error: 'Enter both the referrer credit and first-order discount as whole rupees from ₹0 to ₹100,000.',
      }, { status: 400 });
    }

    const db = getAdminDb();
    const timestamp = new Date().toISOString();
    const logId = `REFERRAL_${randomUUID()}`;
    await db.runTransaction(async transaction => {
      transaction.set(db.collection('settings').doc('referrals'), {
        rewardAmount: body.rewardAmount,
        refereeDiscountAmount: body.refereeDiscountAmount,
        updatedAt: timestamp,
        updatedBy: admin.email,
      }, { merge: true });
      transaction.create(db.collection('adminLogs').doc(logId), {
        logId, orderId: 'REFERRAL_CONFIG', adminUid: admin.uid, adminEmail: admin.email,
        action: 'REFERRAL_REWARD_UPDATED',
        notes: `Customer referrer credit: INR ${body.rewardAmount}; first-order discount: INR ${body.refereeDiscountAmount}.`,
        timestamp,
      });
    });

    return NextResponse.json({ saved: true, rewardAmount: body.rewardAmount, refereeDiscountAmount: body.refereeDiscountAmount });
  } catch (error) {
    const status = inputErrorStatus(error);
    if (status) return NextResponse.json({ error: status === 401 ? 'Sign in again to continue.' : (error as Error).message }, { status });
    console.error('Could not save referral reward settings:', error);
    return NextResponse.json({ error: 'Could not save referral reward amount.' }, { status: 500 });
  }
}
