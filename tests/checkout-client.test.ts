import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

function client(approve: boolean) {
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
      return { status: 409, clone: () => ({ json: async () => ({ quoteRequired: true, reviewedTotal: 400, creditApplied: 100, amountDue: 300 }) }) };
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
