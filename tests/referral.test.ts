import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateReferralCredit,
  isValidReferralCode,
  isValidReferralRewardAmount,
  normalizeReferralCode,
} from '../lib/referral-utils.ts';

test('Referral codes normalize for sharing and validate as generated codes', () => {
  assert.equal(normalizeReferralCode(' ab12 cd-34ef '), 'AB12CD34EF');
  assert.equal(isValidReferralCode('A1B2C3D4E5F6'), true);
  assert.equal(isValidReferralCode('A1B2C3D4E5F'), false);
  assert.equal(isValidReferralCode('A1B2C3D4E5FG'), false);
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
