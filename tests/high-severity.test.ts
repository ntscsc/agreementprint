import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { checkoutDetailsChanged, selectCheckoutDetails } from '../lib/order-checkout-details.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
type Data = Record<string, any>;

// Serial, atomic transactions with rollback and read-before-write enforcement.
// These exercise production service code without touching real accounts.
function database(seed: Data) {
  let documents = structuredClone(seed);
  let queue = Promise.resolve();
  function snapshot(path: string, source = documents) {
    return { exists: path in source, id: path.split('/').at(-1), data: () => structuredClone(source[path]) };
  }
  const db = {
    read: (path: string) => structuredClone(documents[path]),
    collection: (name: string) => ({
      doc: (id: string) => ({ path: `${name}/${id}`, get: async () => snapshot(`${name}/${id}`) }),
      where: (key: string, _op: string, value: unknown) => ({ get: async () => ({ docs: Object.keys(documents).filter((path) => path.startsWith(`${name}/`) && documents[path][key] === value).map((path) => snapshot(path)) }) }),
    }),
    runTransaction: (callback: (tx: Data) => Promise<unknown>) => {
      const result = queue.then(async () => {
        const draft = structuredClone(documents);
        let writing = false;
        const tx = {
          get: async (ref: { path: string }) => { if (writing) throw new Error('Read after write'); return snapshot(ref.path, draft); },
          set: (ref: { path: string }, value: unknown) => { writing = true; draft[ref.path] = structuredClone(value); },
          create: (ref: { path: string }, value: unknown) => { writing = true; if (ref.path in draft) throw new Error('Document exists'); draft[ref.path] = structuredClone(value); },
          delete: (ref: { path: string }) => { writing = true; delete draft[ref.path]; },
          update: (ref: { path: string }, values: Data) => {
            writing = true; if (!(ref.path in draft)) throw new Error('Missing document');
            for (const [key, value] of Object.entries(values)) {
              const parts = key.split('.'); let target = draft[ref.path];
              for (const part of parts.slice(0, -1)) target = target[part] ??= {};
              target[parts.at(-1)!] = structuredClone(value);
            }
          },
        };
        const value = await callback(tx); documents = draft; return value;
      });
      queue = result.then(() => undefined, () => undefined);
      return result;
    },
  };
  return db;
}

