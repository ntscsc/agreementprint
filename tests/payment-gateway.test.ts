import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url), ts = require('typescript');
type Data = Record<string, any>;
const env = { RAZORPAY_KEY_ID: 'rzp_test_Example123', RAZORPAY_KEY_SECRET: 'test-secret', RAZORPAY_WEBHOOK_SECRET: 'webhook-secret' };

function harness(seed: Data = {}, options: Data = {}) {
  let records = structuredClone(seed), queue = Promise.resolve(), sequence = 0;
  const snapshot = (path: string, source = records) => ({ exists: path in source, id: path.split('/').at(-1), data: () => structuredClone(source[path]) });
  const querySnapshot = (query: Data, source: Data) => ({ docs: Object.keys(source).filter(path => path.startsWith(`${query.collection}/`) && source[path][query.field] === query.value).map(path => snapshot(path, source)) });
  const db = {
    collection: (collection: string) => ({ where: (field: string, _operator: string, value: unknown) => ({ collection, field, value }), doc: (id = `auto${++sequence}`) => ({ path: `${collection}/${id}`, get: async () => snapshot(`${collection}/${id}`), update: async (value: Data) => { records[`${collection}/${id}`] = { ...records[`${collection}/${id}`], ...structuredClone(value) }; } }) }),
    runTransaction: (callback: (tx: Data) => Promise<unknown>) => {
      const result = queue.then(async () => {
        const draft = structuredClone(records); let written = false;
        const tx = {
          get: async (ref: Data) => { assert.equal(written, false, 'Reads precede writes'); return ref.collection ? querySnapshot(ref, draft) : snapshot(ref.path, draft); },
          create: (ref: Data, value: Data) => { assert.equal(ref.path in draft, false); written = true; draft[ref.path] = structuredClone(value); },
          set: (ref: Data, value: Data) => { written = true; draft[ref.path] = structuredClone(value); },
          update: (ref: Data, value: Data) => {
            assert.ok(ref.path in draft); written = true;
            for (const [key, item] of Object.entries(value)) {
              const parts = key.split('.'); let target = draft[ref.path];
              for (const part of parts.slice(0, -1)) target = target[part] ??= {};
              target[parts.at(-1)!] = structuredClone(item);
            }
          },
        };
        const result = await callback(tx); records = draft; return result;
      }); queue = result.then(() => undefined, () => undefined); return result;
    },
  };
  const cache: Data = {}, calls: Data[] = [];
  function load(name: string): any {
    if (options.modules?.[name]) return options.modules[name];
    if (name === 'next/server') return { NextResponse: { json: (value: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(value), { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } }) } };
    if (name === '@/lib/firebase-admin') return { getAdminDb: () => db, verifyFirebaseIdToken: async (token: string) => ({ uid: token, email: token === 'admin' ? 'pradeep1992official@gmail.com' : 'customer@example.test', email_verified: true }) };
    if (name === '@/lib/phonepe') return { getPhonePeCredentials: () => ({ production: true }), getPhonePeAccessToken: async () => 'phonepe-token', getPhonePeApiBase: () => 'https://phonepe.example', fetchPhonePeOrderStatus: async () => ({ state: 'PENDING', amount: 35000 }), phonePeRefundRequest: async () => ({ state: 'PENDING' }) };
    if (name === 'razorpay') return { default: class {
      orders = { create: async (body: unknown) => {
        const url = 'https://api.razorpay.com/v1/orders', init = { method: 'POST', body: JSON.stringify(body) };
        calls.push({ url, ...init });
        if (!options.fetch) throw new Error('Unexpected SDK request');
        return (await options.fetch(url, init)).json();
      } };
    } };
    if (!name.startsWith('@/')) return require(name);
    if (name.endsWith('.json')) return { default: JSON.parse(readFileSync(new URL(`../${name.slice(2)}`, import.meta.url), 'utf8')) };
    if (cache[name]) return cache[name];
    const source = readFileSync(new URL(`../${name.slice(2)}.ts`, import.meta.url), 'utf8');
    const module = { exports: {} };
    runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
      module, exports: module.exports, require: load, process: { env: { ...env, ...options.env } }, Buffer, Uint8Array, TextDecoder, URL, Date, console, AbortSignal, Response,
      fetch: async (url: string, init: Data) => { calls.push({ url, ...init }); if (options.fetch) return options.fetch(url, init); throw new Error('Unexpected network request'); },
    });
    return cache[name] = module.exports;
  }
  return { load, db, calls, read: (path: string) => records[path] };
}
const request = (body?: unknown, token = 'admin') => new Request('https://example.test/api', { method: body ? 'POST' : 'GET', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
const checkout = { merchantOrderId: 'TN123', ownerUid: 'customer', amount: 35000, currency: 'INR', returnUrl: 'https://example.test/payment/phonepe/return?orderId=O1', keyId: env.RAZORPAY_KEY_ID, receipt: 'receipt123', razorpayOrderId: 'order_123', state: 'PENDING' };

test('gateway selection defaults to PhonePe, rejects invalid settings, and pins existing checkouts', async () => {
  const h = harness({ 'settings/paymentGateway': { activeGateway: 'Razorpay' } }), gateway = h.load('@/lib/payment-gateway');
  assert.equal((await gateway.getCheckoutCredentials(h.db)).gateway, 'Razorpay');
  assert.equal((await gateway.getCheckoutCredentials(h.db, 'PhonePe')).gateway, undefined);
  assert.equal(gateway.parsePaymentGateway(undefined), 'PhonePe');
  assert.throws(() => gateway.parsePaymentGateway('Unknown'), /Choose PhonePe or Razorpay/);
  const missing = harness({}, { env: { RAZORPAY_KEY_SECRET: '' } }).load('@/lib/payment-gateway');
  assert.equal(missing.gatewayCredentials('Razorpay'), null);
});

test('admin selection requires verified administrator access and configured credentials', async () => {
  const h = harness(), route = h.load('@/app/api/admin/payment-gateway/route');
  assert.equal((await route.GET(request(undefined, ''))).status, 401);
  assert.equal((await route.GET(request(undefined, 'customer'))).status, 403);
  assert.equal((await route.POST(request({ activeGateway: 'Bad', previousGateway: 'PhonePe' }))).status, 400);
  assert.equal((await route.POST(request({ previousGateway: 'PhonePe' }))).status, 400);
  const missing = harness({}, { env: { RAZORPAY_KEY_SECRET: '' } }).load('@/app/api/admin/payment-gateway/route');
  assert.equal((await missing.POST(request({ activeGateway: 'Razorpay', previousGateway: 'PhonePe' }))).status, 409);
  assert.equal(h.read('settings/paymentGateway'), undefined);
  const responses = await Promise.all([route.POST(request({ activeGateway: 'Razorpay', previousGateway: 'PhonePe' })), route.POST(request({ activeGateway: 'Razorpay', previousGateway: 'PhonePe' }))]);
  assert.deepEqual(responses.map(result => result.status).sort(), [200, 409]);
  const publicSettings = await (await route.GET(request())).json();
  assert.equal(publicSettings.activeGateway, 'Razorpay');
  assert.equal(JSON.stringify(publicSettings).includes(env.RAZORPAY_KEY_SECRET), false);
});

test('Razorpay order creation is reserved before the API call and concurrent requests create only one order', async () => {
  const h = harness({}, { fetch: async (_url: string, init: Data) => { const body = JSON.parse(init.body); assert.equal(h.read('razorpayCheckouts/TN123').state, 'INITIALIZING'); return json({ id: 'order_123', ...body }); } });
  const gateway = h.load('@/lib/payment-gateway'), credentials = gateway.gatewayCredentials('Razorpay');
  const start = () => gateway.createGatewayCheckout(credentials, '', 'TN123', 35000, checkout.returnUrl, 'customer');
  const results = await Promise.allSettled([start(), start()]);
  assert.ok(results.some(result => result.status === 'fulfilled'));
  assert.equal(h.calls.length, 1);
  assert.equal(h.read('razorpayOrderReferences/order_123').merchantOrderId, 'TN123');
  const response = await start();
  assert.match((await response.json()).redirectUrl, /\/payment\/razorpay\/checkout\?attempt=TN123/);
  assert.equal(h.calls.length, 1);
  await assert.rejects(gateway.createGatewayCheckout(credentials, '', 'TN123', 36000, checkout.returnUrl, 'customer'), /reconciliation/);
});

test('ambiguous order creation cannot start another payable Razorpay order', async () => {
  const h = harness({}, { fetch: async () => { throw new Error('Simulated timeout'); } }), gateway = h.load('@/lib/payment-gateway');
  const start = () => gateway.createGatewayCheckout(gateway.gatewayCredentials('Razorpay'), '', 'TN123', 35000, checkout.returnUrl, 'customer');
  await assert.rejects(start(), /could not create the order/);
  await assert.rejects(start(), /still being verified/);
  assert.equal(h.calls.length, 1);
});

test('signature validation rejects altered payloads, missing values and malformed signatures', () => {
  const gateway = harness().load('@/lib/payment-gateway');
  const payload = 'order_123|pay_123', signature = createHmac('sha256', env.RAZORPAY_KEY_SECRET).update(payload).digest('hex');
  assert.equal(gateway.validRazorpaySignature(payload, signature, env.RAZORPAY_KEY_SECRET), true);
  for (const value of [null, '', 'xyz', signature.slice(1), '0'.repeat(64)]) assert.equal(gateway.validRazorpaySignature(payload, value, env.RAZORPAY_KEY_SECRET), false);
  assert.equal(gateway.validRazorpaySignature('order_999|pay_123', signature, env.RAZORPAY_KEY_SECRET), false);
});

test('verification requires the exact INR order and a full captured payment', async () => {
  const correctOrder = { id: 'order_123', amount: 35000, currency: 'INR', receipt: 'receipt123', status: 'paid', amount_paid: 35000, amount_due: 0 };
  const payment = { id: 'pay_123', order_id: 'order_123', amount: 35000, currency: 'INR', status: 'captured', captured: true };
  for (const changes of [{}, { amount: 1 }, { currency: 'USD' }, { order_id: 'order_other' }, { status: 'authorized', captured: false }]) {
    const h = harness({ 'razorpayCheckouts/TN123': checkout }, { fetch: async (url: string) => json(url.endsWith('/payments') ? { items: [{ ...payment, ...changes }] } : correctOrder) });
    const gateway = h.load('@/lib/payment-gateway');
    const result = gateway.fetchGatewayOrderStatus(gateway.gatewayCredentials('Razorpay'), '', 'TN123');
    if (Object.keys(changes).length) await assert.rejects(result, /capture is not confirmed/);
    else { assert.equal((await result).state, 'COMPLETED'); }
  }
  const pending = harness({ 'razorpayCheckouts/TN123': checkout }, { fetch: async () => json({ ...correctOrder, status: 'attempted' }) });
  const gateway = pending.load('@/lib/payment-gateway');
  assert.equal((await gateway.fetchGatewayOrderStatus(gateway.gatewayCredentials('Razorpay'), '', 'TN123')).state, 'PENDING');
});

test('checkout options and callbacks are owner-only and reject forged signatures before settlement', async () => {
  const h = harness({ 'razorpayCheckouts/TN123': checkout }), route = h.load('@/app/api/payment/razorpay/checkout/route');
  assert.equal((await route.POST(request({ action: 'options', attempt: 'TN123' }, 'other'))).status, 404);
  const response = await route.POST(request({ action: 'options', attempt: 'TN123' }, 'customer'));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).key, env.RAZORPAY_KEY_ID);
  assert.equal((await route.POST(request({ action: 'verify', attempt: 'TN123', razorpay_order_id: 'order_123', razorpay_payment_id: 'pay_123', razorpay_signature: '0'.repeat(64) }, 'customer'))).status, 400);
  assert.equal(h.calls.length, 0);
});

