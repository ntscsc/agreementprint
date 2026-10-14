import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const require = createRequire(import.meta.url), ts = require('typescript');
function harness() {
  let record: Record<string, unknown> = { amount: 100, state: 'PENDING' };
  class ApiInputError extends Error { status: number; constructor(message: string, status: number) { super(message); this.status = status; } }
  const db = { collection: () => ({ doc: () => ({}) }), runTransaction: async (callback: (tx: unknown) => Promise<void>) => callback({ get: async () => ({ exists: true, data: () => record }), update: (_ref: unknown, value: object) => { record = { ...record, ...value }; } }) };
  const target = { exports: {} as { settleTestPayment: (id: string, amount: unknown, state: string, transaction?: string) => Promise<void> } };
  const source = readFileSync(new URL('../lib/phonepe-test-payment.ts', import.meta.url), 'utf8');
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: target.exports, module: target, Date, require: (name: string) => name === '@/lib/firebase-admin' ? { getAdminDb: () => db } : { ApiInputError } });
  return { settle: target.exports.settleTestPayment, read: () => record };
}
test('incorrect amount cannot confirm a test payment', async () => {
  const h = harness();
  await assert.rejects(h.settle('TEST', 200, 'COMPLETED'), /amount did not match/);
  assert.equal(h.read().state, 'PENDING');
});
test('confirmed Rs1 payment records its transaction', async () => {
  const h = harness(); await h.settle('TEST', 100, 'COMPLETED', 'transaction');
  assert.equal(h.read().state, 'COMPLETED'); assert.equal(h.read().transactionId, 'transaction');
});
test('delayed failure cannot undo a confirmed payment', async () => {
  const h = harness(); await h.settle('TEST', 100, 'COMPLETED'); await h.settle('TEST', 100, 'FAILED');
  assert.equal(h.read().state, 'COMPLETED');
});
