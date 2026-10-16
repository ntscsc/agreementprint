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
      get: async () => ({ docs: Object.keys(documents).filter(path => path.startsWith(`${name}/`)).map(path => snapshot(path)) }),
      limit: (count: number) => ({ get: async () => ({ docs: Object.keys(documents).filter(path => path.startsWith(`${name}/`)).slice(0, count).map(path => snapshot(path)) }) }),
      doc: (id: string) => ({ path: `${name}/${id}`, get: async () => snapshot(`${name}/${id}`) }),
      where: (key: string, _op: string, value: unknown) => ({ get: async () => ({ docs: Object.keys(documents).filter((path) => path.startsWith(`${name}/`) && key.split('.').reduce((data: any, part: string) => data?.[part], documents[path]) === value).map((path) => snapshot(path)) }) }),
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

test('Agreement submission accepts customer and agent referral codes consistently', () => {
  const { validateAgreement } = loader(database({}))('@/lib/agreement-validation');
  for (const referralCode of [undefined, '', 'ABCDEF123456', 'AGRAVI2026', 'AG123', 'AG123456789012345678']) {
    assert.doesNotThrow(() => validateAgreement({ ...agreement, referralCode }));
  }
  for (const referralCode of ['AG12', 'AG1234567890123456789', 'INVALID!CODE', 'agravi2026', 123, null]) {
    assert.throws(() => validateAgreement({ ...agreement, referralCode }), /valid coupon code/);
  }
});
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

const couponSeed = (discountAmount = 100) => ({
  ...seed,
  'orders/O1': { ...seed['orders/O1'], referralCode: 'WELCOME100' },
  'referralCodes/WELCOME100': { kind: 'agent', discountAmount, rewardAmount: 50, active: true },
});

test('Server checkout ignores client discount injection and saves the verified discount and net gateway amount', async () => {
  const db = database(couponSeed()); let gatewayCalls = 0;
  const route = checkoutLoader(db, 'PENDING', async () => { gatewayCalls++; });
  const quote = await route.POST(checkoutRequest({ orderId: 'O1', creditAmount: 100, couponDiscount: 999999 }));
  assert.equal(quote.status, 409);
  assert.equal(quote.body.reviewedTotal, 250);
  assert.equal(quote.body.couponDiscount, 100);
  assert.equal(quote.body.amountDue, 150);
  assert.equal(gatewayCalls, 0);
  const response = await route.POST(checkoutRequest({ orderId: 'O1', creditAmount: 100, reviewedTotal: 250, couponDiscount: 999999 }));
  assert.equal(response.status, 200);
  const order = db.read('orders/O1');
  const saved = db.read(`phonepePaymentAttempts/${order.payment.phonepeMerchantOrderId}`);
  assert.equal(saved.subtotal, 350); assert.equal(saved.couponDiscount, 100); assert.equal(saved.amount, 150);
  assert.equal(saved.creditApplied, 100); assert.equal(order.payment.couponCode, 'WELCOME100');
  await loader(db)('@/lib/referral-admin').confirmPaidOrderAndGrantReferral('O1', { merchantOrderId: saved.merchantOrderId });
  assert.equal(db.read('orders/O1').payment.status, 'Paid');
  assert.equal(db.read('firstOrderCoupons/U1').state, 'consumed');
  assert.equal(db.read('referralAccounts/U1').balance, 0);
});

test('Concurrent orders cannot reserve two first-order discounts for one customer', async () => {
  const db = database({ ...couponSeed(), 'orders/O2': { ...seed['orders/O1'], orderId: 'O2', referralCode: 'WELCOME100' } });
  let calls = 0;
  const route = checkoutLoader(db, 'PENDING', async () => { calls++; });
  const results = await Promise.all(['O1', 'O2'].map(orderId => route.POST(checkoutRequest({ orderId, reviewedTotal: 250 }))));
  assert.equal(results.filter(result => result.status === 200).length, 1);
  assert.equal(results.filter(result => result.status === 409).length, 1);
  assert.equal(calls, 1);
});

