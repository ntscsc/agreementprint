// These records live in a collection denied to all Firebase client SDKs.
// Never infer gateway ownership or amounts from customer-created order fields.
export interface TrustedPaymentAttempt {
  orderId: string;
  ownerUid: string;
  merchantOrderId: string;
  amount: number;
  initiatedAt: number;
  creditApplied: number;
  redirectUrl: string;
  returnUrl: string;
  subtotal?: number;
  couponDiscount?: number;
  couponCode?: string;
}

export function isTrustedPaymentAttempt(
  value: unknown,
  orderId: string,
  ownerUid: string,
  merchantOrderId: string,
): value is TrustedPaymentAttempt {
  if (!value || typeof value !== 'object') return false;
  const attempt = value as Record<string, unknown>;
  if (attempt.couponDiscount !== undefined || attempt.subtotal !== undefined || attempt.couponCode !== undefined) {
    if (typeof attempt.subtotal !== 'number' || !Number.isSafeInteger(attempt.subtotal) || attempt.subtotal < 1 ||
        typeof attempt.couponDiscount !== 'number' || !Number.isSafeInteger(attempt.couponDiscount) || attempt.couponDiscount < 0 || attempt.couponDiscount > attempt.subtotal ||
        typeof attempt.couponCode !== 'string' || (attempt.couponCode !== '' && !/^[A-Z0-9]{5,20}$/.test(attempt.couponCode)) ||
        typeof attempt.amount !== 'number' || typeof attempt.creditApplied !== 'number' ||
        attempt.subtotal !== attempt.amount + attempt.creditApplied + attempt.couponDiscount) return false;
  }
  return attempt.orderId === orderId && attempt.ownerUid === ownerUid &&
    attempt.merchantOrderId === merchantOrderId &&
    typeof attempt.amount === 'number' && Number.isSafeInteger(attempt.amount * 100) && attempt.amount > 0 &&
    typeof attempt.initiatedAt === 'number' && Number.isSafeInteger(attempt.initiatedAt) && attempt.initiatedAt > 0 &&
    typeof attempt.creditApplied === 'number' && Number.isSafeInteger(attempt.creditApplied) && attempt.creditApplied >= 0 &&
    typeof attempt.redirectUrl === 'string' && typeof attempt.returnUrl === 'string';
}
