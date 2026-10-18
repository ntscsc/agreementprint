import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, verifyFirebaseIdToken } from '@/lib/firebase-admin';
import { ADMIN_EMAILS } from '@/src/config/admin';
import { ApiInputError, inputErrorStatus } from '@/lib/api-input';
import { visitorCalendarKeys } from '@/lib/visitor-metrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) throw new ApiInputError('Sign in to view visitor counts.', 401);
    const user = await verifyFirebaseIdToken(token);
    if (!user.email_verified || !user.email || !ADMIN_EMAILS.some(email => email.toLowerCase() === user.email!.toLowerCase())) throw new ApiInputError('Administrator access is required.', 403);
    const { day, month } = visitorCalendarKeys();
    const stats = getAdminDb().collection('visitorAnalytics');
    const [total, daily, monthly] = await Promise.all([stats.doc('total').get(), stats.doc(`day-${day}`).get(), stats.doc(`month-${month}`).get()]);
    return NextResponse.json({ today: daily.data()?.count ?? 0, month: monthly.data()?.count ?? 0, total: total.data()?.count ?? 0, day, monthKey: month, startedAt: total.data()?.startedAt ?? null }, { headers });
  } catch (error) {
    const status = inputErrorStatus(error) ?? 503;
    return NextResponse.json({ error: status === 503 ? 'Unable to load visitor counts. Please refresh.' : (error as Error).message }, { status, headers });
  }
}
