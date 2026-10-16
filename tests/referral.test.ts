import test from 'node:test';
import assert from 'node:assert/strict';
import { couponTotal, couponDiscountAmount, isValidCouponCode, isValidCouponDiscount } from '../lib/coupon.ts';

test('Customer coupons share one value while agent amounts remain independent', () => {
  const settings = { customerDiscountAmount: 80 };
  assert.equal(couponDiscountAmount({ uid: 'customer-a', discountAmount: 10 }, settings), 80);
  assert.equal(couponDiscountAmount({ kind: 'customer', uid: 'customer-b', discountAmount: 999 }, settings), 80);
  assert.equal(couponDiscountAmount({ kind: 'agent', discountAmount: 150 }, settings), 150);
  assert.equal(couponDiscountAmount({ kind: 'agent', customerDiscountAmount: 50, discountAmount: 150 }, settings), 50);
  assert.equal(couponDiscountAmount({ kind: 'customer' }, { ...settings, refereeDiscountAmount: 60 }), 60);
  assert.equal(couponDiscountAmount({ uid: 'new-customer' }), 0);
  assert.throws(() => couponDiscountAmount({ uid: 'customer' }, { customerDiscountAmount: '80' }), /Invalid/);
});

test('Coupon amounts are bounded whole rupees and cannot make an order negative', () => {
  assert.deepEqual(couponTotal(350, 100), { subtotal: 350, couponDiscount: 100, total: 250 });
  assert.deepEqual(couponTotal(350, 500), { subtotal: 350, couponDiscount: 350, total: 0 });
  for (const amount of [-1, 1.5, Infinity, NaN, 100001, '100', null]) assert.equal(isValidCouponDiscount(amount), false);
  for (const code of ['WELCOME100', 'AGRAVI2026', 'A1B2C3D4E5F6']) assert.equal(isValidCouponCode(code), true);
  for (const code of ['ABCD', 'A'.repeat(21), 'welcome100', '../CODE', null]) assert.equal(isValidCouponCode(code), false);
});
import {
  calculateReferralCredit,
  isValidReferralCode,
  isValidReferralRewardAmount,
  normalizeReferralCode,
  isValidAgentCode,
} from '../lib/referral-utils.ts';

test('Referral codes normalize for sharing and validate as generated codes', () => {
  assert.equal(normalizeReferralCode(' ab12 cd-34ef '), 'AB12CD34EF');
  assert.equal(isValidReferralCode('A1B2C3D4E5F6'), true);
  assert.equal(isValidReferralCode('A1B2C3D4E5F'), false);
  assert.equal(isValidReferralCode('A1B2C3D4E5FG'), false);
});

test('Agent codes allow names in a distinct bounded namespace', () => {
  assert.equal(isValidAgentCode('AGRAVI2026'), true);
  assert.equal(isValidReferralCode('AGRAVI2026'), true);
  assert.equal(isValidAgentCode('AGABC'), true);
  for (const code of ['AG', 'AGAB', 'RAVI2026', 'AGravi', 'AG/RAVI', 'AG' + 'A'.repeat(19)]) {
    assert.equal(isValidAgentCode(code), false, code);
  }
  assert.equal(isValidAgentCode('A1B2C3D4E5F6'), false);
  assert.equal(normalizeReferralCode(' ag-ravi 2026 '), 'AGRAVI2026');
});

test('Referral credit is limited by balance and checkout amount', () => {
  assert.equal(calculateReferralCredit(100, 250, 400), 100);
  assert.equal(calculateReferralCredit(250, 200, 400), 200);
  assert.equal(calculateReferralCredit(500, 600, 400), 400);
  assert.equal(calculateReferralCredit(-1, 200, 400), -1);
  assert.equal(calculateReferralCredit(1.5, 200, 400), -1);
});

test('Referral reward amount accepts bounded whole-rupee values', () => {
  assert.equal(isValidReferralRewardAmount(0), true);
  assert.equal(isValidReferralRewardAmount(100), true);
  assert.equal(isValidReferralRewardAmount(100_001), false);
  assert.equal(isValidReferralRewardAmount(1.5), false);
  assert.equal(isValidReferralRewardAmount('100'), false);
});
