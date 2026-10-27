import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { ApiInputError } from '@/lib/api-input';
import { customIdentity, customBody, customError, requestReference } from '@/lib/custom-request-server';
import { payableCustomQuote, settleCustomPayment } from '@/lib/custom-payment';
import { customPaymentRetryAt } from '@/lib/custom-payment-window';
import { fetchGatewayOrderStatus as fetchPhonePeOrderStatus, getGatewayAccessToken as getPhonePeAccessToken, getCheckoutCredentials, createGatewayCheckout, recoverRazorpayCheckout } from '@/lib/payment-gateway';

export const runtime = 'nodejs';
const json = (data: unknown) => NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: NextRequest) {
  try {
    const identity = await customIdentity(req), body = await customBody(req);
    if (!['pay', 'status'].includes(String(body.action))) throw new ApiInputError('Invalid payment action.');
    const requestId = requestReference(body.requestId), db = getAdminDb();
    const ref = db.collection('customAgreementRequests').doc(requestId);
    const current = (await ref.get()).data();
    if (!current || current.ownerUid !== identity.uid) throw new ApiInputError('Request not found.', 404);
    if (body.action === 'pay' && ['Cancelled', 'Declined'].includes(current.status)) throw new ApiInputError('This request is closed. No payment can be started.', 409);
    if (current.payment?.status === 'Paid') return json({ paid: true });
    const pendingAttempt = current.payment?.merchantOrderId && current.payment.status === 'Pending' ? (await db.collection('customPhonepeAttempts').doc(current.payment.merchantOrderId).get()).data() : null;
    let credentials = await getCheckoutCredentials(db, current.payment?.status === 'Pending' ? pendingAttempt?.gateway ?? 'PhonePe' : undefined);
    if (!credentials) throw new ApiInputError('Online payment is temporarily unavailable. Please try again later.', 503);
    let accessToken = await getPhonePeAccessToken(credentials);
    if (current.payment?.merchantOrderId && current.payment.status === 'Pending') {
      const merchantOrderId = current.payment.merchantOrderId;
      const retryAt = customPaymentRetryAt(pendingAttempt || {}, current.payment.startedAt || current.quoteAcceptedAt);
      const timedOut = retryAt !== null && Date.now() >= retryAt;
      const result = await fetchPhonePeOrderStatus(credentials, accessToken, merchantOrderId, credentials.gateway === 'Razorpay');
      const settled = await settleCustomPayment(merchantOrderId, result.amount, result.state ?? 'PENDING', result.paymentDetails?.find(p => p.state === 'COMPLETED')?.transactionId);
      if (settled.paid) return json(settled);
      if ((result.state ?? 'PENDING') === 'PENDING' && (timedOut || credentials.gateway === 'Razorpay')) {
        const retryAvailable = credentials.gateway === 'Razorpay' && result.retrySafe === true;
        const reviewRequired = timedOut && !retryAvailable;
        await db.runTransaction(async tx => {
          const latest = (await tx.get(ref)).data();
          if (!latest || latest.payment?.merchantOrderId !== merchantOrderId || latest.payment.status !== 'Pending') throw new ApiInputError('Payment changed. Check its latest status.', 409);
          tx.update(ref, { 'payment.retryAvailable': retryAvailable, 'payment.reviewRequired': reviewRequired, 'payment.lastCheckedAt': new Date().toISOString() });
        });
        if (body.action === 'status') return json({ ...settled, retryAvailable, reviewRequired, retryAt });
        if (!retryAvailable) throw new ApiInputError('Payment is still processing with the gateway. Check its status before trying another payment.', 409);
      }
      if (body.action === 'status') return json({ ...settled, ...(retryAt !== null ? { retryAt } : {}) });
      if (!['FAILED', 'EXPIRED'].includes(result.state ?? 'PENDING')) {
        const attempt = (await db.collection('customPhonepeAttempts').doc(merchantOrderId).get()).data();
        const resumedUrl = attempt?.redirectUrl || (credentials.gateway === 'Razorpay' ? await recoverRazorpayCheckout(merchantOrderId, identity.uid) : null);
        if (resumedUrl) {
          if (timedOut || credentials.gateway === 'Razorpay') await db.runTransaction(async tx => {
            const latest = (await tx.get(ref)).data();
            if (!latest || latest.payment?.merchantOrderId !== merchantOrderId || latest.payment.status !== 'Pending') throw new ApiInputError('Payment changed. Check its latest status.', 409);
            const now = new Date().toISOString();
            tx.update(ref, { 'payment.retryAvailable': false, 'payment.reviewRequired': false, 'payment.checkoutClosed': false, 'payment.startedAt': now });
            tx.update(db.collection('customPhonepeAttempts').doc(merchantOrderId), { resumedAt: now });
          });
          return json({ redirectUrl: resumedUrl });
        }
        throw new ApiInputError('Payment is being prepared. Please check payment status shortly.', 409);
      }
    } else if (body.action === 'status') return json({ paid: false, state: current.payment?.status ?? 'NOT_STARTED' });
    if (body.action !== 'pay') throw new ApiInputError('Invalid payment action.');
    credentials = await getCheckoutCredentials(db);
    if (!credentials) throw new ApiInputError('Online payment is temporarily unavailable.', 503);
    accessToken = await getPhonePeAccessToken(credentials);
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
      tx.create(db.collection('customPhonepeAttempts').doc(merchantOrderId), { gateway: credentials!.gateway ?? 'PhonePe', requestId, ownerUid: identity.uid, amount, state: 'INITIALIZING', initiatedAt: now, returnUrl: returnUrl.toString() });
      tx.update(ref, { status: 'Quoted / Awaiting Payment', quoteAcceptedAt: now, updatedAt: now, payment: { status: 'Pending', gateway: credentials!.gateway ?? 'PhonePe', merchantOrderId, amount, startedAt: now } });
    });
    // Keep uncertain attempts pending: verify with PhonePe before allowing a second charge.
    const response = await createGatewayCheckout(credentials, accessToken, merchantOrderId, amount * 100, returnUrl.toString(), identity.uid);
    const result = await response.json();
    if (!response.ok || typeof result.redirectUrl !== 'string' || (new URL(result.redirectUrl, appUrl.origin).protocol !== 'https:' && !(credentials.gateway === 'Razorpay' && new URL(result.redirectUrl, appUrl.origin).origin === appUrl.origin))) throw new Error('Checkout unavailable');
    await db.collection('customPhonepeAttempts').doc(merchantOrderId).update({ redirectUrl: result.redirectUrl });
    return json({ redirectUrl: result.redirectUrl });
  } catch (error) { return customError(error); }
}
