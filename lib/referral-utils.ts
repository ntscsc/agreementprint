export const DEFAULT_REFERRAL_REWARD_AMOUNT = 100;
export const MAX_REFERRAL_REWARD_AMOUNT = 100_000;

export function normalizeReferralCode(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().replace(/[\s-]/g, '').toUpperCase()
    : '';
}

export function isValidReferralCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-F0-9]{12}$/.test(value);
}

export function calculateReferralCredit(
  requestedAmount: unknown,
  availableBalance: number,
  orderTotal: number,
): number {
  if (
    typeof requestedAmount !== 'number' ||
    !Number.isSafeInteger(requestedAmount) ||
    requestedAmount < 0 ||
    !Number.isSafeInteger(availableBalance) ||
    !Number.isSafeInteger(orderTotal)
  ) {
    return -1;
  }

  return Math.min(requestedAmount, availableBalance, orderTotal);
}

export function isValidReferralRewardAmount(amount: unknown): amount is number {
  return (
    typeof amount === 'number' &&
    Number.isSafeInteger(amount) &&
    amount >= 0 &&
    amount <= MAX_REFERRAL_REWARD_AMOUNT
  );
}
