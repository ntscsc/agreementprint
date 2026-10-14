import { validateAgreement } from '@/lib/agreement-validation';
import { readJsonObject, inputErrorStatus, validDocumentId } from '@/lib/api-input';
import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { calculateOrderPrice, resolvePricingConfig } from '@/src/config/pricing';
import { getAdminDb, verifyFirebaseIdToken } from '@/lib/firebase-admin';
import { fetchPhonePeOrderStatus, getPhonePeAccessToken, getPhonePeApiBase, getPhonePeCredentials } from '@/lib/phonepe';
import { confirmPaidOrderAndGrantReferral, releaseReferralReservation, reserveReferralCreditForOrder } from '@/lib/referral-admin';
import { isTrustedPaymentAttempt } from '@/lib/payment-attempt';
import { acquireCheckoutLock, assertCheckoutLock, releaseCheckoutLock } from '@/lib/checkout-lock';
import { checkoutDetailsChanged, selectCheckoutDetails } from '@/lib/order-checkout-details';

export async function POST(req: NextRequest) {
  let lock: { orderId: string; token: string } | undefined;
  try {
    const idToken = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!idToken) return NextResponse.json({ error: 'Sign in is required to pay.' }, { status: 401 });
    const decoded = await verifyFirebaseIdToken(idToken);
    const body = await readJsonObject(req);
    const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';
    if (!validDocumentId(orderId)) return NextResponse.json({ error: 'A valid order reference is required.' }, { status: 400 });
    let appUrl: URL;
    try {
      appUrl = new URL((process.env.NODE_ENV === 'production' ? process.env.APP_URL?.trim() : undefined) || req.nextUrl.origin);
      if (!['http:', 'https:'].includes(appUrl.protocol) || appUrl.username || appUrl.password) throw new Error();
      if (['0.0.0.0', '[::]', '::'].includes(appUrl.hostname)) {
        if (process.env.NODE_ENV === 'production') throw new Error();
        appUrl.hostname = 'localhost';
      }
    } catch {
      return NextResponse.json({ error: 'Configure APP_URL with the public application URL.' }, { status: 503 });
    }
    const db = getAdminDb();
    const orderRef = db.collection('orders').doc(orderId);
    const snapshot = await orderRef.get();
    if (!snapshot.exists) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    let order = snapshot.data()!;
    if (order.ownerUid !== decoded.uid) return NextResponse.json({ error: 'Order access denied.' }, { status: 403 });
    if (order.payment?.status === 'Paid') return NextResponse.json({ error: 'This order is already paid.' }, { status: 409 });
    try { lock = { orderId, token: await acquireCheckoutLock(db, orderId, decoded.uid) }; }
    catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 409 }); }
    // Read again under the distributed lock, rather than using the pre-lock snapshot.
    order = (await orderRef.get()).data()!;
    if (order.payment?.gateway === 'ReferralCredit' && order.payment?.reservationKey && order.payment?.status === 'Pending') {
      validateAgreement(order);
      await confirmPaidOrderAndGrantReferral(orderId, { reservationKey: order.payment.reservationKey, paymentUpdates: {
        'payment.referralCreditApplied': order.payment.referralCreditApplied,
        'payment.amount': 0,
      } });
      return NextResponse.json({ available: true, paid: true, order: (await orderRef.get()).data() });
    }
    const previousMerchantOrderId = order.payment?.phonepeMerchantOrderId;
    const previousSnap = typeof previousMerchantOrderId === 'string' && /^[A-Za-z0-9_-]+$/.test(previousMerchantOrderId)
      ? await db.collection('phonepePaymentAttempts').doc(previousMerchantOrderId).get() : null;
    const previousData = previousSnap?.data();
    const previousAttempt = isTrustedPaymentAttempt(previousData, orderId, decoded.uid, previousMerchantOrderId) ? previousData : null;
    if (previousMerchantOrderId && !previousAttempt) {
      return NextResponse.json({ error: 'This older payment attempt needs vendor verification before another checkout can start. Please contact support.' }, { status: 409 });
    }
    validateAgreement({ ...order, ...selectCheckoutDetails(body.orderDetails ?? {}) });
    const requested = body?.creditAmount ?? previousAttempt?.creditApplied ?? 0;
    if (!Number.isSafeInteger(requested) || requested < 0) return NextResponse.json({ error: 'Referral credit must be a non-negative whole number.' }, { status: 400 });
    let details: Record<string, unknown> = {};
    if (body?.orderDetails !== undefined) {
      if (!body.orderDetails || typeof body.orderDetails !== 'object' || Array.isArray(body.orderDetails)) return NextResponse.json({ error: 'Invalid order details.' }, { status: 400 });
      details = selectCheckoutDetails(body.orderDetails);
      for (const key of ['ownerDetails', 'tenantDetails', 'propertyDetails', 'agreementTerms', 'proofUploads']) {
        if (!details[key] || typeof details[key] !== 'object' || Array.isArray(details[key])) return NextResponse.json({ error: 'Complete order details are required.' }, { status: 400 });
      }
    }
    const credentials = getPhonePeCredentials();
    if (previousAttempt && !['FAILED', 'EXPIRED'].includes(String(previousData?.state))) {
      if (!credentials) return NextResponse.json({ error: 'Payment verification is unavailable. Please retry later.' }, { status: 503 });
      // Never replace a payable attempt merely because the local timer elapsed.
      const accessToken = await getPhonePeAccessToken(credentials);
      const status = await fetchPhonePeOrderStatus(credentials, accessToken, previousMerchantOrderId);
      if (status.state === 'COMPLETED') {
        if (status.amount !== Math.round(previousAttempt.amount * 100)) throw new Error('Payment amount mismatch.');
        await confirmPaidOrderAndGrantReferral(orderId, { merchantOrderId: previousMerchantOrderId, transactionId: status.paymentDetails?.find((p) => p.state === 'COMPLETED')?.transactionId });
        return NextResponse.json({ available: true, paid: true, order: (await orderRef.get()).data() });
      }
      if (status.state === 'FAILED' || status.state === 'EXPIRED') {
        await releaseReferralReservation(orderId, previousMerchantOrderId, status.state);
      } else {
        if (checkoutDetailsChanged(order, details) || requested !== previousAttempt.creditApplied) {
          return NextResponse.json({ error: 'The existing checkout is still pending. Finish it or wait for confirmed expiry before changing the order or credits.' }, { status: 409 });
        }
        if (body.reviewedTotal !== previousAttempt.amount + previousAttempt.creditApplied) return NextResponse.json({ error: 'Review the payable total before continuing.', quoteRequired: true, reviewedTotal: previousAttempt.amount + previousAttempt.creditApplied, creditApplied: previousAttempt.creditApplied, amountDue: previousAttempt.amount }, { status: 409 });
        if (!previousAttempt.redirectUrl) return NextResponse.json({ error: 'Checkout is being verified. Please retry shortly; another charge has not been started.' }, { status: 409 });
        return NextResponse.json({ available: true, redirectUrl: previousAttempt.redirectUrl, merchantOrderId: previousMerchantOrderId, initiatedAt: previousAttempt.initiatedAt, creditApplied: previousAttempt.creditApplied, amountDue: previousAttempt.amount });
      }
    }
    const pricingData = (await db.collection('settings').doc('pricing').get()).data() ?? {};
    let pricing;
    try { pricing = resolvePricingConfig(pricingData); }
    catch { return NextResponse.json({ error: 'The pricing configuration is invalid. Contact support.' }, { status: 503 }); }
    const terms = (details.agreementTerms ?? order.agreementTerms ?? {}) as Record<string, unknown>;
    const price = calculateOrderPrice(pricing, terms.stampPaperDenomination === 200 ? 200 : 100, terms.deliveryLocation === 'Within Tamil Nadu' ? 'Within Tamil Nadu' : 'Within Chennai', Boolean(terms.includeNotary));
    if (!Number.isSafeInteger(price.totalPayable) || price.totalPayable <= 0) return NextResponse.json({ error: 'The pricing configuration is invalid. Contact support.' }, { status: 503 });
    if (requested > price.totalPayable) return NextResponse.json({ error: 'Referral credit cannot exceed the order total.' }, { status: 409 });
    if (body.reviewedTotal !== price.totalPayable) return NextResponse.json({ error: 'Review the payable total before continuing.', quoteRequired: true, reviewedTotal: price.totalPayable, creditApplied: requested, amountDue: price.totalPayable - requested }, { status: 409 });
    // Save validated details only after the customer has reviewed this exact amount.
    if (Object.keys(details).length) {
      await db.runTransaction(async (tx) => {
        const current = await tx.get(orderRef);
        await assertCheckoutLock(db, tx, orderId, lock!.token);
        if (current.data()?.payment?.status === 'Paid') throw new Error('This order is already paid.');
        tx.update(orderRef, { ...details, updatedAt: new Date().toISOString() });
      });
      order = { ...order, ...details };
    }
    const amountDue = price.totalPayable - requested;
    if (amountDue > 0 && !credentials) return NextResponse.json({ available: false, error: 'Online payment is not configured. Your order is saved.' }, { status: 503 });
    const merchantOrderId = `TN${randomUUID().replace(/-/g, '')}`;
    const initiatedAt = Date.now();
    const returnUrl = new URL('/payment/phonepe/return', appUrl.origin);
    returnUrl.searchParams.set('orderId', orderId);
    returnUrl.searchParams.set('paymentStartedAt', String(initiatedAt));
    returnUrl.searchParams.set('merchantOrderId', merchantOrderId);
    // Reserve credit and persist the gateway association BEFORE the outbound request.
    // A timeout/crash leaves the same attempt recoverable, never a second payable ID.
    try {
      await reserveReferralCreditForOrder(orderId, decoded.uid, requested, {
        merchantOrderId, lockToken: lock.token, totalBeforeCredits: price.totalPayable,
        paymentAttempt: amountDue > 0 ? { orderId, ownerUid: decoded.uid, merchantOrderId, amount: amountDue, creditApplied: requested, initiatedAt, redirectUrl: '', returnUrl: returnUrl.toString(), state: 'INITIALIZING', totalBeforeCredits: price.totalPayable } : undefined,
      });
    } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 409 }); }
    if (amountDue === 0) {
      await confirmPaidOrderAndGrantReferral(orderId, { reservationKey: merchantOrderId, paymentUpdates: { 'payment.gateway': 'ReferralCredit', 'payment.amount': 0, 'payment.totalBeforeCredits': price.totalPayable, 'payment.referralCreditApplied': requested } });
      return NextResponse.json({ available: true, paid: true, order: (await orderRef.get()).data(), creditApplied: requested, amountDue: 0 });
    }
    const accessToken = await getPhonePeAccessToken(credentials!);
    const response = await fetch(`${getPhonePeApiBase(credentials!.production)}/checkout/v2/pay`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `O-Bearer ${accessToken}` },
      body: JSON.stringify({ merchantOrderId, amount: Math.round(amountDue * 100), expireAfter: 1200, metaInfo: { udf1: orderId }, paymentFlow: { type: 'PG_CHECKOUT', merchantUrls: { redirectUrl: returnUrl.toString() } } }),
      signal: AbortSignal.timeout(15_000),
    });
    // Even an error response can be ambiguous: retain the attempt and verify its status.
    const data = await response.json();
    const checkoutUrl = typeof data.redirectUrl === 'string' ? data.redirectUrl : data.redirect_url;
    if (!response.ok || typeof checkoutUrl !== 'string' || !checkoutUrl) return NextResponse.json({ error: 'Checkout needs status verification. Retry shortly.' }, { status: 502 });
    await db.runTransaction(async (tx) => {
      const current = await tx.get(orderRef);
      const attemptRef = db.collection('phonepePaymentAttempts').doc(merchantOrderId);
      const currentAttempt = await tx.get(attemptRef);
      await assertCheckoutLock(db, tx, orderId, lock!.token);
      // Webhooks may settle the attempt before the checkout response arrives.
      if (['COMPLETED', 'FAILED', 'EXPIRED'].includes(currentAttempt.data()?.state)) return;
      tx.update(attemptRef, { redirectUrl: checkoutUrl, state: 'PENDING' });
      if (current.data()?.payment?.status !== 'Paid' && current.data()?.payment?.phonepeMerchantOrderId === merchantOrderId) tx.update(orderRef, { 'payment.phonepeRedirectUrl': checkoutUrl });
    });
    const latest = (await orderRef.get()).data()!;
    if (latest.payment?.status === 'Paid') return NextResponse.json({ available: true, paid: true, order: latest });
    if (latest.payment?.status === 'Failed') return NextResponse.json({ error: 'Checkout failed. Please retry.' }, { status: 409 });
    return NextResponse.json({ available: true, redirectUrl: checkoutUrl, merchantOrderId, initiatedAt, creditApplied: requested, amountDue });
  } catch (error) {
    const status = inputErrorStatus(error);
    if (status) return NextResponse.json({ error: status === 401 ? 'Sign in again to continue.' : (error as Error).message }, { status });
    console.error('PhonePe checkout initialization error:', error);
    return NextResponse.json({ error: 'Unable to initialize checkout. Retry to verify the existing attempt.' }, { status: 500 });
  } finally {
    if (lock) await releaseCheckoutLock(getAdminDb(), lock.orderId, lock.token).catch((error) => console.error('Checkout lock release failed:', error));
  }
}
