import { readJsonObject, inputErrorStatus } from '@/lib/api-input';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, verifyFirebaseIdToken } from '@/lib/firebase-admin';
import { getOrCreateReferralAccount, getReferralRewardAmount } from '@/lib/referral-admin';

export async function GET(request: NextRequest) {
  try {
    const idToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!idToken) return NextResponse.json({ error: 'Sign in to view referral credits.' }, { status: 401 });

    const { uid } = await verifyFirebaseIdToken(idToken);
    const db = getAdminDb();
    const account = await getOrCreateReferralAccount(uid, db);
    const referralSettings = await db.collection('settings').doc('referrals').get();
    const [ordersSnapshot, rewardsSnapshot, ledgerSnapshot, firstPaidOrder, customerOrders] = await Promise.all([
      db.collection('orders').where('referralCode', '==', account.code).limit(100).get(),
      db.collection('referralRewards').where('referrerUid', '==', uid).limit(100).get(),
      db.collection('referralLedger').where('ownerUid', '==', uid).limit(100).get(),
      db.collection('referralFirstPaidOrders').doc(uid).get(),
      db.collection('orders').where('ownerUid', '==', uid).get(),
    ]);

    const rewardsByReferredUid = new Map(
      rewardsSnapshot.docs.map((reward) => [reward.id, reward.data()]),
    );
    const referrals = ordersSnapshot.docs
      .filter((order) => order.data().ownerUid !== uid)
      .map((order) => {
        const data = order.data();
        const reward = rewardsByReferredUid.get(data.ownerUid);
        return {
          status: data.payment?.status === 'Paid'
            ? reward ? 'Rewarded' : 'Paid — no reward earned'
            : 'Awaiting first paid order',
          rewardAmount: reward?.amount ?? 0,
          createdAt: data.createdAt,
        };
      })
      .sort((first, second) => String(second.createdAt).localeCompare(String(first.createdAt)));

    const ledger = ledgerSnapshot.docs
      .map((entry) => entry.data())
      .sort((first, second) => String(second.createdAt).localeCompare(String(first.createdAt)))
      .slice(0, 100);

    return NextResponse.json({
      code: account.code,
      balance: account.balance,
      canApplyReferralCode: !firstPaidOrder.exists && !customerOrders.docs.some((order) => order.data().payment?.status === 'Paid'),
      rewardAmount: getReferralRewardAmount(referralSettings.data()),
      referrals,
      ledger,
    });
  } catch (error) {
    const status = inputErrorStatus(error);
    if (status) return NextResponse.json({ error: status === 401 ? 'Sign in again to continue.' : (error as Error).message }, { status });
    console.error('Could not load customer referral account:', error);
    return NextResponse.json({ error: 'Could not load referral credits right now.' }, { status: 500 });
  }
}
