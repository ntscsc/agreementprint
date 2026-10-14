import test from 'node:test';
import assert from 'node:assert/strict';
import { omitUndefinedValues } from '../lib/firestore-data.ts';

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
