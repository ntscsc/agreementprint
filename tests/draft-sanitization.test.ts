import test from 'node:test';
import assert from 'node:assert/strict';
import { omitUndefinedValues } from '../lib/firestore-data.ts';
import { restoreAgreementTerms } from '../lib/agreement-draft.ts';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

test('Customer clarification is validated and written with the correction status', async () => {
  const require = createRequire(import.meta.url), ts = require('typescript');
  const writes: any[] = [];
  const source = readFileSync(new URL('../lib/order-service.ts', import.meta.url), 'utf8');
  const target = { exports: {} as any };
  const dependencies: Record<string, unknown> = {
    '@/lib/agreement-validation': {},
    'firebase/firestore': { doc: (_db: unknown, collection: string, id: string) => `${collection}/${id}`, updateDoc: async (path: string, data: unknown) => { writes.push({ path, data }); } },
    './firebase': { db: {}, auth: { currentUser: { uid: 'customer' } } },
    './firestore-errors': { OperationType: { UPDATE: 'update' }, handleFirestoreError: (error: unknown) => { throw error; } },
    './firestore-data': { omitUndefinedValues },
    '@/src/config/admin': {},
  };
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    module: target, exports: target.exports, require: (name: string) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    }, Date,
  });
  await target.exports.submitDocumentCorrection('order-1', { customerClarification: '  Please correct the spelling.  ' });
  assert.equal(writes[0].path, 'orders/order-1');
  assert.equal(writes[0].data.customerClarification, 'Please correct the spelling.');
  assert.equal(writes[0].data.status, 'Under verification');
  for (const customerClarification of ['', 'tiny', 'x'.repeat(3001), 123]) {
    await assert.rejects(target.exports.submitDocumentCorrection('order-1', { customerClarification }), /between 5 and 3000/);
  }
  assert.equal(writes.length, 1);
});

test('New/reset forms and legacy drafts retain an explicit boolean notary selection', () => {
  assert.equal(restoreAgreementTerms().includeNotary, false);
  const saved = { monthlyRent: 12345, startDate: '2026-10-15', stampPaperDenomination: 200 as const };
  const restored = restoreAgreementTerms(saved);
  assert.equal(restored.includeNotary, false);
  assert.equal(restored.monthlyRent, 12345);
  assert.equal(restored.startDate, saved.startDate);
  assert.equal(restored.stampPaperDenomination, 200);
  for (const includeNotary of [false, true]) {
    const persisted = omitUndefinedValues(restoreAgreementTerms({ ...saved, includeNotary }));
    assert.equal(restoreAgreementTerms(persisted).includeNotary, includeNotary);
  }
  assert.equal(restoreAgreementTerms({ includeNotary: undefined }).includeNotary, false);
  // Runtime malformed data must not turn a string "false" into a paid add-on.
  assert.equal(restoreAgreementTerms({ includeNotary: 'false' as unknown as boolean }).includeNotary, 'false');
});

test('Draft sanitization omits undefined nested fields and preserves entered values', () => {
  const draft = omitUndefinedValues({
    agreementTerms: {
      monthlyRent: undefined,
      securityDeposit: 50000,
      maintenanceCharges: 0,
      deliveryRecipient: undefined,
    },
    ownerDetails: {
      fullName: 'A. Owner',
      aadhaarLast4: undefined,
    },
  });

  assert.deepEqual(draft, {
    agreementTerms: {
      securityDeposit: 50000,
      maintenanceCharges: 0,
    },
    ownerDetails: {
      fullName: 'A. Owner',
    },
  });
});

test('Draft sanitization replaces undefined array entries with Firestore-safe nulls', () => {
  assert.deepEqual(omitUndefinedValues([1, undefined, 3]), [1, null, 3]);
});