test('webhooks authenticate the exact body, ignore failures, and retry unknown payment references', async () => {
  let settled = 0;
  const h = harness({ 'razorpayOrderReferences/order_123': { merchantOrderId: 'TN123' } }, { modules: { '@/lib/gateway-settlement': { settleRazorpayCheckout: async () => { settled++; } } } });
  const route = h.load('@/app/api/payment/razorpay/webhook/route');
  const send = (body: string, signature: string) => route.POST(new Request('https://example.test/webhook', { method: 'POST', headers: { 'x-razorpay-signature': signature }, body }));
  const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { order_id: 'order_123' } } } });
  const signature = createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex');
  assert.equal((await send(body + ' ', signature)).status, 401);
  assert.equal(settled, 0);
  assert.equal((await send(body, signature)).status, 200);
  assert.equal(settled, 1);
  const unknown = body.replace('order_123', 'order_unknown');
  assert.equal((await send(unknown, createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(unknown).digest('hex'))).status, 503);
});

test('Razorpay refunds use the original provider and retry the same idempotency key', async () => {
  const payment = { id: 'pay_123', order_id: 'order_123', amount: 35000, currency: 'INR', status: 'captured', captured: true };
  let submissions = 0;
  const h = harness({ 'razorpayCheckouts/TN123': checkout, 'settings/paymentGateway': { activeGateway: 'PhonePe' } }, { fetch: async (url: string, init: Data) => {
    if (url.endsWith('/payments')) return json({ items: [payment] });
    if (url.endsWith('/refund')) {
      assert.equal(init.headers['X-Refund-Idempotency'], 'CREF123456789_0');
      if (++submissions === 1) throw new Error('Simulated refund timeout');
      return json({ id: 'rfnd_123', payment_id: 'pay_123', amount: 10000, currency: 'INR', receipt: 'CREF123456789_0', status: 'processed' });
    }
    throw new Error('Unexpected call');
  } });
  const refunds = h.load('@/lib/gateway-refunds');
  assert.equal((await refunds.credentialsForPaymentReference('TN123')).gateway, 'Razorpay');
  await assert.rejects(refunds.gatewayRefundRequest('CREF123456789_0', 'TN123', 10000), /timeout/);
  assert.equal((await refunds.gatewayRefundRequest('CREF123456789_0', undefined, undefined, 'TN123')).emptyResponse, true);
  assert.equal((await refunds.gatewayRefundRequest('CREF123456789_0', 'TN123', 10000)).state, 'COMPLETED');
  await assert.rejects(refunds.gatewayRefundRequest('CREF123456789_0', 'TN123', 12000), /Refund details changed/);
});

