import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { customIdentity, customError } from '@/lib/custom-request-server';
import { ApiInputError, readJsonObject } from '@/lib/api-input';
import { gatewayCredentials, createGatewayCheckout, recoverRazorpayCheckout } from '@/lib/payment-gateway';
import { settleRazorpayCheckout } from '@/lib/gateway-settlement';
import { TEST_PAYMENT_PAISE } from '@/lib/phonepe-test-payment';

export const runtime = 'nodejs';
const json = (body: unknown) => NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
export async function GET() {
  const credentials = gatewayCredentials('Razorpay');
  return json({ configured: !!credentials, live: credentials?.production ?? false, amount: 1 });
}

export async function POST(req: NextRequest) {
  try {
    const identity = await customIdentity(req), body = await readJsonObject(req);
    if (!['start', 'status'].includes(body.action)) throw new ApiInputError('Invalid test payment action.');
    const credentials = gatewayCredentials('Razorpay');
    if (!credentials) throw new ApiInputError('Razorpay is not configured.', 503);
    const db = getAdminDb();
    const pointer = db.collection('razorpayTestCustomers').doc(`${identity.uid}_${credentials.production ? 'live' : 'test'}`);
    const legacyPointer = db.collection('razorpayTestCustomers').doc(identity.uid);
    let currentId = (await pointer.get()).data()?.merchantOrderId;
    // Preserve an older same-mode checkout without treating a sandbox result as live.
    if (!currentId) {
      const legacyId = (await legacyPointer.get()).data()?.merchantOrderId;
      if (typeof legacyId === 'string' && /^RZTEST[a-f0-9]{32}$/.test(legacyId)) {
        const legacy = (await db.collection('razorpayTestPayments').doc(legacyId).get()).data();
        if (legacy?.ownerUid === identity.uid && legacy.live === credentials.production) currentId = legacyId;
      }
    }
    const id = body.action === 'status' ? body.merchantOrderId ?? currentId : currentId;
    if (id !== undefined && (typeof id !== 'string' || !/^RZTEST[a-f0-9]{32}$/.test(id))) throw new ApiInputError('Invalid Razorpay test payment reference.');
    if (id) {
      const record = (await db.collection('razorpayTestPayments').doc(id).get()).data();
      if (!record || record.ownerUid !== identity.uid) throw new ApiInputError('Test payment not found.', 404);
      const association = (await db.collection('razorpayCheckouts').doc(id).get()).data();
      if (record.live !== credentials.production || association?.keyId !== credentials.keyId) throw new ApiInputError('This payment belongs to different Razorpay keys or test/live mode. Open the payment-test page without the old reference to use the current mode.', 409);
      if (record.state === 'COMPLETED') return json({ paid: true, state: 'COMPLETED', merchantOrderId: id, live: record.live });
      // Individual failed/cancelled payment attempts do not close a Razorpay order.
      // Reuse the same provider order until a full capture has been verified.
      const result = await settleRazorpayCheckout(id);
      const redirectUrl = !result.paid && body.action === 'start' ? await recoverRazorpayCheckout(id, identity.uid) : undefined;
      if (body.action === 'start' && !result.paid && !redirectUrl) throw new ApiInputError('The existing test checkout needs verification. Check its status before retrying.', 409);
      return json({ paid: result.paid, state: result.paid ? 'COMPLETED' : 'PENDING', merchantOrderId: id, live: record.live, ...(redirectUrl ? { redirectUrl } : {}) });
    }
    if (body.action === 'status') throw new ApiInputError('No Razorpay test payment found.', 404);
    let appUrl: URL;
    try {
      appUrl = new URL((process.env.NODE_ENV === 'production' ? process.env.APP_URL?.trim() : undefined) || req.nextUrl.origin);
      if (!['http:', 'https:'].includes(appUrl.protocol) || appUrl.username || appUrl.password) throw new Error();
      if (process.env.NODE_ENV === 'production' && appUrl.protocol !== 'https:') throw new Error();
      if (appUrl.hostname === '0.0.0.0') appUrl.hostname = 'localhost';
    } catch { throw new ApiInputError('Configure APP_URL with the public application URL.', 503); }
    const merchantOrderId = `RZTEST${randomUUID().replaceAll('-', '')}`;
    const ref = db.collection('razorpayTestPayments').doc(merchantOrderId);
    const returnUrl = new URL('/payment-test', appUrl.origin);
    returnUrl.searchParams.set('gateway', 'Razorpay');
    returnUrl.searchParams.set('merchantOrderId', merchantOrderId);
    await db.runTransaction(async tx => {
      const latestId = (await tx.get(pointer)).data()?.merchantOrderId;
      if (latestId) throw new ApiInputError('A Razorpay test checkout already exists. Check its status.', 409);
      const legacyId = (await tx.get(legacyPointer)).data()?.merchantOrderId;
      if (typeof legacyId === 'string' && /^RZTEST[a-f0-9]{32}$/.test(legacyId)) {
        const legacy = (await tx.get(db.collection('razorpayTestPayments').doc(legacyId))).data();
        if (legacy?.ownerUid === identity.uid && legacy.live === credentials.production) throw new ApiInputError('A test checkout for this mode already exists. Check its status.', 409);
      }
      tx.create(ref, { merchantOrderId, ownerUid: identity.uid, gateway: 'Razorpay', amount: TEST_PAYMENT_PAISE, state: 'INITIALIZING', live: credentials.production, createdAt: new Date().toISOString() });
      tx.set(pointer, { merchantOrderId });
    });
    const response = await createGatewayCheckout(credentials, '', merchantOrderId, TEST_PAYMENT_PAISE, returnUrl.toString(), identity.uid);
    const result = await response.json();
    if (!response.ok || typeof result.redirectUrl !== 'string') throw new ApiInputError('Check test payment status before trying again.', 502);
    await db.runTransaction(async tx => {
      const record = (await tx.get(ref)).data();
      if (record?.state !== 'COMPLETED') tx.update(ref, { state: 'PENDING' });
    });
    return json({ merchantOrderId, order_id: result.order_id, amount: result.amount, currency: result.currency, redirectUrl: result.redirectUrl, paid: false, state: 'PENDING', live: credentials.production });
  } catch (error) { return customError(error); }
}
