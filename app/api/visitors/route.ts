import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { ApiInputError, inputErrorStatus, readJsonObject } from '@/lib/api-input';
import { isVisitorId, isVisitorPage, visitorCalendarKeys } from '@/lib/visitor-metrics';
import { siteOrigin } from '@/lib/seo';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV !== 'production' || (process.env.CONTEXT && process.env.CONTEXT !== 'production') || (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production')) return new NextResponse(null, { status: 204, headers });
    const origin = request.headers.get('origin');
    if (!origin || ![new URL(request.url).origin, siteOrigin].includes(origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new ApiInputError('Invalid request origin.', 403);
    if (request.headers.get('dnt') === '1' || /bot|crawler|spider|headless|lighthouse|preview/i.test(request.headers.get('user-agent') || '')) return new NextResponse(null, { status: 204, headers });
    if (!request.headers.get('content-type')?.includes('application/json')) throw new ApiInputError('JSON is required.', 415);
    const body = await readJsonObject(request);
    if (!isVisitorId(body.visitorId)) throw new ApiInputError('Invalid visitor identifier.');
    if (typeof body.path !== 'string' || !isVisitorPage(body.path)) throw new ApiInputError('Invalid visitor page.');
    const now = new Date(), { day, month } = visitorCalendarKeys(now);
    const db = getAdminDb();
    const visitorRef = db.collection('visitorRegistry').doc(createHash('sha256').update(body.visitorId.toLowerCase()).digest('hex'));
    const totalRef = db.collection('visitorAnalytics').doc('total');
    const dayRef = db.collection('visitorAnalytics').doc(`day-${day}`);
    const monthRef = db.collection('visitorAnalytics').doc(`month-${month}`);
    const limitRef = db.collection('visitorAnalyticsLimits').doc('global');
    await db.runTransaction(async transaction => {
      const visitor = (await transaction.get(visitorRef)).data();
      if (visitor?.lastDay >= day) return;
      const [totalSnap, daySnap, monthSnap, limitSnap] = await transaction.getAll(totalRef, dayRef, monthRef, limitRef);
      const total = totalSnap.data(), daily = daySnap.data(), monthly = monthSnap.data(), limit = limitSnap.data();
      const minute = Math.floor(now.getTime() / 60_000);
      const requests = limit?.minute === minute ? limit.count : 0;
      if (requests >= 300) throw new ApiInputError('Visitor counter is busy.', 429);
      transaction.set(limitRef, { minute, count: requests + 1 });
      transaction.set(visitorRef, { lastDay: day, lastMonth: month });
      transaction.set(dayRef, { count: (daily?.count ?? 0) + 1 });
      if (visitor?.lastMonth !== month) transaction.set(monthRef, { count: (monthly?.count ?? 0) + 1 });
      if (!visitor) transaction.set(totalRef, { count: (total?.count ?? 0) + 1, startedAt: total?.startedAt ?? now.toISOString() });
    });
    return new NextResponse(null, { status: 204, headers });
  } catch (error) {
    const status = inputErrorStatus(error) ?? 503;
    if (status === 503) console.error('Visitor counter unavailable.');
    return NextResponse.json({ error: status === 503 ? 'Visitor counter unavailable.' : (error as Error).message }, { status, headers });
  }
}
