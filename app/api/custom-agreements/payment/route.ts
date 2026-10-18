import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { ApiInputError } from '@/lib/api-input';
import { customIdentity, customBody, customError, requestReference } from '@/lib/custom-request-server';
import { payableCustomQuote, settleCustomPayment } from '@/lib/custom-payment';
import { fetchPhonePeOrderStatus, getPhonePeAccessToken, getPhonePeApiBase, getPhonePeCredentials } from '@/lib/phonepe';

export const runtime = 'nodejs';
const json = (data: unknown) => NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: NextRequest) {
  try {
    const identity = await customIdentity(req), body = await customBody(req);
    const requestId = requestReference(body.requestId), db = getAdminDb();
    const ref = db.collection('customAgreementRequests').doc(requestId);
    const current = (await ref.get()).data();
    if (!current || current.ownerUid !== identity.uid) throw new ApiInputError('Request not found.', 404);
    if (current.payment?.status === 'Paid') return json({ paid: true });
    const credentials = getPhonePeCredentials();
    if (!credentials) throw new ApiInputError('Online payment is temporarily unavailable. Please try again later.', 503);
    const accessToken = await getPhonePeAccessToken(credentials);
    if (current.payment?.merchantOrderId && current.payment.status === 'Pending') {
      const merchantOrderId = current.payment.merchantOrderId;
      const result = await fetchPhonePeOrderStatus(credentials, accessToken, merchantOrderId);
      const settled = await settleCustomPayment(merchantOrderId, result.amount, result.state ?? 'PENDING', result.paymentDetails?.find(p => p.state === 'COMPLETED')?.transactionId);
      if (settled.paid || body.action === 'status') return json(settled);
      if (!['FAILED', 'EXPIRED'].includes(result.state ?? 'PENDING')) {
        const attempt = (await db.collection('customPhonepeAttempts').doc(merchantOrderId).get()).data();
        if (attempt?.redirectUrl) return json({ redirectUrl: attempt.redirectUrl });
        throw new ApiInputError('Payment is being prepared. Please check payment status shortly.', 409);
      }
    } else if (body.action === 'status') return json({ paid: false, state: current.payment?.status ?? 'NOT_STARTED' });
    if (body.action !== 'pay') throw new ApiInputError('Invalid payment action.');
    const amount = payableCustomQuote(current);
    if (body.quoteAmount !== amount) throw new ApiInputError('Your quote has changed. Refresh and review the latest amount before paying.', 409);
    const merchantOrderId = `CUSTOMPAY${randomUUID().replaceAll('-', '')}`;
    let appUrl: URL;
    try {
      const production = process.env.NODE_ENV === 'production';
      appUrl = new URL(production ? process.env.APP_URL?.trim() || '' : 'http://localhost:3000');
      if (appUrl.username || appUrl.password || (production && (
        appUrl.protocol !== 'https:' || ['localhost', '0.0.0.0', '127.0.0.1', '[::]', '[::1]'].includes(appUrl.hostname)
      ))) throw new Error('Invalid checkout origin');
    } catch {
      throw new ApiInputError('Online payment is temporarily unavailable. Please contact support.', 503);
    }
    const returnUrl = new URL('/my-requests', appUrl.origin);
    returnUrl.searchParams.set('paymentRequest', requestId);
    await db.runTransaction(async tx => {
      const latest = (await tx.get(ref)).data();
      if (!latest || latest.ownerUid !== identity.uid || payableCustomQuote(latest) !== amount || latest.payment?.status === 'Paid' || latest.payment?.status === 'Pending') throw new ApiInputError('This quote or payment has changed. Refresh your requests and retry.', 409);
      const now = new Date().toISOString();
      tx.create(db.collection('customPhonepeAttempts').doc(merchantOrderId), { requestId, ownerUid: identity.uid, amount, state: 'INITIALIZING', initiatedAt: now, returnUrl: returnUrl.toString() });
      tx.update(ref, { status: 'Quoted / Awaiting Payment', quoteAcceptedAt: now, updatedAt: now, payment: { status: 'Pending', merchantOrderId, amount } });
    });
    // Keep uncertain attempts pending: verify with PhonePe before allowing a second charge.
    const response = await fetch(`${getPhonePeApiBase(credentials.production)}/checkout/v2/pay`, {
      method: 'POST', headers: { Authorization: `O-Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantOrderId, amount: amount * 100, expireAfter: 1200, paymentFlow: { type: 'PG_CHECKOUT', message: 'Custom agreement quote', merchantUrls: { redirectUrl: returnUrl.toString() } } }),
      signal: AbortSignal.timeout(15_000),
    });
    const result = await response.json();
    if (!response.ok || typeof result.redirectUrl !== 'string' || new URL(result.redirectUrl).protocol !== 'https:') throw new Error('Checkout unavailable');
    await db.collection('customPhonepeAttempts').doc(merchantOrderId).update({ redirectUrl: result.redirectUrl });
    return json({ redirectUrl: result.redirectUrl });
  } catch (error) { return customError(error); }
}
