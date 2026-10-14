import * as apiInput from '../lib/api-input.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { isTrustedPaymentAttempt } from '../lib/payment-attempt.ts';

const attempt = {
  orderId: 'ORDER_A', ownerUid: 'CUSTOMER_A', merchantOrderId: 'TN123',
  amount: 350, initiatedAt: 1700000000000, creditApplied: 0,
  redirectUrl: 'https://checkout.example/pay', returnUrl: 'https://vendor.example/payment/phonepe/return',
};

// Execute the production handlers with isolated database/gateway boundaries.
// No network requests or real customer writes are made by these tests.
function loadRoute(route: string, documents: Record<string, unknown>, calls: { gateway: number; confirmed: number }) {
  const require = createRequire(import.meta.url);
  const ts = require('typescript');
  const source = readFileSync(new URL(`../app/api/payment/phonepe/${route}/route.ts`, import.meta.url), 'utf8');
  const db = {
    collection: (collection: string) => ({
      doc: (id: string) => ({ get: async () => ({
        id, exists: `${collection}/${id}` in documents,
        data: () => documents[`${collection}/${id}`],
      }) }),
    }),
  };
  const modules: Record<string, unknown> = {
    '@/lib/api-input': apiInput,
    '@/lib/agreement-validation': {},
    'next/server': { NextResponse: { json: (body: unknown, options?: { status: number }) => ({ body, status: options?.status ?? 200 }) } },
    'firebase-admin/firestore': { FieldValue: {} },
    '@/src/config/pricing': {},
    'node:crypto': require('node:crypto'),
    '@/lib/checkout-lock': { acquireCheckoutLock: async () => 'LOCK', releaseCheckoutLock: async () => {} },
    '@/lib/order-checkout-details': {},
    '@/lib/firebase-admin': { getAdminDb: () => db, verifyFirebaseIdToken: async () => ({ uid: 'CUSTOMER_A' }) },
    '@/lib/payment-attempt': { isTrustedPaymentAttempt },
    '@/lib/referral-utils': {},
    '@/lib/referral-admin': { confirmPaidOrderAndGrantReferral: async () => { calls.confirmed++; } },
    '@/lib/phonepe': {
      getPhonePeCredentials: () => ({}),
      getPhonePeAccessToken: async () => { calls.gateway++; return 'token'; },
      fetchPhonePeOrderStatus: async () => ({ state: 'COMPLETED', amount: 35000 }),
    },
  };
  const routeModule = { exports: {} as { POST: (req: unknown) => Promise<{ status: number; body: { paid?: boolean } }> } };
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText, {
    module: routeModule, exports: routeModule.exports, require: (name: string) => {
      if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
      return modules[name];
    },
    process: { env: { NODE_ENV: 'test' } }, URL, console, Date,
  });
  return routeModule.exports.POST;
}

function request(body: unknown) {
  return { headers: { get: () => 'Bearer valid-token' }, json: async () => body, nextUrl: { origin: 'https://vendor.example' } };
}

test('Status handler refuses forged order attempts before contacting the gateway', async () => {
  for (const trustedRecord of [undefined, { ...attempt, orderId: 'ORDER_B' }, { ...attempt, ownerUid: 'CUSTOMER_B' }]) {
    const calls = { gateway: 0, confirmed: 0 };
    const documents: Record<string, unknown> = {
      'orders/ORDER_A': { ownerUid: 'CUSTOMER_A', payment: {
        status: 'Pending', phonepeMerchantOrderId: 'TN123', amount: 350,
        phonepePaymentAttempts: [{ merchantOrderId: 'TN123', amount: 350 }],
      } },
    };
    if (trustedRecord) documents['phonepePaymentAttempts/TN123'] = trustedRecord;
    const response = await loadRoute('status', documents, calls)(request({ orderId: 'ORDER_A' }));
    assert.equal(response.status, 404);
    assert.deepEqual(calls, { gateway: 0, confirmed: 0 });
  }
});

