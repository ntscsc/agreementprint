import { ApiInputError, readJsonObject, inputErrorStatus } from '@/lib/api-input';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, verifyFirebaseIdToken } from '@/lib/firebase-admin';
import { normalizeReferralCode } from '@/lib/referral-utils';
import { recordAgentReferral } from '@/lib/agent-referral';
import { getCouponQuote } from '@/lib/coupon-server';
import { getServerPricing } from '@/lib/server-pricing';
import { calculateOrderPrice, extraCopiesError } from '@/src/config/pricing';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new ApiInputError('Sign in before applying a coupon code.', 401);
    const user = await verifyFirebaseIdToken(token), body = await readJsonObject(request);
    const code = normalizeReferralCode(body.code);
    if (!code) throw new ApiInputError('Enter a coupon code.');
    let subtotal = 1;
    if (body.packageOptions !== undefined) {
      const terms = body.packageOptions;
      if (!terms || ![100, 200].includes(terms.stampPaperDenomination) || !['Within Chennai', 'Within Tamil Nadu'].includes(terms.deliveryLocation) || typeof terms.includeNotary !== 'boolean') throw new ApiInputError('Select valid package options.');
      const copyError = extraCopiesError(terms.extraCopies === undefined ? 0 : terms.extraCopies);
      if (copyError) throw new ApiInputError(copyError);
      subtotal = calculateOrderPrice(await getServerPricing(), terms.stampPaperDenomination, terms.deliveryLocation, terms.includeNotary, terms.extraCopies).totalPayable;
    }
    const db = getAdminDb();
    const quote = await getCouponQuote(db, user.uid, code, subtotal, typeof body.orderId === 'string' ? body.orderId : undefined);
    const coupon = await db.collection('referralCodes').doc(code).get();
    if (coupon.data()?.kind === 'agent') await recordAgentReferral(db, code, user);
    return NextResponse.json({ valid: true, ...(body.packageOptions !== undefined ? quote : {}) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = inputErrorStatus(error) ?? 500;
    if (status === 500) console.error('Coupon validation failed:', error);
    return NextResponse.json({ valid: false, error: status === 500 ? 'Could not validate that coupon right now.' : (error as Error).message }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
