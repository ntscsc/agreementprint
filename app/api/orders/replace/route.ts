import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, verifyFirebaseIdToken } from '@/lib/firebase-admin';
import { ApiInputError, inputErrorStatus, readJsonObject, validDocumentId } from '@/lib/api-input';
import { validateAgreement } from '@/lib/agreement-validation';
import { preparationHasStarted, replacementQuote, settleReplacement } from '@/lib/order-replacement';
import { resolvePricingConfig } from '@/src/config/pricing';
import { checkoutDetailsChanged } from '@/lib/order-checkout-details';
import { fetchPhonePeOrderStatus, getPhonePeAccessToken, getPhonePeApiBase, getPhonePeCredentials } from '@/lib/phonepe';

export const runtime = 'nodejs';
const json = (data: unknown) => NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
function returnUrl(request: NextRequest) {
  const url = new URL(process.env.NODE_ENV === 'production' ? process.env.APP_URL?.trim() || '' : 'http://localhost:3000');
  if ((process.env.NODE_ENV === 'production' && (url.protocol !== 'https:' || ['localhost', '0.0.0.0', '127.0.0.1', '[::]', '[::1]'].includes(url.hostname))) || url.username || url.password) throw new ApiInputError('Online payment is temporarily unavailable.', 503);
  return new URL('/my-orders', url.origin);
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new ApiInputError('Sign in to manage your order.', 401);
    const user = await verifyFirebaseIdToken(token), body = await readJsonObject(req), db = getAdminDb();
    if (!validDocumentId(body.orderId)) throw new ApiInputError('Invalid order reference.');
    const originalRef = db.collection('orders').doc(body.orderId);
    let requestId: string;
    if (['resume', 'status'].includes(body.action)) {
      const original = (await originalRef.get()).data();
      if (!original || original.ownerUid !== user.uid) throw new ApiInputError('Order not found.', 404);
      requestId = original.replacementPendingId || body.requestId;
    } else {
      if (!['preview', 'submit'].includes(body.action)) throw new ApiInputError('Invalid replacement action.');
      if (!/^[a-f0-9]{32}$/.test(body.requestKey || '')) throw new ApiInputError('Invalid replacement reference.');
      requestId = `REPLPAY${body.requestKey}`;
      const prepared = await db.runTransaction(async tx => {
        const original = (await tx.get(originalRef)).data();
        if (!original || original.ownerUid !== user.uid) throw new ApiInputError('Order not found.', 404);
        const existing = (await tx.get(db.collection('orderReplacements').doc(requestId))).data();
        if (existing) {
          if (existing.ownerUid !== user.uid || existing.originalOrderId !== body.orderId) throw new ApiInputError('Replacement reference is unavailable.', 409);
          if (body.action === 'preview' || checkoutDetailsChanged(existing.details, Object.fromEntries(['ownerDetails', 'tenantDetails', 'propertyDetails', 'agreementTerms'].map(key => [key, body[key]])))) throw new ApiInputError('A replacement has already been submitted. Close this form and resume it from My Orders.', 409);
          return existing;
        }
        if (original.payment?.status !== 'Paid' || original.replacedByOrderId || original.status === 'Cancelled') throw new ApiInputError('This order is not eligible for replacement.', 409);
        if (original.replacementPendingId) throw new ApiInputError('A replacement is already pending. Resume it from My Orders.', 409);
        if (original.modificationReviewId) throw new ApiInputError('Your changes are already awaiting admin review.', 409);
        const reviewRequired = await preparationHasStarted(tx, body.orderId, original);
        if (!reviewRequired && !['Submitted', 'Under verification', 'Documents needed'].includes(original.status)) throw new ApiInputError('This order is not ready for modification.', 409);
        if (!reviewRequired && body.updatedAt !== original.updatedAt) throw new ApiInputError('Your order has changed. Reopen the form before continuing.', 409);
        const details = Object.fromEntries(['ownerDetails', 'tenantDetails', 'propertyDetails', 'agreementTerms'].map(key => [key, body[key]]));
        validateAgreement(details);
        const pricing = resolvePricingConfig((await tx.get(db.collection('settings').doc('pricing'))).data() || {});
        const quote = replacementQuote(original, body.agreementTerms, pricing);
        if (quote.total < quote.alreadyPaid) throw new ApiInputError('Lower-value replacements are not allowed. Before drafting begins, cancel this order for a refund to the original payment method, then place a new order. After drafting, contact the admin team.', 409);
        if (body.action === 'preview') return { quote, reviewRequired };
        if (reviewRequired && body.acceptAdminReview !== true) return { quote, reviewRequired };
        if (body.reviewedTotal !== quote.total) throw new ApiInputError('The price has changed. Review the updated total before continuing.', 409);
        if (!reviewRequired && quote.due > 0) {
          if (!getPhonePeCredentials()) throw new ApiInputError('Online payment is temporarily unavailable.', 503);
          returnUrl(req);
        }
        const now = new Date().toISOString();
        const record = { requestId, originalOrderId: body.orderId, ownerUid: user.uid,
          replacementOrderId: `REPLACE_${randomUUID().replaceAll('-', '')}`, details, quote,
          surplusChoice: 'none',
          state: reviewRequired ? 'Review required' : quote.due > 0 ? 'Awaiting payment' : 'Ready', createdAt: now, updatedAt: now };
        tx.create(db.collection('orderReplacements').doc(requestId), record);
        tx.update(originalRef, { ...(reviewRequired ? { modificationReviewId: requestId, preparationStartedAt: original.preparationStartedAt || now } : { replacementPendingId: requestId }), updatedAt: now });
        return record;
      });
      if (body.action === 'preview') return json(prepared);
      if (prepared.state === 'Review required') return json({ reviewRequired: true });
      if ('reviewRequired' in prepared && prepared.reviewRequired) return json(prepared);
    }
    if (!/^REPLPAY[a-f0-9]{32}$/.test(requestId || '')) throw new ApiInputError('No replacement is pending.', 404);
    const requestRef = db.collection('orderReplacements').doc(requestId), record = (await requestRef.get()).data();
    if (!record || record.ownerUid !== user.uid || record.originalOrderId !== body.orderId) throw new ApiInputError('Replacement not found.', 404);
    if (record.state === 'Completed') return json({ completed: true, original: (await originalRef.get()).data(), order: (await db.collection('orders').doc(record.replacementOrderId).get()).data() });
    if (record.state === 'Failed') return json({ failed: true, message: 'Payment failed or expired. Your original order is unchanged; start a new replacement.' });
    if (record.state === 'Ready') {
      await settleReplacement(requestId, 'COMPLETED', 0);
      return json({ completed: true, original: (await originalRef.get()).data(), order: (await db.collection('orders').doc(record.replacementOrderId).get()).data() });
    }
    if (record.state !== 'Awaiting payment') throw new ApiInputError('This replacement requires administrator review.', 409);
    const credentials = getPhonePeCredentials();
    if (!credentials) throw new ApiInputError('Online payment is temporarily unavailable.', 503);
    const accessToken = await getPhonePeAccessToken(credentials);
    if (record.checkoutStartedAt) {
      try {
        const status = await fetchPhonePeOrderStatus(credentials, accessToken, requestId);
        const settled = await settleReplacement(requestId, status.state || 'PENDING', status.amount, status.paymentDetails?.find(payment => payment.state === 'COMPLETED')?.transactionId);
        if (settled.completed) return json({ completed: true, original: (await originalRef.get()).data(), order: (await db.collection('orders').doc(record.replacementOrderId).get()).data() });
        if (['FAILED', 'EXPIRED'].includes(status.state || '')) return json({ failed: true, message: 'Payment failed or expired. Start a new replacement from your original order.' });
        if (body.action === 'status') return json({ pending: true });
        if (record.redirectUrl) return json({ redirectUrl: record.redirectUrl });
      } catch (error) {
        if ((error as { status?: number }).status !== 404) throw error;
        // An absent gateway order can be retried using the SAME merchant reference.
      }
    }
    if (body.action === 'status') return json({ pending: true });
    await db.runTransaction(async tx => {
      const latest = (await tx.get(requestRef)).data()!;
      if (latest.checkoutLeaseUntil > Date.now()) throw new ApiInputError('Checkout is opening. Please wait and check its status.', 409);
      if (latest.state !== 'Awaiting payment') throw new ApiInputError('Payment status changed. Please refresh.', 409);
      tx.update(requestRef, { checkoutStartedAt: latest.checkoutStartedAt || Date.now(), checkoutLeaseUntil: Date.now() + 30000 });
    });
    const url = returnUrl(req); url.searchParams.set('replacement', requestId); url.searchParams.set('orderId', body.orderId);
    const response = await fetch(`${getPhonePeApiBase(credentials.production)}/checkout/v2/pay`, {
      method: 'POST', headers: { Authorization: `O-Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantOrderId: requestId, amount: record.quote.due * 100, expireAfter: 1200, paymentFlow: { type: 'PG_CHECKOUT', merchantUrls: { redirectUrl: url.toString() } } }), signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (!response.ok || typeof result.redirectUrl !== 'string' || new URL(result.redirectUrl).protocol !== 'https:') throw new ApiInputError('Checkout could not open. Resume this replacement to check payment before retrying.', 503);
    await requestRef.update({ redirectUrl: result.redirectUrl, returnUrl: url.toString(), checkoutLeaseUntil: 0 });
    return json({ redirectUrl: result.redirectUrl });
  } catch (error) {
    const status = inputErrorStatus(error) ?? 500;
    if (status === 500) console.error('Order replacement failed:', error);
    return NextResponse.json({ error: status === 401 ? 'Sign in again to continue.' : status === 500 ? 'Unable to complete the replacement. Resume it from My Orders before trying again.' : (error as Error).message }, { status });
  }
}
