import { NextRequest, NextResponse } from 'next/server';
import { readJsonObject, inputErrorStatus, ApiInputError } from '@/lib/api-input';
import { getAdminDb, verifyFirebaseIdToken } from '@/lib/firebase-admin';
import { normalizeReferralCode } from '@/lib/referral-utils';
import { isValidCouponCode } from '@/lib/coupon';
import { recordAgentReferral } from '@/lib/agent-referral';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) throw new ApiInputError('Sign in is required.', 401);
    const user = await verifyFirebaseIdToken(token);
    const body = await readJsonObject(request);
    const code = normalizeReferralCode(body.code);
    if (!isValidCouponCode(code)) throw new ApiInputError('Invalid agent code.', 400);
    const db = getAdminDb();
    await recordAgentReferral(db, code, user);
    return NextResponse.json({ saved: true });
  } catch (error) {
    const status = inputErrorStatus(error) || 500;
    return NextResponse.json({ error: status === 500 ? 'Could not record agent referral.' : (error as Error).message }, { status });
  }
}
