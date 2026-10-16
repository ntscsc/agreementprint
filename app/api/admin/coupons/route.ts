import { NextRequest, NextResponse } from 'next/server';
import { ApiInputError, inputErrorStatus } from '@/lib/api-input';
import { verifyFirebaseIdToken } from '@/lib/firebase-admin';
import { isUserAdmin } from '@/src/config/admin';

async function retired(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new ApiInputError('Sign in is required.', 401);
    const user = await verifyFirebaseIdToken(token);
    if (!isUserAdmin(user.email, user.email_verified === true)) throw new ApiInputError('Administrator access is required.', 403);
    return NextResponse.json({ error: 'Separate coupon administration has been retired. Manage referral rewards and first-order discounts in Customers or Agents.' }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = inputErrorStatus(error) ?? 500;
    return NextResponse.json({ error: status === 500 ? 'Could not verify administrator access.' : (error as Error).message }, { status });
  }
}
export const GET = retired;
export const POST = retired;