test('approved cancellation refunds settle through Razorpay even when PhonePe is selected', async () => {
  const requestId = 'CREF' + 'a'.repeat(32), merchantRefundId = requestId + '_0';
  const keyId = 'rzp_live_Example123';
  const payment = { id: 'pay_123', order_id: 'order_123', amount: 35000, currency: 'INR', status: 'captured', captured: true };
  const refund = { id: 'rfnd_123', payment_id: 'pay_123', amount: 35000, currency: 'INR', receipt: merchantRefundId, status: 'processed' };
  let submitted = 0;
  const h = harness({
    'settings/paymentGateway': { activeGateway: 'PhonePe' },
    'razorpayCheckouts/TN123': { ...checkout, keyId },
    'orders/O1': { status: 'Cancelled', payment: { status: 'Paid', gateway: 'Razorpay' }, cancellationRefundId: requestId },
    [`creditRefundRequests/${requestId}`]: { state: 'Awaiting approval', source: 'Order cancellation', orderId: 'O1', ownerUid: 'customer', legs: [{ merchantRefundId, originalMerchantOrderId: 'TN123', amount: 350, state: 'Reserved', allocations: [{ fundedAmount: 350 }] }] },
  }, {
    env: { RAZORPAY_KEY_ID: keyId },
    fetch: async (url: string, init: Data) => {
      if (url.endsWith('/payments')) return json({ items: [payment] });
      if (url.endsWith('/refund')) { submitted++; assert.equal(init.headers['X-Refund-Idempotency'], merchantRefundId); return json(refund); }
      if (url.endsWith('/refunds/rfnd_123')) return json(refund);
      return json({ id: 'order_123', amount: 35000, currency: 'INR', receipt: 'receipt123', status: 'paid', amount_paid: 35000, amount_due: 0 });
    },
  });
  const refunds = h.load('@/lib/credit-refunds');
  await refunds.approveCreditRefund(requestId, 'admin', 'Cancellation approved under policy');
  assert.equal(h.read(`creditRefundRequests/${requestId}`).state, 'Completed');
  assert.equal(h.read('orders/O1').cancellationRefundStatus, 'Completed');
  assert.equal(h.read('orders/O1').payment.status, 'Refunded');
  await refunds.approveCreditRefund(requestId, 'admin', 'Repeated approval');
  assert.equal(submitted, 1);
});

