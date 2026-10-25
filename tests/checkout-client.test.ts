import { indianLoginPhone, phoneAuthError } from '../lib/phone-auth.ts';
import { emailAuthError } from '../lib/auth-errors.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

function client(approve: boolean, quote: unknown = { quoteRequired: true, reviewedTotal: 400, creditApplied: 100, amountDue: 300 }) {
  const require = createRequire(import.meta.url);
  const ts = require('typescript');
  const source = readFileSync(new URL('../lib/checkout-client.ts', import.meta.url), 'utf8');
  const target = { exports: {} as { requestReviewedCheckout: (body: unknown, token: string) => Promise<unknown> } };
  const sent: any[] = [];
  const prompts: string[] = [];
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText, {
    module: target, exports: target.exports,
    window: { confirm: (message: string) => { prompts.push(message); return approve; } },
    fetch: async (_url: string, options: { body: string }) => {
      sent.push(JSON.parse(options.body));
      return { status: 409, clone: () => ({ json: async () => { if (quote instanceof Error) throw quote; return quote; } }) };
    },
  });
  return { request: target.exports.requestReviewedCheckout, sent, prompts };
}

test('Changed prices require review and a fresh server check; repeated conflicts cannot loop', async () => {
  const app = client(true);
  await app.request({ orderId: 'ORDER', reviewedTotal: 350 }, 'token');
  assert.equal(app.sent.length, 2);
  assert.equal(app.sent[1].reviewedTotal, 400);
  assert.equal(app.prompts.length, 1);
  assert.match(app.prompts[0], /Amount due: ₹300/);
});

test('Declining a revised quote never starts another checkout request', async () => {
  const app = client(false);
  await assert.rejects(app.request({ orderId: 'ORDER' }, 'token'), /Payment was not started/);
  assert.equal(app.sent.length, 1);
});

test('Malformed conflict responses cannot show a price prompt or trigger checkout retries', async () => {
  for (const quote of [null, [], 'HTML error', new SyntaxError('Unexpected token <')]) {
    const app = client(true, quote);
    await app.request({ orderId: 'ORDER' }, 'token');
    assert.equal(app.sent.length, 1);
    assert.equal(app.prompts.length, 0);
  }
});

test('A full coupon discount can be reviewed and retried with a zero payable total', async () => {
  const app = client(true, { quoteRequired: true, subtotal: 350, couponDiscount: 350, reviewedTotal: 0, creditApplied: 0, amountDue: 0 });
  await app.request({ orderId: 'ORDER', reviewedTotal: 350 }, 'token');
  assert.equal(app.sent.length, 2);
  assert.equal(app.sent[1].reviewedTotal, 0);
  assert.match(app.prompts[0], /Coupon discount: −₹350/);
  assert.match(app.prompts[0], /Amount due: ₹0/);
});


test('email sign-in gives actionable errors without exposing provider responses', () => {
  assert.equal(emailAuthError({ code: 'auth/wrong-password' }), emailAuthError({ code: 'auth/user-not-found' }));
  assert.match(emailAuthError({ code: 'auth/operation-not-allowed' }), /not enabled/);
  assert.match(emailAuthError({ code: 'auth/too-many-requests' }), /wait/);
  assert.match(emailAuthError({ code: 'auth/network-request-failed' }), /connection/);
  assert.match(emailAuthError({ code: 'auth/weak-password' }), /8 characters/);
  assert.doesNotMatch(emailAuthError(new Error('private-provider-debug-data')), /private-provider/);
});


test('phone login accepts Indian mobiles and reports safe OTP errors', () => {
  assert.equal(indianLoginPhone('9876543210'), '+919876543210');
  assert.equal(indianLoginPhone('+91 98765 43210'), '+919876543210');
  for (const number of ['123', '1234567890', '+1 2345678901', '']) assert.throws(() => indianLoginPhone(number));
  assert.match(phoneAuthError({ code: 'auth/invalid-verification-code' }), /incorrect/);
  assert.match(phoneAuthError({ code: 'auth/code-expired' }), /expired/);
  assert.match(phoneAuthError({ code: 'auth/billing-not-enabled' }), /email or Google/);
  assert.match(phoneAuthError({ code: 'auth/quota-exceeded' }), /Wait/);
  assert.doesNotMatch(phoneAuthError(new Error('secret-provider-details')), /secret-provider/);
});
