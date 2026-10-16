import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
function load(file: string, mocks: Record<string, any> = {}) {
  const target = { exports: {} as any };
  runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, { module: target, exports: target.exports, require: (name: string) => name in mocks ? mocks[name] : require(name), console, Uint8Array, TextDecoder, TextEncoder });
  return target.exports;
}
const { getOrderBill } = load('../lib/order-bill.ts');
function order(payment: Record<string, unknown> = {}) {
  return { orderId: 'TEST-ORDER', ownerUid: 'customer', customerEmail: 'customer@example.com', createdAt: '2026-10-16T05:00:00Z', agreementTerms: { stampPaperDenomination: 100 },
    payment: { status: 'Paid', amount: 200, referralCreditApplied: 50, couponDiscount: 100, totalBeforeCredits: 250, subtotal: 350, ...payment } };
}

test('Bill preserves saved discounts and credits; legacy and fully credit-paid orders balance', () => {
  const bill = getOrderBill(order());
  assert.equal(bill.subtotal, 350);
  assert.equal(bill.paid, 200);
  assert.equal(bill.reference, 'AP-TEST-ORDER');
  assert.equal(getOrderBill(order({ amount: 0, referralCreditApplied: 250 })).paid, 0);
  assert.equal(getOrderBill(order({ amount: 0, referralCreditApplied: 0, couponDiscount: 350, totalBeforeCredits: 0 })).discount, 350);
  assert.equal(getOrderBill({ ...order(), payment: { status: 'Paid', amount: 350 } }).subtotal, 350);
});

test('Bills reject unconfirmed, refunded, non-finite and inconsistent saved payments', () => {
  for (const status of ['Pending', 'Failed', 'Refunded']) assert.throws(() => getOrderBill(order({ status })));
  for (const amount of [undefined, NaN, Infinity, -1]) assert.throws(() => getOrderBill(order({ amount })));
  assert.throws(() => getOrderBill(order({ subtotal: 351 })), /balance/);
});

test('Bill endpoint requires authentication, ownership and payment; successful PDF is private', async () => {
  let uid = 'customer';
  let saved = order();
  let renders = 0;
  const { NextRequest } = require('next/server');
  const route = load('../app/api/orders/bill/route.ts', {
    '@/lib/firebase-admin': {
      verifyFirebaseIdToken: async () => { if (uid === 'expired') throw { code: 'auth/id-token-expired' }; return { uid }; },
      getAdminDb: () => ({ collection: (name: string) => ({ doc: () => ({ get: async () => name === 'orders' ? { exists: true, data: () => saved } : { data: () => ({ email: 'support@example.com' }) } }) }) }),
    },
    '@/lib/api-input': load('../lib/api-input.ts'),
    '@/lib/order-bill': { getOrderBill },
    '@/lib/order-bill-pdf': { renderOrderBill: async () => { renders++; return new TextEncoder().encode('%PDF-1.7'); } },
    '@/src/config/vendor': { VENDOR_CONFIG: { email: 'support@example.com' } },
  });
  const request = (token = 'token') => new NextRequest('http://localhost/api/orders/bill', {
    method: 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: 'TEST-ORDER' }),
  });
  assert.equal((await route.POST(request(''))).status, 401);
  uid = 'expired'; assert.equal((await route.POST(request())).status, 401);
  uid = 'other-customer'; assert.equal((await route.POST(request())).status, 404);
  uid = 'customer'; saved = order({ status: 'Pending' }); assert.equal((await route.POST(request())).status, 409);
  saved = order({ subtotal: 999 }); assert.equal((await route.POST(request())).status, 409);
  assert.equal(renders, 0);
  saved = order(); const response = await route.POST(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.match(response.headers.get('content-disposition'), /attachment; filename="AgreementPrint-Bill-TEST-ORDER.pdf"/);
  assert.match(await response.text(), /^%PDF/);
});