test('replacement balances use Razorpay and keep their checkout after switching gateways', async () => {
  const requestId = 'REPLPAY' + 'a'.repeat(32);
  let created = 0, providerOrder: Data;
  const h = harness({
    'settings/paymentGateway': { activeGateway: 'Razorpay' },
    'orders/O1': { ownerUid: 'customer', payment: { status: 'Paid' }, replacementPendingId: requestId },
    [`orderReplacements/${requestId}`]: { ownerUid: 'customer', originalOrderId: 'O1', replacementOrderId: 'O2', state: 'Awaiting payment', quote: { due: 150 } },
  }, { fetch: async (url: string, init: Data) => {
    if (init.method === 'POST') { created++; providerOrder = { id: 'order_replacement123', ...JSON.parse(init.body) }; return json(providerOrder); }
    return json({ ...providerOrder, status: 'created' });
  } });
  const route = h.load('@/app/api/orders/replace/route');
  const body = { action: 'resume', orderId: 'O1' };
  const first = await route.POST(request(body, 'customer'));
  assert.equal(first.status, 200);
  assert.match((await first.json()).redirectUrl, /payment\/razorpay\/checkout/);
  assert.equal(h.read(`orderReplacements/${requestId}`).gateway, 'Razorpay');
  assert.equal(h.read(`razorpayCheckouts/${requestId}`).amount, 15000);
  await h.db.runTransaction(async tx => tx.update(h.db.collection('settings').doc('paymentGateway'), { activeGateway: 'PhonePe' }));
  const resumed = await route.POST(request(body, 'customer'));
  assert.equal(resumed.status, 200);
  assert.match((await resumed.json()).redirectUrl, /payment\/razorpay\/checkout/);
  assert.equal(created, 1);
});

