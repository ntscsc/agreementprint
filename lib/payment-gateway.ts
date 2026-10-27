import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
import Razorpay from 'razorpay';
import type { Firestore } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { ApiInputError } from '@/lib/api-input';
import { getPhonePeCredentials, getPhonePeAccessToken, getPhonePeApiBase, fetchPhonePeOrderStatus } from '@/lib/phonepe';

export type PaymentGateway = 'PhonePe' | 'Razorpay';
type PhonePeCredentials = NonNullable<ReturnType<typeof getPhonePeCredentials>>;
export type GatewayCredentials = PhonePeCredentials & { gateway?: PaymentGateway; keyId?: string; keySecret?: string };

export function parsePaymentGateway(value: unknown): PaymentGateway {
  if (value === undefined || value === 'PhonePe') return 'PhonePe';
  if (value === 'Razorpay') return value;
  throw new ApiInputError('Choose PhonePe or Razorpay.', 400);
}

export function gatewayCredentials(gateway: PaymentGateway): GatewayCredentials | null {
  if (gateway === 'PhonePe') return getPhonePeCredentials();
  const { RAZORPAY_KEY_ID: keyId, RAZORPAY_KEY_SECRET: keySecret } = process.env;
  if (!keyId || !keySecret || !/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId)) return null;
  return { gateway, keyId, keySecret, production: keyId.startsWith('rzp_live_'), clientId: '', clientSecret: '', clientVersion: '' };
}

export async function getCheckoutCredentials(db: Firestore, existingGateway?: unknown) {
  const selected = existingGateway ?? (await db.collection('settings').doc('paymentGateway').get()).data()?.activeGateway;
  return gatewayCredentials(parsePaymentGateway(selected));
}

export async function getGatewayAccessToken(credentials: GatewayCredentials) {
  return credentials.gateway === 'Razorpay' ? '' : getPhonePeAccessToken(credentials);
}