test('First-order reservation also blocks a concurrent undiscounted checkout', async () => {
  const db = database({ ...couponSeed(), 'orders/O2': { ...seed['orders/O1'], orderId: 'O2' } });
  const route = checkoutLoader(db);
  assert.equal((await route.POST(checkoutRequest({ orderId: 'O1', reviewedTotal: 250 }))).status, 200);
  assert.equal((await route.POST(checkoutRequest({ orderId: 'O2' }))).status, 409);
});

test('Confirmed failure releases the coupon while an uncertain or pending attempt keeps its discount snapshot', async () => {
  const db = database(couponSeed()); let calls = 0;
  const route = checkoutLoader(db, 'PENDING', async () => { calls++; });
  await route.POST(checkoutRequest({ orderId: 'O1', reviewedTotal: 250 }));
  const id = db.read('orders/O1').payment.phonepeMerchantOrderId;
  await db.runTransaction(async tx => tx.update(db.collection('referralCodes').doc('WELCOME100'), { discountAmount: 200, active: false }));
  assert.equal((await route.POST(checkoutRequest({ orderId: 'O1', reviewedTotal: 250 }))).status, 200);
  assert.equal(calls, 1);
  assert.equal(db.read('orders/O1').payment.couponDiscount, 100);
  await loader(db)('@/lib/referral-admin').releaseReferralReservation('O1', id, 'EXPIRED');
  assert.equal(db.read('firstOrderCoupons/U1').state, 'released');
  assert.equal((await route.POST(checkoutRequest({ orderId: 'O1', reviewedTotal: 150 }))).status, 400);
  await db.runTransaction(async tx => tx.update(db.collection('referralCodes').doc('WELCOME100'), { active: true }));
  assert.equal((await route.POST(checkoutRequest({ orderId: 'O1', reviewedTotal: 150 }))).status, 200);
  assert.equal(calls, 2);
  assert.equal(db.read('orders/O1').payment.couponDiscount, 200);
});

test('A coupon covering the full price settles once without a gateway request', async () => {
  const db = database(couponSeed(500)); let calls = 0;
  const response = await checkoutLoader(db, 'PENDING', async () => { calls++; }).POST(checkoutRequest({ orderId: 'O1', reviewedTotal: 0 }));
  assert.equal(response.status, 200); assert.equal(response.body.paid, true); assert.equal(calls, 0);
  assert.equal(db.read('orders/O1').payment.amount, 0);
  assert.equal(db.read('orders/O1').payment.couponDiscount, 350);
  assert.equal(db.read('firstOrderCoupons/U1').state, 'consumed');
  assert.equal(db.read('referralAccounts/U1').balance, 100);
});

test('Returning customers, self-coupons, unknown and disabled codes cannot get a discount', async () => {
  for (const changes of [
    { 'referralFirstPaidOrders/U1': { orderId: 'old' } },
    { 'orders/old': { ...seed['orders/O1'], orderId: 'old', payment: { status: 'Paid' } } },
    { 'referralCodes/WELCOME100': { uid: 'U1', discountAmount: 100 } },
    { 'referralCodes/WELCOME100': { active: false, discountAmount: 100 } },
    { 'referralCodes/WELCOME100': { kind: 'coupon', active: true, discountAmount: -1 } },
  ]) {
    const db = database({ ...couponSeed(), ...changes }); let calls = 0;
    const response = await checkoutLoader(db, 'PENDING', async () => { calls++; }).POST(checkoutRequest({ orderId: 'O1', reviewedTotal: 250 }));
    assert.ok(response.status >= 400); assert.equal(calls, 0);
    assert.equal(db.read('orders/O1').payment.status, 'Pending');
  }
});