const cancellationOrder = { ownerUid: 'customer', status: 'Under verification', updatedAt: 'version1', payment: { status: 'Paid', gateway: 'Razorpay', amount: 350, phonepeMerchantOrderId: 'TN123' } };
const cancellationId = 'CREF' + createHash('sha256').update('cancel:O1').digest('hex').slice(0, 32);

test('customer cancellation creates one refund request and never submits money before admin approval', async () => {
  const h = harness({ 'orders/O1': cancellationOrder });
  const route = h.load('@/app/api/orders/cancel/route');
  const cancel = () => route.POST(request({ orderId: 'O1', updatedAt: 'version1' }, 'customer'));
  const responses = await Promise.all([cancel(), cancel()]);
  assert.deepEqual(responses.map(response => response.status), [200, 200]);
  assert.equal(h.read('orders/O1').status, 'Cancelled');
  assert.equal(h.read('orders/O1').payment.status, 'Paid');
  assert.equal(h.read('orders/O1').cancellationRefundStatus, 'Awaiting approval');
  const refund = h.read(`creditRefundRequests/${cancellationId}`);
  assert.equal(refund.amount, 350);
  assert.equal(refund.legs.length, 1);
  assert.equal(refund.legs[0].originalMerchantOrderId, 'TN123');
  assert.equal(refund.legs[0].merchantRefundId, cancellationId + '_0');
  assert.equal(h.calls.length, 0);
});