export async function razorpayRequest(path: string, credentials: GatewayCredentials, body?: unknown, extraHeaders: Record<string, string> = {}) {
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString('base64')}`, 'Content-Type': 'application/json', ...extraHeaders },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new ApiInputError('Razorpay could not verify this request. Retry to check the existing payment.', 503);
  return response.json();
}

export function validRazorpaySignature(payload: string, signature: unknown, secret: string) {
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(payload).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

// These destinations belong to this app. Keep the browser's current origin,
// including HTTP localhost and public HTTPS tunnels, when navigating between them.
export function paymentReturnPath(value: string): string {
  const url = new URL(value, 'http://localhost');
  return `${url.pathname}${url.search}${url.hash}`;
}

export async function recoverRazorpayCheckout(merchantOrderId: string, ownerUid: string): Promise<string | null> {
  const record = (await getAdminDb().collection('razorpayCheckouts').doc(merchantOrderId).get()).data();
  if (!record?.razorpayOrderId || record.ownerUid !== ownerUid) return null;
  const url = new URL('/payment/razorpay/checkout', record.returnUrl);
  url.searchParams.set('attempt', merchantOrderId);
  return paymentReturnPath(url.toString());
}

export async function createGatewayCheckout(credentials: GatewayCredentials, accessToken: string, merchantOrderId: string, amount: number, returnUrl: string, ownerUid: string): Promise<Response> {
  if (credentials.gateway !== 'Razorpay') return fetch(`${getPhonePeApiBase(credentials.production)}/checkout/v2/pay`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `O-Bearer ${accessToken}` },
    body: JSON.stringify({ merchantOrderId, amount, expireAfter: 1200, paymentFlow: { type: 'PG_CHECKOUT', merchantUrls: { redirectUrl: returnUrl } } }),
    signal: AbortSignal.timeout(15000),
  });
  if (!Number.isSafeInteger(amount) || amount < 100) throw new ApiInputError('The minimum checkout amount is 100 paise (Rs.1).');
  const db = getAdminDb(), ref = db.collection('razorpayCheckouts').doc(merchantOrderId);
  const receipt = createHash('sha256').update(merchantOrderId).digest('hex').slice(0, 40);
  // Reserve before contacting Razorpay. An ambiguous timeout must never create another payable order.
  const previous = await db.runTransaction(async tx => {
    const saved = (await tx.get(ref)).data();
    if (saved) {
      if (saved.ownerUid !== ownerUid || saved.amount !== amount || saved.returnUrl !== returnUrl || saved.keyId !== credentials.keyId) throw new ApiInputError('The existing checkout needs reconciliation.', 409);
      return saved;
    }
    tx.create(ref, { merchantOrderId, ownerUid, amount, currency: 'INR', returnUrl, keyId: credentials.keyId, receipt, state: 'INITIALIZING', createdAt: new Date().toISOString() });
    return null;
  });
  if (previous && !previous.razorpayOrderId) throw new ApiInputError('This checkout is still being verified. Contact support if it does not resolve; no second payment has been created.', 409);
  if (!previous) {
    const client = new Razorpay({ key_id: credentials.keyId!, key_secret: credentials.keySecret! });
    let result;
    try {
      result = await client.orders.create({ amount, currency: 'INR', receipt, partial_payment: false });
    } catch (error) {
      // Do not expose SDK error objects: they may contain request credentials.
      const status = (error as { statusCode?: number })?.statusCode;
      throw new ApiInputError(status === 401 ? 'Razorpay authentication failed. Check the server credentials.' : 'Razorpay could not create the order. Check the existing payment before retrying.', status === 401 ? 401 : 500);
    }
    if (typeof result.id !== 'string' || !/^order_[A-Za-z0-9]+$/.test(result.id) || result.amount !== amount || result.currency !== 'INR' || result.receipt !== receipt) throw new Error('Invalid Razorpay order response.');
    await db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data();
      if (!current || current.razorpayOrderId) throw new Error('Checkout association changed.');
      tx.update(ref, { razorpayOrderId: result.id, state: 'PENDING' });
      tx.create(db.collection('razorpayOrderReferences').doc(result.id), { merchantOrderId });
    });
  }
  const url = new URL('/payment/razorpay/checkout', returnUrl);
  url.searchParams.set('attempt', merchantOrderId);
  const saved = (await ref.get()).data()!;
  return new Response(JSON.stringify({ redirectUrl: paymentReturnPath(url.toString()), order_id: saved.razorpayOrderId, amount: saved.amount, currency: saved.currency }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function fetchGatewayOrderStatus(credentials: GatewayCredentials, accessToken: string, merchantOrderId: string, checkRetry = false): Promise<{ state?: string; amount?: number; expireAt?: number; retrySafe?: boolean; paymentDetails?: Array<{ state?: string; transactionId?: string }> }> {
  if (credentials.gateway !== 'Razorpay') return fetchPhonePeOrderStatus(credentials, accessToken, merchantOrderId);
  const record = (await getAdminDb().collection('razorpayCheckouts').doc(merchantOrderId).get()).data();
  if (!record?.razorpayOrderId || record.keyId !== credentials.keyId) throw new ApiInputError('The existing Razorpay checkout needs verification. No new charge was started.', 409);
  const order = await razorpayRequest(`orders/${encodeURIComponent(record.razorpayOrderId)}`, credentials);
  if (order.id !== record.razorpayOrderId || order.amount !== record.amount || order.currency !== 'INR' || order.receipt !== record.receipt) throw new Error('Razorpay order mismatch.');
  if (order.status !== 'paid') {
    if (!checkRetry) return { state: 'PENDING', amount: record.amount };
    const payments = await razorpayRequest(`orders/${encodeURIComponent(record.razorpayOrderId)}/payments`, credentials);
    // Retry only with a complete set of failed attempts, or an untouched order.
    // Authorised, created or unknown payment attempts must remain locked.
    const items = payments.items;
    const retrySafe = Array.isArray(items) && order.amount_paid === 0 && order.amount_due === record.amount && Number.isSafeInteger(order.attempts) && order.attempts === items.length
      && (items.length > 0 || order.status === 'created')
      && items.every((p: { order_id?: string; status?: string; amount?: number; currency?: string }) => p.order_id === record.razorpayOrderId && p.status === 'failed' && p.amount === record.amount && p.currency === 'INR');
    return { state: 'PENDING', amount: record.amount, retrySafe };
  }
  const payments = await razorpayRequest(`orders/${encodeURIComponent(record.razorpayOrderId)}/payments`, credentials);
  const captured = payments.items?.find((payment: { order_id: string; currency: string; amount: number; status: string; captured: boolean }) => payment.order_id === record.razorpayOrderId && payment.currency === 'INR' && payment.amount === record.amount && payment.status === 'captured' && payment.captured === true);
  if (!captured || order.amount_paid !== record.amount || order.amount_due !== 0) throw new Error('Razorpay capture is not confirmed.');
  return { state: 'COMPLETED', amount: record.amount, paymentDetails: [{ state: 'COMPLETED', transactionId: captured.id }] };
}