test('Coupon changes between quote and reservation fail before any credits or gateway association are written', async () => {
  const db = database(couponSeed(200)), load = loader(db);
  const token = await load('@/lib/checkout-lock').acquireCheckoutLock(db, 'O1', 'U1');
  await assert.rejects(load('@/lib/referral-admin').reserveReferralCreditForOrder('O1', 'U1', 100, {
    merchantOrderId: 'C1', lockToken: token, totalBeforeCredits: 250,
    coupon: { code: 'WELCOME100', subtotal: 350, couponDiscount: 100, total: 250 },
  }), /discount changed/);
  assert.equal(db.read('referralAccounts/U1').balance, 100);
  assert.equal(db.read('firstOrderCoupons/U1'), undefined);
});

test('Standalone promotion administration is retired and cannot modify referral data', async () => {
  const db = database({ 'referralCodes/ABCDEF123456': { uid: 'referrer', createdAt: 'original' } });
  const modules = {
    'next/server': { NextResponse: { json: (body: unknown, options?: { status: number }) => ({ body, status: options?.status ?? 200 }) } },
    '@/lib/firebase-admin': { getAdminDb: () => db, verifyFirebaseIdToken: async (token: string) => ({ uid: token, email: token === 'admin' || token === 'unverified' ? 'pradeep1992official@gmail.com' : 'customer@example.com', email_verified: token !== 'unverified' }) },
  };
  const route = loader(db, modules)('@/app/api/admin/coupons/route');
  const request = (token = 'admin') => ({ headers: { get: () => token ? `Bearer ${token}` : null } });
  assert.equal((await route.POST(request(''))).status, 401);
  assert.equal((await route.POST(request('customer'))).status, 403);
  assert.equal((await route.POST(request('unverified'))).status, 403);
  assert.equal((await route.POST(request())).status, 410);
  assert.equal((await route.GET(request())).status, 410);
  assert.equal(db.read('referralCodes/ABCDEF123456').uid, 'referrer');
});

test('Coupon preview calculates the package server-side and rejects returning customers before agent attribution', async () => {
  const db = database(couponSeed());
  const modules = {
    'next/server': { NextResponse: { json: (body: unknown, options?: { status: number }) => ({ body, status: options?.status ?? 200 }) } },
    '@/lib/firebase-admin': { getAdminDb: () => db, verifyFirebaseIdToken: async () => ({ uid: 'U1' }) },
  };
  const route = loader(db, modules)('@/app/api/referrals/validate/route');
  const response = await route.POST(checkoutRequest({ code: 'welcome-100', subtotal: 1, discountAmount: 99999, packageOptions: { stampPaperDenomination: 100, deliveryLocation: 'Within Chennai', includeNotary: false } }));
  assert.equal(response.status, 200); assert.equal(response.body.subtotal, 350);
  assert.equal(response.body.couponDiscount, 100); assert.equal(response.body.total, 250);
  await db.runTransaction(async tx => tx.set(db.collection('referralFirstPaidOrders').doc('U1'), { orderId: 'old' }));
  assert.equal((await route.POST(checkoutRequest({ code: 'WELCOME100' }))).status, 409);
});

test('Coupon-only checkout recovers a committed reservation without charging or granting it twice', async () => {
  const db = database(couponSeed(350)), load = loader(db);
  const token = await load('@/lib/checkout-lock').acquireCheckoutLock(db, 'O1', 'U1');
  await load('@/lib/referral-admin').reserveReferralCreditForOrder('O1', 'U1', 0, { merchantOrderId: 'FREE1', lockToken: token, totalBeforeCredits: 0, coupon: { code: 'WELCOME100', subtotal: 350, couponDiscount: 350, total: 0 } });
  await load('@/lib/checkout-lock').releaseCheckoutLock(db, 'O1', token);
  let calls = 0;
  const route = checkoutLoader(db, 'PENDING', async () => { calls++; });
  const response = await route.POST(checkoutRequest({ orderId: 'O1' }));
  assert.equal(response.status, 200); assert.equal(response.body.paid, true);
  assert.equal(calls, 0); assert.equal(db.read('firstOrderCoupons/U1').state, 'consumed');
  assert.equal((await route.POST(checkoutRequest({ orderId: 'O1' }))).status, 409);
});