test('cancellation rejects unauthorized users, unpaid orders, preparation and stale or replacement orders', async () => {
  const patches = [
    { payment: { ...cancellationOrder.payment, status: 'Pending' } },
    { status: 'Drafting' }, { status: 'Dispatched' }, { status: 'Delivered' },
    { preparationStartedAt: 'earlier' }, { courier: { trackingNumber: 'TRACK' } },
    { replacedByOrderId: 'O2' }, { replacementPendingId: 'PENDING' }, { modificationReviewId: 'REVIEW' },
    { updatedAt: 'newer-version' },
  ];
  for (const patch of patches) {
    const h = harness({ 'orders/O1': { ...cancellationOrder, ...patch } });
    const response = await h.load('@/app/api/orders/cancel/route').POST(request({ orderId: 'O1', updatedAt: 'version1' }, 'customer'));
    assert.equal(response.status, 409);
    assert.equal(h.read(`creditRefundRequests/${cancellationId}`), undefined);
    assert.equal(h.calls.length, 0);
  }
  const h = harness({ 'orders/O1': cancellationOrder }), route = h.load('@/app/api/orders/cancel/route');
  assert.equal((await route.POST(request({ orderId: 'O1' }, ''))).status, 401);
  assert.equal((await route.POST(request({ orderId: 'O1' }, 'other'))).status, 404);
  const history = harness({ 'orders/O1': cancellationOrder, 'adminLogs/started': { orderId: 'O1', newStatus: 'Drafting' } });
  assert.equal((await history.load('@/app/api/orders/cancel/route').POST(request({ orderId: 'O1', updatedAt: 'version1' }, 'customer'))).status, 409);
});

test('admin can decline a cancellation refund before approval but cannot decline a submitted refund', async () => {
  const seed = {
    'orders/O1': { ...cancellationOrder, status: 'Cancelled', cancellationRefundId: cancellationId },
    [`creditRefundRequests/${cancellationId}`]: { state: 'Awaiting approval', source: 'Order cancellation', orderId: 'O1', ownerUid: 'customer', legs: [{ merchantRefundId: cancellationId + '_0', state: 'Reserved', amount: 350 }] },
  };
  const h = harness(seed), refunds = h.load('@/lib/credit-refunds');
  await refunds.rejectCreditRefund(cancellationId, 'admin', 'Policy reviewed and refund declined');
  assert.equal(h.read(`creditRefundRequests/${cancellationId}`).state, 'Declined');
  assert.equal(h.read('orders/O1').status, 'Cancelled');
  assert.equal(h.read('orders/O1').cancellationRefundStatus, 'Declined');
  assert.equal(h.read('orders/O1').cancellationRefundNote, 'Policy reviewed and refund declined');
  assert.equal(h.calls.length, 0);
  const processing = harness({ ...seed, [`creditRefundRequests/${cancellationId}`]: { ...seed[`creditRefundRequests/${cancellationId}`], state: 'Processing' } });
  await assert.rejects(processing.load('@/lib/credit-refunds').rejectCreditRefund(cancellationId, 'admin', 'Decline processing request'), /cannot be manually released/);
});

