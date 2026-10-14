import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ApiInputError, readJsonObject, inputErrorStatus } from '@/lib/api-input';
import { getAdminDb, verifyFirebaseIdToken } from '@/lib/firebase-admin';
import { getPhonePeCredentials, getPhonePeAccessToken, getPhonePeApiBase, fetchPhonePeOrderStatus } from '@/lib/phonepe';
import { TEST_PAYMENT_PAISE, settleTestPayment } from '@/lib/phonepe-test-payment';

export async function GET() {
  const credentials = getPhonePeCredentials();
  return NextResponse.json({ configured: !!credentials, live: credentials?.production ?? false, amount: 1 });
}
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) throw new ApiInputError('Sign in to test payment.', 401);
    const user = await verifyFirebaseIdToken(token);
    const body = await readJsonObject(req);
    if (!['start', 'status'].includes(String(body.action))) throw new ApiInputError('Invalid action.', 400);
    const credentials = getPhonePeCredentials();
    if (!credentials) throw new ApiInputError('PhonePe is not configured.', 503);
    const db = getAdminDb();
    const pointer = db.collection('phonepeTestCustomers').doc(user.uid);
    const currentId = (await pointer.get()).data()?.merchantOrderId;
    const id = body.action === 'status' ? body.merchantOrderId || currentId : currentId;
    if (id && (typeof id !== 'string' || !/^TEST[A-Fa-f0-9]{32}$/.test(id))) throw new ApiInputError('Invalid test payment reference.', 400);
    if (id) {
      const record = (await db.collection('phonepeTestPayments').doc(id).get()).data();
      if (!record || record.ownerUid !== user.uid) throw new ApiInputError('Test payment not found.', 404);
      if (record.state === 'COMPLETED') return NextResponse.json({ paid: true, merchantOrderId: id, state: 'COMPLETED' });
      if (!['FAILED', 'EXPIRED'].includes(record.state)) {
        const accessToken = await getPhonePeAccessToken(credentials);
        const result = await fetchPhonePeOrderStatus(credentials, accessToken, id);
        if (['COMPLETED', 'FAILED', 'EXPIRED'].includes(result.state || '')) {
          await settleTestPayment(id, result.amount, result.state!, result.paymentDetails?.find(p => p.state === 'COMPLETED')?.transactionId);
          if (body.action === 'status' || result.state === 'COMPLETED') return NextResponse.json({ paid: result.state === 'COMPLETED', state: result.state, merchantOrderId: id });
        } else {
          if (body.action === 'start' && !record.redirectUrl) throw new ApiInputError('The previous checkout is being verified. Check its status before trying again.', 409);
          return NextResponse.json({ paid: false, state: result.state || 'PENDING', merchantOrderId: id, redirectUrl: record.redirectUrl });
        }
      } else if (body.action === 'status') return NextResponse.json({ paid: false, state: record.state, merchantOrderId: id });
    } else if (body.action === 'status') throw new ApiInputError('No test payment found.', 404);
    let appUrl: URL;
    try {
      appUrl = new URL((process.env.NODE_ENV === 'production' ? process.env.APP_URL?.trim() : undefined) || req.nextUrl.origin);
      if (!['http:', 'https:'].includes(appUrl.protocol) || appUrl.username || appUrl.password) throw new Error();
      if (appUrl.hostname === '0.0.0.0') appUrl.hostname = 'localhost';
    } catch { throw new ApiInputError('Configure APP_URL with the public application URL.', 503); }
    const merchantOrderId = `TEST${randomUUID().replace(/-/g, '')}`;
    const ref = db.collection('phonepeTestPayments').doc(merchantOrderId);
    const returnUrl = new URL('/payment-test', appUrl.origin);
    returnUrl.searchParams.set('merchantOrderId', merchantOrderId);
    const accessToken = await getPhonePeAccessToken(credentials);
    await db.runTransaction(async tx => {
      const latest = await tx.get(pointer);
      const existingId = latest.data()?.merchantOrderId;
      const existing = existingId ? await tx.get(db.collection('phonepeTestPayments').doc(existingId)) : null;
      if (existing && !['FAILED', 'EXPIRED'].includes(existing.data()?.state)) throw new ApiInputError('A test checkout already exists. Check its status.', 409);
      tx.create(ref, { merchantOrderId, ownerUid: user.uid, amount: TEST_PAYMENT_PAISE, state: 'INITIALIZING', createdAt: new Date().toISOString(), live: credentials.production, redirectUrl: '' });
      tx.set(pointer, { merchantOrderId });
    });
    const response = await fetch(`${getPhonePeApiBase(credentials.production)}/checkout/v2/pay`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `O-Bearer ${accessToken}` },
      body: JSON.stringify({ merchantOrderId, amount: TEST_PAYMENT_PAISE, expireAfter: 1200, metaInfo: { udf1: 'Rs1 test product' }, paymentFlow: { type: 'PG_CHECKOUT', merchantUrls: { redirectUrl: returnUrl.toString() } } }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    const redirectUrl = data.redirectUrl || data.redirect_url;
    if (!response.ok || typeof redirectUrl !== 'string') throw new ApiInputError('Checkout could not be opened. Check payment status before retrying.', 502);
    await db.runTransaction(async tx => {
      const record = await tx.get(ref);
      if (!['COMPLETED', 'FAILED', 'EXPIRED'].includes(record.data()?.state)) tx.update(ref, { state: 'PENDING', redirectUrl });
    });
    return NextResponse.json({ merchantOrderId, redirectUrl, paid: false, state: 'PENDING' });
  } catch (error) {
    const status = inputErrorStatus(error) || 500;
    return NextResponse.json({ error: status === 500 ? 'Unable to verify or start test checkout. Check status before retrying.' : (error as Error).message }, { status });
  }
}
