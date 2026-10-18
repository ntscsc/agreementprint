import test from 'node:test';
import assert from 'node:assert/strict';
import { maskedAadhaar } from '../lib/identity-display.ts';
import { DEFAULT_PRICING, MAX_PRICING_AMOUNT, PRICING_MINIMUMS, pricingFieldError, validatePricingConfig, type PricingField } from '../src/config/pricing.ts';

test('Legacy full-length and formatted Aadhaar values expose only the final four digits', () => {
  for (const value of ['123456789012', '1234 5678 9012', '1234-5678-9012', 123456789012, '9012', 'XXXX-XXXX-9012']) {
    assert.equal(maskedAadhaar(value), 'XXXX-XXXX-9012');
    assert.ok(!maskedAadhaar(value).includes('1234'));
    assert.ok(!maskedAadhaar(value).includes('5678'));
  }
  assert.equal(maskedAadhaar('123456780012'), 'XXXX-XXXX-0012');
});

test('Missing or unusable Aadhaar displays Not provided instead of an incomplete mask', () => {
  for (const value of [undefined, null, '', '   ', 'XXXX-XXXX-', 'abc', '123', {}, NaN, Infinity, '1234567890123']) assert.equal(maskedAadhaar(value), 'Not provided');
});

test('Inline pricing validity agrees with save validation for every pricing field', () => {
  for (const field of Object.keys(PRICING_MINIMUMS) as PricingField[]) {
    for (const value of [-1, NaN, Infinity, 0.5, '', undefined, MAX_PRICING_AMOUNT + 1, PRICING_MINIMUMS[field] - 1]) {
      assert.ok(pricingFieldError(field, value), `${field}: ${value}`);
      assert.throws(() => validatePricingConfig({ ...DEFAULT_PRICING, [field]: value }));
    }
    for (const value of [PRICING_MINIMUMS[field], DEFAULT_PRICING[field], MAX_PRICING_AMOUNT]) {
      assert.equal(pricingFieldError(field, value), null);
      assert.doesNotThrow(() => validatePricingConfig({ ...DEFAULT_PRICING, [field]: value }));
    }
  }
  assert.equal(pricingFieldError('notaryExtraFee', 0), null);
});