test('Every customer-generated code uses the shared discount, ignoring old per-code overrides', async () => {
  for (const codeData of [{ uid: 'referrer-a', discountAmount: 5 }, { kind: 'customer', uid: 'referrer-b', discountAmount: 999 }]) {
    const db = database({ ...seed, 'settings/coupons': { customerDiscountAmount: 80 }, 'referralCodes/ABCDEF123456': codeData, 'orders/O1': { ...seed['orders/O1'], referralCode: 'ABCDEF123456' } });
    const response = await checkoutLoader(db).POST(checkoutRequest({ orderId: 'O1', reviewedTotal: 270, customerDiscountAmount: 9999 }));
    assert.equal(response.status, 200);
    assert.equal(db.read('orders/O1').payment.couponDiscount, 80);
    assert.equal(db.read('orders/O1').payment.amount, 270);
  }
  const db = database({ ...seed, 'settings/coupons': { customerDiscountAmount: 80 } });
  const load = loader(db);
  const account = await load('@/lib/referral-admin').getOrCreateReferralAccount('new-referrer', db);
  const quote = await load('@/lib/coupon-server').getCouponQuote(db, 'U1', account.code, 350, 'O1');
  assert.equal(quote.couponDiscount, 80);
  assert.equal(db.read(`referralCodes/${account.code}`).kind, 'customer');
});

test('Shared customer discount changes preserve pending prices and apply after confirmed failure', async () => {
  const db = database({ ...seed, 'settings/coupons': { customerDiscountAmount: 80 }, 'referralCodes/ABCDEF123456': { uid: 'referrer' }, 'orders/O1': { ...seed['orders/O1'], referralCode: 'ABCDEF123456' } });
  let calls = 0;
  const route = checkoutLoader(db, 'PENDING', async () => { calls++; });
  assert.equal((await route.POST(checkoutRequest({ orderId: 'O1', reviewedTotal: 270 }))).status, 200);
  const id = db.read('orders/O1').payment.phonepeMerchantOrderId;
  await db.runTransaction(async tx => tx.set(db.collection('settings').doc('coupons'), { customerDiscountAmount: 120 }));
  assert.equal((await route.POST(checkoutRequest({ orderId: 'O1', reviewedTotal: 270 }))).status, 200);
  assert.equal(db.read('orders/O1').payment.couponDiscount, 80);
  assert.equal(calls, 1);
  await loader(db)('@/lib/referral-admin').releaseReferralReservation('O1', id, 'EXPIRED');
  assert.equal((await route.POST(checkoutRequest({ orderId: 'O1', reviewedTotal: 230 }))).status, 200);
  assert.equal(db.read('orders/O1').payment.couponDiscount, 120);
  assert.equal(calls, 2);
});

test('A shared customer discount change during reservation cannot bypass the reviewed price', async () => {
  const db = database({ ...seed, 'settings/coupons': { customerDiscountAmount: 120 }, 'referralCodes/ABCDEF123456': { uid: 'referrer' } });
  const load = loader(db), token = await load('@/lib/checkout-lock').acquireCheckoutLock(db, 'O1', 'U1');
  await assert.rejects(load('@/lib/referral-admin').reserveReferralCreditForOrder('O1', 'U1', 0, { merchantOrderId: 'C1', lockToken: token, totalBeforeCredits: 270, coupon: { code: 'ABCDEF123456', subtotal: 350, couponDiscount: 80, total: 270 } }), /discount changed/);
  assert.equal(db.read('firstOrderCoupons/U1'), undefined);
});

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
    { propertyDetails: { ...agreement.propertyDetails, pincode: '000000' } },
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