test('Status handler verifies the trusted amount even when the order amount is forged', async () => {
  const calls = { gateway: 0, confirmed: 0 };
  const response = await loadRoute('status', {
    'orders/ORDER_A': { ownerUid: 'CUSTOMER_A', payment: { status: 'Pending', phonepeMerchantOrderId: 'TN123', amount: 1 } },
    'phonepePaymentAttempts/TN123': attempt,
  }, calls)(request({ orderId: 'ORDER_A' }));
  assert.equal(response.status, 200);
  assert.equal(response.body.paid, true);
  assert.deepEqual(calls, { gateway: 1, confirmed: 1 });
});

test('Checkout handler refuses legacy or forged cached redirect metadata', async () => {
  const calls = { gateway: 0, confirmed: 0 };
  const response = await loadRoute('create-order', {
    'orders/ORDER_A': { ownerUid: 'CUSTOMER_A', payment: {
      status: 'Pending', phonepeMerchantOrderId: 'TN123',
      phonepeRedirectUrl: 'https://attacker.example', phonepeInitiatedAt: Date.now(),
      phonepeReturnUrl: 'https://vendor.example/payment/phonepe/return',
    } },
  }, calls)(request({ orderId: 'ORDER_A', creditAmount: 0 }));
  assert.equal(response.status, 409);
  assert.deepEqual(calls, { gateway: 0, confirmed: 0 });
});

test('Trusted attempts require the exact order, customer and gateway reference', () => {
  assert.equal(isTrustedPaymentAttempt(attempt, 'ORDER_A', 'CUSTOMER_A', 'TN123'), true);
  assert.equal(isTrustedPaymentAttempt(attempt, 'ORDER_B', 'CUSTOMER_A', 'TN123'), false);
  assert.equal(isTrustedPaymentAttempt(attempt, 'ORDER_A', 'CUSTOMER_B', 'TN123'), false);
  assert.equal(isTrustedPaymentAttempt(attempt, 'ORDER_A', 'CUSTOMER_A', 'TN999'), false);
  assert.equal(isTrustedPaymentAttempt(undefined, 'ORDER_A', 'CUSTOMER_A', 'TN123'), false);
});

test('Invalid trusted payment amounts and credits are rejected', () => {
  for (const amount of [0, -1, NaN, Infinity, 0.001, '350']) {
    assert.equal(isTrustedPaymentAttempt({ ...attempt, amount }, 'ORDER_A', 'CUSTOMER_A', 'TN123'), false);
  }
  for (const creditApplied of [-1, 0.5, NaN, '0']) {
    assert.equal(isTrustedPaymentAttempt({ ...attempt, creditApplied }, 'ORDER_A', 'CUSTOMER_A', 'TN123'), false);
  }
});

// Source assertions supplement unit tests; they are not emulator rule evaluation.
test('Actual rules forbid customer gateway metadata and private attempt access', () => {
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.match(rules, /request\.resource\.data\.payment is map/);
  assert.match(rules, /request\.resource\.data\.payment\.keys\(\)\.hasOnly\(\['status'\]\)/);
  assert.match(rules, /request\.resource\.data\.orderId == orderId/);
  assert.match(rules, /match \/phonepePaymentAttempts\/\{attemptId\}\s*\{\s*allow read, write: if false;/);
});

test('Verification and reuse read server-owned attempt records', () => {
  for (const route of ['create-order', 'status', 'webhook']) {
    const source = readFileSync(new URL(`../app/api/payment/phonepe/${route}/route.ts`, import.meta.url), 'utf8');
    assert.match(source, /collection\('phonepePaymentAttempts'\)/);
    assert.match(source, /isTrustedPaymentAttempt\(/);
    assert.doesNotMatch(source, /phonepePaymentAttempts\?\.find/);
    assert.doesNotMatch(source, /paymentAttempt\?\.amount \?\? order\.payment\?\.amount/);
    if (route === 'create-order') {
      assert.match(source, /if \(previousMerchantOrderId && !previousAttempt\)/);
    }
  }
});
