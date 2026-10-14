import { readJsonObject, inputErrorStatus, ApiInputError } from '@/lib/api-input';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, verifyFirebaseIdToken } from '@/lib/firebase-admin';
import { ADMIN_EMAILS } from '@/src/config/admin';
import { getReferralRewardAmount } from '@/lib/referral-admin';
import { isValidReferralRewardAmount } from '@/lib/referral-utils';

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
    const [settings, rewards] = await Promise.all([
      db.collection('settings').doc('referrals').get(),
      db.collection('referralRewards').get(),
    ]);
    return NextResponse.json({
      rewardAmount: getReferralRewardAmount(settings.data()),
      rewardedReferrals: rewards.size,
      totalCreditsIssued: rewards.docs.reduce(
        (total, reward) => total + Number(reward.data().amount || 0),
        0,
      ),
    });
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
    if (!isValidReferralRewardAmount(body?.rewardAmount)) {
      return NextResponse.json({
        error: 'Reward amount must be a whole-number value from ₹0 to ₹100,000.',
      }, { status: 400 });
    }

    await getAdminDb().collection('settings').doc('referrals').set({
      rewardAmount: body.rewardAmount,
      updatedAt: new Date().toISOString(),
      updatedBy: admin.email,
    }, { merge: true });

    return NextResponse.json({ saved: true, rewardAmount: body.rewardAmount });
  } catch (error) {
    const status = inputErrorStatus(error);
    if (status) return NextResponse.json({ error: status === 401 ? 'Sign in again to continue.' : (error as Error).message }, { status });
    console.error('Could not save referral reward settings:', error);
    return NextResponse.json({ error: 'Could not save referral reward amount.' }, { status: 500 });
  }
}