test('refund approval stays blocked in test mode without contacting the payment provider', async () => {
  const h = harness({
    'razorpayCheckouts/TN123': checkout,
    [`creditRefundRequests/${cancellationId}`]: { state: 'Awaiting approval', legs: [{ originalMerchantOrderId: 'TN123' }] },
  });
  await assert.rejects(h.load('@/lib/credit-refunds').approveCreditRefund(cancellationId, 'admin', 'Approved under policy'), /unavailable in test mode/);
  assert.equal(h.read(`creditRefundRequests/${cancellationId}`).state, 'Awaiting approval');
  assert.equal(h.calls.length, 0);
});


test('Razorpay timeout retries require a complete, verified set of failed payments or an untouched order', async () => {
  const base = { id: 'order_123', amount: 35000, amount_paid: 0, amount_due: 35000, currency: 'INR', receipt: 'receipt123', status: 'attempted', attempts: 1 };
  const failed = { id: 'pay_123', order_id: 'order_123', amount: 35000, currency: 'INR', status: 'failed' };
  for (const scenario of [
    { order: { ...base, status: 'created', attempts: 0 }, items: [], retry: true },
    { order: base, items: [failed], retry: true },
    { order: base, items: [{ ...failed, status: 'authorized' }], retry: false },
    { order: base, items: [{ ...failed, status: 'created' }], retry: false },
    { order: base, items: [{ ...failed, status: 'captured' }], retry: false },
    { order: { ...base, attempts: 2 }, items: [failed], retry: false },
    { order: { ...base, amount_paid: 1 }, items: [failed], retry: false },
    { order: base, items: [{ ...failed, order_id: 'order_other' }], retry: false },
  ]) {
    const h = harness({ 'razorpayCheckouts/TN123': checkout }, { fetch: async (url: string) => json(url.endsWith('/payments') ? { items: scenario.items } : scenario.order) });
    const gateway = h.load('@/lib/payment-gateway');
    const result = await gateway.fetchGatewayOrderStatus(gateway.gatewayCredentials('Razorpay'), '', 'TN123', true);
    assert.equal(result.state, 'PENDING');assert.equal(result.retrySafe, scenario.retry);
  }
});


test('closing an untouched regular QR checkout immediately returns to My Orders with retry available', async () => {
  const h = harness({ 'razorpayCheckouts/TN123': checkout,
    'phonepePaymentAttempts/TN123': { ownerUid: 'customer', orderId: 'O1', gateway: 'Razorpay', amount: 350 },
    'orders/O1': { ownerUid: 'customer', status: 'Submitted', payment: { status: 'Pending', phonepeMerchantOrderId: 'TN123' } },
  }, { fetch: async (url: string) => json(url.endsWith('/payments') ? { items: [] } : { id: 'order_123', amount: 35000, amount_paid: 0, amount_due: 35000, currency: 'INR', receipt: 'receipt123', status: 'created', attempts: 0 }) });
  const route = h.load('@/app/api/payment/razorpay/checkout/route');
  assert.equal((await route.POST(request({ attempt: 'TN123', action: 'dismiss' }, 'other'))).status, 404);
  const response = await route.POST(request({ attempt: 'TN123', action: 'dismiss' }, 'customer'));
  assert.equal(response.status, 200);const result = await response.json();
  assert.equal(result.retryAvailable, true);assert.equal(result.returnUrl, '/my-orders');
  assert.equal(h.read('orders/O1').payment.checkoutClosed, true);
  assert.equal(h.read('orders/O1').payment.retryAvailable, true);
  assert.equal(h.read('orders/O1').payment.status, 'Pending');
  assert.equal(h.calls.filter(c => c.method === 'POST').length, 0, 'Dismissal creates no new gateway order');
  await h.db.collection('orders').doc('O1').update({ status: 'Cancelled' });
  assert.equal((await route.POST(request({ attempt: 'TN123', action: 'options' }, 'customer'))).status, 409);
});