function loader(db: ReturnType<typeof database>, extra: Data = {}) {
  const cache: Data = {};
  function load(name: string): any {
    if (name in extra) return extra[name];
    if (name === '@/lib/firebase-admin') return { getAdminDb: () => db };
    if (name === 'firebase-admin/firestore') return {};
    if (!name.startsWith('@/')) return require(name);
    if (cache[name]) return cache[name];
    const source = readFileSync(new URL(`../${name.slice(2)}.ts`, import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText;
    const target = { exports: {} };
    runInNewContext(compiled, { module: target, exports: target.exports, require: load, Date, console, URL, Buffer, Uint8Array, File, AbortSignal, process: { env: { NODE_ENV: 'test' } }, fetch: extra.fetch });
    cache[name] = target.exports;
    return target.exports;
  }
  return load;
}

const agreement = {
  ownerDetails: { fullName: 'Owner Example', relativeName: 'Relative Example', age: 30, address: '12 Example Road Chennai 600001', phone: '9876543210' },
  tenantDetails: { fullName: 'Tenant Example', relativeName: 'Relative Example', age: 25, address: '14 Example Road Chennai 600001', phone: '9876543211' },
  propertyDetails: { fullAddress: '12 Example Road Chennai', city: 'Chennai', pincode: '600001', propertyType: 'Flat', furnishing: 'Unfurnished' },
  agreementTerms: { monthlyRent: 10000, securityDeposit: 20000, maintenanceCharges: 0, startDate: '2026-10-12', tenureMonths: 11, noticePeriodDays: 30, rentIncreasePct: 5, stampPaperDenomination: 100, deliveryLocation: 'Within Chennai', deliveryRecipient: 'Owner', includeNotary: false },
  proofUploads: {},
};
const seed = {
  'orders/O1': { ...agreement, orderId: 'O1', ownerUid: 'U1', status: 'Submitted', payment: { status: 'Pending' } },
  'referralAccounts/U1': { balance: 100 },
};
const attempt = (id: string, credit = 100) => ({ orderId: 'O1', ownerUid: 'U1', merchantOrderId: id, amount: 250, creditApplied: credit, initiatedAt: Date.now(), redirectUrl: 'https://checkout.example', returnUrl: 'https://vendor.example/payment/phonepe/return', totalBeforeCredits: 350, state: 'PENDING' });

async function prepare(db: ReturnType<typeof database>, load: ReturnType<typeof loader>, id: string) {
  const token = await load('@/lib/checkout-lock').acquireCheckoutLock(db, 'O1', 'U1');
  await load('@/lib/referral-admin').reserveReferralCreditForOrder('O1', 'U1', 100, { merchantOrderId: id, lockToken: token, totalBeforeCredits: 350, paymentAttempt: attempt(id) });
  await load('@/lib/checkout-lock').releaseCheckoutLock(db, 'O1', token);
}

test('Concurrent checkout requests acquire exactly one distributed lock', async () => {
  const db = database(seed); const locks = loader(db)('@/lib/checkout-lock');
  const results = await Promise.allSettled([locks.acquireCheckoutLock(db, 'O1', 'U1'), locks.acquireCheckoutLock(db, 'O1', 'U1')]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
});

test('Expired lock owners cannot clear or write through a replacement lock', async () => {
  const db = database({ ...seed, 'checkoutLocks/O1': { token: 'OLD', expiresAt: 0 } });
  const locks = loader(db)('@/lib/checkout-lock');
  const token = await locks.acquireCheckoutLock(db, 'O1', 'U1');
  await locks.releaseCheckoutLock(db, 'O1', 'OLD');
  assert.equal(db.read('checkoutLocks/O1').token, token);
  await assert.rejects(db.runTransaction((tx) => locks.assertCheckoutLock(db, tx, 'O1', 'OLD')));
});

test('Reserved credits retry without requiring the already-deducted wallet balance', async () => {
  const db = database(seed); const load = loader(db); await prepare(db, load, 'P1');
  assert.equal(db.read('referralAccounts/U1').balance, 0);
  const result = await load('@/lib/referral-admin').reserveReferralCreditForOrder('O1', 'U1', 100);
  assert.equal(result.reserved, 100);
  assert.equal(db.read('referralAccounts/U1').balance, 0);
});

test('Repeated reserve/release cycles refund exactly once per reservation', async () => {
  const db = database(seed); const load = loader(db); const referrals = load('@/lib/referral-admin');
  for (const id of ['P1', 'P2']) {
    await prepare(db, load, id);
    assert.equal(await referrals.releaseReferralReservation('O1', id, 'FAILED'), true);
    assert.equal(await referrals.releaseReferralReservation('O1', id, 'FAILED'), false);
    assert.equal(db.read('referralAccounts/U1').balance, 100);
  }
  assert.ok(db.read('referralLedger/release_O1_1'));
  assert.ok(db.read('referralLedger/release_O1_2'));
});

test('Late failures and successes cannot touch a newer reservation', async () => {
  const db = database(seed); const load = loader(db); const referrals = load('@/lib/referral-admin');
  await prepare(db, load, 'P1'); await referrals.releaseReferralReservation('O1', 'P1', 'EXPIRED');
  await prepare(db, load, 'P2');
  assert.equal(await referrals.releaseReferralReservation('O1', 'P1', 'FAILED'), false);
  await assert.rejects(referrals.confirmPaidOrderAndGrantReferral('O1', { merchantOrderId: 'P1' }));
  assert.equal(db.read('referralReservations/O1').merchantOrderId, 'P2');
  assert.equal(db.read('referralReservations/O1').status, 'reserved');
  assert.equal(db.read('orders/O1').payment.status, 'Pending');
});

test('Success/failure races settle atomically without spending refunded credits', async () => {
  for (const successFirst of [true, false]) {
    const db = database(seed); const load = loader(db); const referrals = load('@/lib/referral-admin');
    await prepare(db, load, 'P1');
    if (successFirst) {
      await referrals.confirmPaidOrderAndGrantReferral('O1', { merchantOrderId: 'P1' });
      assert.equal(await referrals.releaseReferralReservation('O1', 'P1'), false);
      assert.equal(db.read('referralReservations/O1').status, 'consumed');
      assert.equal(db.read('referralAccounts/U1').balance, 0);
    } else {
      await referrals.releaseReferralReservation('O1', 'P1');
      await assert.rejects(referrals.confirmPaidOrderAndGrantReferral('O1', { merchantOrderId: 'P1' }));
      assert.equal(db.read('referralReservations/O1').status, 'released');
      assert.equal(db.read('referralAccounts/U1').balance, 100);
    }
  }
});

test('Reviewed order edits compare independent of object key order and ignore payment injection', () => {
  assert.equal(checkoutDetailsChanged({ ownerDetails: { phone: '9876543210', fullName: 'Original' } }, { ownerDetails: { fullName: 'Original', phone: '9876543210' } }), false);
  assert.equal(checkoutDetailsChanged({ ownerDetails: { fullName: 'Original' } }, { ownerDetails: { fullName: 'Edited' } }), true);
  assert.deepEqual(selectCheckoutDetails({ ownerDetails: { fullName: 'Edited' }, ownerUid: 'attacker', payment: { status: 'Paid' } }), { ownerDetails: { fullName: 'Edited' } });
});

function checkoutLoader(db: ReturnType<typeof database>, gatewayState = 'PENDING', outbound?: () => Promise<unknown>) {
  return loader(db, {
    '@/lib/firebase-admin': { getAdminDb: () => db, verifyFirebaseIdToken: async () => ({ uid: 'U1' }) },
    'next/server': { NextResponse: { json: (body: unknown, options?: { status: number }) => ({ body, status: options?.status ?? 200 }) } },
    '@/lib/phonepe': {
      getPhonePeCredentials: () => ({ production: false }), getPhonePeAccessToken: async () => 'TOKEN',
      getPhonePeApiBase: () => 'https://gateway.example',
      fetchPhonePeOrderStatus: async () => ({ state: gatewayState, amount: 25000 }),
    },
    fetch: async () => { await outbound?.(); return { ok: true, json: async () => ({ redirectUrl: 'https://checkout.example/new' }) }; },
  })('@/app/api/payment/phonepe/create-order/route');
}
function checkoutRequest(body: unknown) {
  return { headers: { get: () => 'Bearer TOKEN' }, json: async () => ({ reviewedTotal: 350, ...(body as object) }), nextUrl: { origin: 'https://vendor.example' } };
}

test('Concurrent checkout handlers create one gateway request with a durable pre-request association', async () => {
  const db = database(seed); let outbound = 0;
  const route = checkoutLoader(db, 'PENDING', async () => {
    outbound++;
    const order = db.read('orders/O1');
    assert.equal(db.read(`phonepePaymentAttempts/${order.payment.phonepeMerchantOrderId}`).state, 'INITIALIZING');
  });
  const responses = await Promise.all([route.POST(checkoutRequest({ orderId: 'O1', creditAmount: 100 })), route.POST(checkoutRequest({ orderId: 'O1', creditAmount: 100 }))]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  assert.equal(outbound, 1);
  assert.equal(db.read('referralAccounts/U1').balance, 0);
});

test('An expired local checkout timer reuses the gateway-pending attempt with reserved credits', async () => {
  const db = database(seed); const load = loader(db); await prepare(db, load, 'P1');
  await db.runTransaction(async (tx) => { tx.update(db.collection('phonepePaymentAttempts').doc('P1'), { initiatedAt: Date.now() - 3600000 }); });
  let outbound = 0; const route = checkoutLoader(db, 'PENDING', async () => { outbound++; });
  const response = await route.POST(checkoutRequest({ orderId: 'O1', creditAmount: 100 }));
  assert.equal(response.status, 200); assert.equal(response.body.merchantOrderId, 'P1');
  assert.equal(outbound, 0); assert.equal(db.read('referralAccounts/U1').balance, 0);
});

test('Gateway timeouts preserve the attempt and reservation instead of creating another charge', async () => {
  const db = database(seed); let outbound = 0;
  const route = checkoutLoader(db, 'PENDING', async () => { outbound++; throw new Error('Simulated timeout'); });
  assert.equal((await route.POST(checkoutRequest({ orderId: 'O1', creditAmount: 100 }))).status, 500);
  const id = db.read('orders/O1').payment.phonepeMerchantOrderId;
  assert.equal(db.read('referralReservations/O1').merchantOrderId, id);
  assert.equal((await route.POST(checkoutRequest({ orderId: 'O1', creditAmount: 100 }))).status, 409);
  assert.equal(db.read('orders/O1').payment.phonepeMerchantOrderId, id);
  assert.equal(outbound, 1); assert.equal(db.read('referralAccounts/U1').balance, 0);
});

test('Failed checkout retries save reviewed edits and charge their updated price', async () => {
  const db = database(seed); const load = loader(db); await prepare(db, load, 'P1');
  await load('@/lib/referral-admin').releaseReferralReservation('O1', 'P1', 'FAILED');
  const details = { ...agreement, ownerDetails: { ...agreement.ownerDetails, fullName: 'Edited owner', address: '12 Example Road Madurai 625001' }, agreementTerms: { ...agreement.agreementTerms, stampPaperDenomination: 200, deliveryLocation: 'Within Tamil Nadu', includeNotary: true }, proofUploads: {}, referralCode: '' };
  const response = await checkoutLoader(db).POST(checkoutRequest({ orderId: 'O1', creditAmount: 100, reviewedTotal: 700, orderDetails: details }));
  assert.equal(response.status, 200);
  assert.equal(db.read('orders/O1').ownerDetails.fullName, 'Edited owner');
  assert.equal(response.body.amountDue, 600); // 500 package + 200 notary - 100 credits
});

test('Pending checkout refuses edited details rather than charging for an outdated review', async () => {
  const db = database(seed); const load = loader(db); await prepare(db, load, 'P1');
  const response = await checkoutLoader(db).POST(checkoutRequest({ orderId: 'O1', creditAmount: 100, orderDetails: { ...agreement, ownerDetails: { ...agreement.ownerDetails, fullName: 'Edited' } } }));
  assert.equal(response.status, 409);
  assert.equal(db.read('orders/O1').ownerDetails.fullName, agreement.ownerDetails.fullName);
  assert.equal(db.read('orders/O1').payment.phonepeMerchantOrderId, 'P1');
});

test('Credit-only checkout recovery consumes its existing reservation once', async () => {
  const db = database({ ...seed, 'referralAccounts/U1': { balance: 350 } }); const load = loader(db);
  const token = await load('@/lib/checkout-lock').acquireCheckoutLock(db, 'O1', 'U1');
  await load('@/lib/referral-admin').reserveReferralCreditForOrder('O1', 'U1', 350, { merchantOrderId: 'C1', lockToken: token, totalBeforeCredits: 350 });
  await load('@/lib/checkout-lock').releaseCheckoutLock(db, 'O1', token);
  const response = await checkoutLoader(db).POST(checkoutRequest({ orderId: 'O1', creditAmount: 350 }));
  assert.equal(response.status, 200); assert.equal(response.body.paid, true);
  assert.equal(db.read('referralAccounts/U1').balance, 0);
  assert.equal(db.read('referralReservations/O1').status, 'consumed');
});

test('Invalid saved pricing cannot start checkout or mark a zero-price order paid', async () => {
  for (const value of [0, -1, NaN, Infinity, 350.5]) {
    const db = database({ ...seed, 'settings/pricing': { stamp100Chennai: value } });
    let outbound = 0;
    const response = await checkoutLoader(db, 'PENDING', async () => { outbound++; }).POST(checkoutRequest({ orderId: 'O1', creditAmount: 0 }));
    assert.equal(response.status, 503);
    assert.equal(outbound, 0);
    assert.equal(db.read('orders/O1').payment.status, 'Pending');
    assert.equal(db.read('referralAccounts/U1').balance, 100);
  }
});

test('Retired uploads and legacy payment endpoints cannot store files or modify payments', async () => {
  const db = database({});
  const load = loader(db, {
    'next/server': { NextResponse: { json: (body: unknown, options?: { status: number }) => ({ body, status: options?.status ?? 200 }) } },
  });
  for (const path of ['@/app/api/upload/route', '@/app/api/payment/create-order/route', '@/app/api/payment/webhook/route']) {
    assert.equal((await load(path).POST()).status, 410);
  }
  assert.equal((await load('@/app/api/upload/route').GET()).status, 410);
});


test('Checkout rejects a changed quote before saving edits, reserving credit or calling the gateway', async () => {
  const db = database(seed); let outbound = 0;
  const response = await checkoutLoader(db, 'PENDING', async () => { outbound++; }).POST(checkoutRequest({ orderId: 'O1', creditAmount: 100, reviewedTotal: 1 }));
  assert.equal(response.status, 409);
  assert.equal(outbound, 0);
  assert.equal(db.read('referralAccounts/U1').balance, 100);
  assert.equal(db.read('referralReservations/O1'), undefined);
});

test('Complete agreement validation blocks malformed paid orders before financial side effects', async () => {
  for (const changes of [
    { ownerDetails: {} },
    { ownerDetails: { ...agreement.ownerDetails, age: 'NaN' } },
    { tenantDetails: { ...agreement.tenantDetails, phone: 'wrong' } },
    { propertyDetails: { ...agreement.propertyDetails, propertyType: 'Unknown' } },
    { agreementTerms: { ...agreement.agreementTerms, includeNotary: 'false' } },
    { agreementTerms: { ...agreement.agreementTerms, monthlyRent: Infinity } },
    { agreementTerms: { ...agreement.agreementTerms, startDate: '2026-02-30' } },
    { agreementTerms: { ...agreement.agreementTerms, tenureMonths: 0 } },
    { agreementTerms: { ...agreement.agreementTerms, deliveryLocation: 'Within Tamil Nadu' } },
  ]) {
    const db = database(seed); let outbound = 0;
    const response = await checkoutLoader(db, 'PENDING', async () => { outbound++; }).POST(checkoutRequest({ orderId: 'O1', orderDetails: { ...agreement, ...changes } }));
    assert.equal(response.status, 400);
    assert.equal(outbound, 0);
    assert.equal(db.read('referralReservations/O1'), undefined);
  }
});

test('Malformed request JSON and expired authentication use 400 and 401', async () => {
  const db = database(seed);
  const invalidJson = { ...checkoutRequest({}), json: async () => { throw new SyntaxError('Bad JSON'); } };
  assert.equal((await checkoutLoader(db).POST(invalidJson)).status, 400);
  for (const body of [null, [], 'text']) {
    const request = { ...checkoutRequest({}), json: async () => body };
    assert.equal((await checkoutLoader(db).POST(request)).status, 400);
  }
  const load = loader(db, {
    'next/server': { NextResponse: { json: (body: unknown, options?: { status: number }) => ({ body, status: options?.status ?? 200 }) } },
    '@/lib/firebase-admin': { getAdminDb: () => db, verifyFirebaseIdToken: async () => { throw { code: 'auth/id-token-expired' }; } },
  });
  assert.equal((await load('@/app/api/payment/phonepe/create-order/route').POST(checkoutRequest({ orderId: 'O1' }))).status, 401);
  assert.equal((await load('@/app/api/payment/phonepe/status/route').POST(checkoutRequest({ orderId: 'O1' }))).status, 401);
});

test('Concurrent enquiry submissions share atomic duplicate and per-phone limits', async () => {
  const db = database({});
  const load = loader(db, { 'next/server': { NextResponse: { json: (body: unknown, options?: { status: number }) => ({ body, status: options?.status ?? 200 }) } } });
  const route = load('@/app/api/contact/route');
  const body = { name: 'Customer', phone: '9876543210', district: 'Chennai', message: 'Please contact me' };
  const results = await Promise.all([route.POST(checkoutRequest(body)), route.POST(checkoutRequest(body))]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 429]);
  assert.equal((await route.POST(checkoutRequest({ ...body, message: 'Different message one' }))).status, 200);
  assert.equal((await route.POST(checkoutRequest({ ...body, message: 'Different message two' }))).status, 200);
  assert.equal((await route.POST(checkoutRequest({ ...body, message: 'Different message three' }))).status, 429);
  assert.equal((await route.POST(checkoutRequest({ ...body, district: 'x'.repeat(101) }))).status, 400);
});

test('Shared global enquiry limits cannot be bypassed by rotating phone and message', async () => {
  const db = database({ 'enquiryLimits/global': { minute: Math.floor(Date.now() / 60000), count: 30 } });
  const route = loader(db, { 'next/server': { NextResponse: { json: (body: unknown, options?: { status: number }) => ({ body, status: options?.status ?? 200 }) } } })('@/app/api/contact/route');
  assert.equal((await route.POST(checkoutRequest({ name: 'Customer', phone: '9876543299', district: 'Chennai', message: 'Rotated enquiry' }))).status, 429);
});