test('Public tracking hides reference existence, returns only tracking fields and limits concurrent guesses', async () => {
  const db = database(seed);
  const route = loader(db, { 'next/server': { NextResponse: { json: (body: unknown, options?: { status: number }) => ({ body, status: options?.status ?? 200 }) } } })('@/app/api/orders/track/route');
  const lookup = (orderId = 'O1', phone = '9876543210') => route.POST(checkoutRequest({ orderId, phone }));
  const found = await lookup();
  assert.equal(found.status, 200);
  assert.equal(found.body.order.ownerDetails, undefined);
  assert.equal(found.body.order.payment, undefined);
  assert.equal(found.body.order.proofUploads, undefined);
  const missing = await lookup('unknown');
  const wrongPhone = await lookup('O1', '9876543299');
  assert.equal(missing.status, 404);
  assert.equal(wrongPhone.status, 404);
  assert.equal(missing.body.error, wrongPhone.body.error);
  const results = await Promise.all(Array.from({ length: 10 }, () => lookup()));
  assert.equal(results.filter(result => result.status === 200).length, 8);
  assert.equal(results.filter(result => result.status === 429).length, 2);
  assert.equal((await lookup('O1', '1234567890')).status, 400);
});

test('Public tracking global limits cannot be bypassed by changing references', async () => {
  const db = database({ 'orderTrackingLimits/global': { minute: Math.floor(Date.now() / 60000), count: 120 } });
  const route = loader(db, { 'next/server': { NextResponse: { json: (body: unknown, options?: { status: number }) => ({ body, status: options?.status ?? 200 }) } } })('@/app/api/orders/track/route');
  assert.equal((await route.POST(checkoutRequest({ orderId: 'another', phone: '9876543210' }))).status, 429);
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


test('Checkout uses the selected recipient separate PIN for delivery pricing instead of embedded address text', async () => {
  for (const [recipient, pin, region, total] of [
    ['Owner', '600028', 'Within Chennai', 350],
    ['Owner', '625001', 'Within Tamil Nadu', 400],
    ['Tenant', '600028', 'Within Chennai', 350],
    ['Tenant', '641018', 'Within Tamil Nadu', 400],
  ] as const) {
    const db = database(seed);
    const details = { ...agreement,
      ownerDetails: { ...agreement.ownerDetails, pincode: recipient === 'Owner' ? pin : '625001' },
      tenantDetails: { ...agreement.tenantDetails, pincode: recipient === 'Tenant' ? pin : '600028' },
      agreementTerms: { ...agreement.agreementTerms, deliveryRecipient: recipient, deliveryLocation: region },
    };
    const response = await checkoutLoader(db).POST(checkoutRequest({ orderId: 'O1', creditAmount: 0, reviewedTotal: total, orderDetails: details }));
    assert.equal(response.status, 200);
    assert.equal(response.body.amountDue, total);
  }
});
test('Checkout rejects malformed separate PINs and mismatched delivery regions before payment', async () => {
  for (const pincode of ['60001', 'abcdef', '', '000000', '625001']) {
    const db = database(seed); let outbound = 0;
    const details = { ...agreement, ownerDetails: { ...agreement.ownerDetails, pincode } };
    const response = await checkoutLoader(db, 'PENDING', async () => { outbound++; }).POST(checkoutRequest({ orderId: 'O1', orderDetails: details }));
    assert.equal(response.status, 400);
    assert.equal(outbound, 0);
  }
});

test('Customer first-order discount is immediate but referrer credit is granted only after payment and once', async () => {
  const db = database({ ...seed,
    'orders/O1': { ...seed['orders/O1'], referralCode: 'ABCDEF123456' },
    'referralCodes/ABCDEF123456': { kind: 'customer', uid: 'REFERRER' },
    'referralAccounts/REFERRER': { balance: 10 },
    'settings/referrals': { rewardAmount: 125, refereeDiscountAmount: 40 },
  });
  const route = checkoutLoader(db);
  const response = await route.POST(checkoutRequest({ orderId: 'O1', reviewedTotal: 310 }));
  assert.equal(response.status, 200);
  assert.equal(db.read('orders/O1').payment.amount, 310);
  assert.equal(db.read('orders/O1').payment.couponDiscount, 40);
  assert.equal(db.read('referralAccounts/REFERRER').balance, 10);
  assert.equal(db.read('referralRewards/U1'), undefined);
  const service = loader(db)('@/lib/referral-admin');
  const merchantOrderId = db.read('orders/O1').payment.phonepeMerchantOrderId;
  await Promise.all([service.confirmPaidOrderAndGrantReferral('O1', { merchantOrderId }), service.confirmPaidOrderAndGrantReferral('O1', { merchantOrderId })]);
  assert.equal(db.read('referralAccounts/REFERRER').balance, 135);
  assert.equal(db.read('referralAccounts/U1').balance, 100);
  assert.equal(db.read('referralRewards/U1').amount, 125);
  assert.equal(db.read('referralRewards/U1').customerDiscount, 40);
  assert.equal(db.read('referralLedger/welcome_U1'), undefined);
  assert.equal(db.read('referralLedger/reward_U1').amount, 125);
});

test('Agent earns a manual payable reward only after the discounted first order is paid', async () => {
  const db = database({ ...seed,
    'orders/O1': { ...seed['orders/O1'], referralCode: 'RAVI2026' },
    'referralCodes/RAVI2026': { kind: 'agent', name: 'Ravi', rewardAmount: 350, customerDiscountAmount: 25, active: true },
    'agentReferralCustomers/U1': { code: 'RAVI2026', uid: 'U1', rewardStatus: 'Awaiting payment', joinedAt: '2026-10-15' },
  });
  const response = await checkoutLoader(db).POST(checkoutRequest({ orderId: 'O1', reviewedTotal: 325 }));
  assert.equal(response.status, 200);
  assert.equal(db.read('orders/O1').payment.amount, 325);
  assert.equal(db.read('agentReferralCustomers/U1').eligiblePaidOrderId, undefined);
  const service = loader(db)('@/lib/referral-admin');
  const merchantOrderId = db.read('orders/O1').payment.phonepeMerchantOrderId;
  await Promise.all([service.confirmPaidOrderAndGrantReferral('O1', { merchantOrderId }), service.confirmPaidOrderAndGrantReferral('O1', { merchantOrderId })]);
  const customer = db.read('agentReferralCustomers/U1');
  assert.equal(customer.eligiblePaidOrderId, 'O1');
  assert.equal(customer.rewardStatus, 'Pending');
  assert.equal(customer.rewardAmount, 350);
  assert.equal(customer.customerDiscountAmount, 25);
  assert.equal(db.read('referralAccounts/U1').balance, 100);
  assert.equal(db.read('referralLedger/welcome_U1'), undefined);
  assert.equal(db.read('referralRewards/U1').amount, 0);
});

test('Failed and historical payments cannot create an agent reward', async () => {
  for (const historical of [false, true]) {
    const db = database({ ...seed,
      'orders/O1': { ...seed['orders/O1'], referralCode: 'RAVI2026' },
      'referralCodes/RAVI2026': { kind: 'agent', rewardAmount: 350, customerDiscountAmount: 25 },
      ...(historical ? { 'orders/OLD': { ownerUid: 'U1', payment: { status: 'Paid' } } } : {}),
    });
    const service = loader(db)('@/lib/referral-admin');
    if (historical) await service.confirmPaidOrderAndGrantReferral('O1');
    else {
      await checkoutLoader(db).POST(checkoutRequest({ orderId: 'O1', reviewedTotal: 325 }));
      await service.releaseReferralReservation('O1', db.read('orders/O1').payment.phonepeMerchantOrderId);
    }
    assert.equal(db.read('agentReferralCustomers/U1'), undefined);
    assert.equal(db.read('referralRewards/U1'), undefined);
  }
});

test('Customer dashboard totals require confirmed paid orders belonging to the referred customer', async () => {
  const db = database({
    'settings/referrals': { rewardAmount: 100, refereeDiscountAmount: 20 },
    'orders/PAID': { ownerUid: 'U1', payment: { status: 'Paid' } },
    'orders/PENDING': { ownerUid: 'U2', payment: { status: 'Pending' } },
    'referralRewards/U1': { referrerUid: 'REFERRER', referredUid: 'U1', orderId: 'PAID', amount: 100 },
    'referralRewards/U2': { referrerUid: 'REFERRER', referredUid: 'U2', orderId: 'PENDING', amount: 100 },
    'referralRewards/U3': { referrerUid: 'REFERRER', referredUid: 'U3', orderId: 'PAID', amount: 999 },
    'referralRewards/U4': { referrerUid: 'REFERRER', referredUid: 'U4', orderId: 'MISSING', amount: 999 },
    'referralRewards/MALFORMED': { orderId: 'MISSING', amount: 999 },
    'referralRewards/SELF': { referrerUid: 'U1', referredUid: 'U1', orderId: 'PAID', amount: 100 },
    'referralRewards/AGENT': { kind: 'agent', referredUid: 'U1', orderId: 'PAID', amount: 0 },
  });
  const route = loader(db, {
    'next/server': { NextResponse: { json: (body: unknown, options?: { status: number }) => ({ body, status: options?.status ?? 200 }) } },
    '@/lib/firebase-admin': { getAdminDb: () => db, verifyFirebaseIdToken: async () => ({ email: 'pradeep1992official@gmail.com', email_verified: true }) },
  })('@/app/api/admin/referrals/route');
  const response = await route.GET(checkoutRequest({}));
  assert.equal(response.status, 200);
  assert.equal(response.body.rewardedReferrals, 1);
  assert.equal(response.body.totalCreditsIssued, 100);
  assert.equal(response.body.refereeDiscountAmount, 20);
});


test('Customer referral amounts and their audit record save atomically; invalid inputs are rejected', async () => {
  const db = database({ 'settings/referrals': { rewardAmount: 100, refereeDiscountAmount: 20 } });
  const route = loader(db, {
    'node:crypto': { randomUUID: () => 'AUDIT_TEST' },
    'next/server': { NextResponse: { json: (body: unknown, options?: { status: number }) => ({ body, status: options?.status ?? 200 }) } },
    '@/lib/firebase-admin': { getAdminDb: () => db, verifyFirebaseIdToken: async () => ({ uid: 'ADMIN', email: 'pradeep1992official@gmail.com', email_verified: true }) },
  })('@/app/api/admin/referrals/route');
  for (const value of ['', null, '20', -1, 1.5, 100001]) {
    assert.equal((await route.POST(checkoutRequest({ rewardAmount: value, refereeDiscountAmount: 20 }))).status, 400);
    assert.equal((await route.POST(checkoutRequest({ rewardAmount: 20, refereeDiscountAmount: value }))).status, 400);
  }
  assert.equal((await route.POST(checkoutRequest({ rewardAmount: 50, refereeDiscountAmount: 25 }))).status, 200);
  assert.equal(db.read('settings/referrals').rewardAmount, 50);
  assert.equal(db.read('settings/referrals').refereeDiscountAmount, 25);
  assert.equal(db.read('adminLogs/REFERRAL_AUDIT_TEST').adminUid, 'ADMIN');
  // A simulated audit failure must roll the settings back as well.
  assert.equal((await route.POST(checkoutRequest({ rewardAmount: 70, refereeDiscountAmount: 40 }))).status, 500);
  assert.equal(db.read('settings/referrals').rewardAmount, 50);
  assert.equal(db.read('settings/referrals').refereeDiscountAmount, 25);
});
