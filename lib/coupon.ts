export const MAX_COUPON_DISCOUNT = 100_000;

export function isValidCouponCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z0-9]{5,20}$/.test(value);
}

export function isValidCouponDiscount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= MAX_COUPON_DISCOUNT;
}

export function couponDiscountAmount(code: Record<string, unknown>, settings: Record<string, unknown> = {}): number {
  const amount = code.kind === 'agent'
    ? code.customerDiscountAmount ?? code.discountAmount ?? 0
    : settings.refereeDiscountAmount ?? settings.customerDiscountAmount ?? 0;
  if (!isValidCouponDiscount(amount)) throw new Error('Invalid new-customer discount configuration.');
  return amount;
}

export function couponTotal(subtotal: number, discountAmount: number) {
  if (!Number.isSafeInteger(subtotal) || subtotal < 1 || !isValidCouponDiscount(discountAmount)) throw new Error('Invalid coupon pricing.');
  const couponDiscount = Math.min(subtotal, discountAmount);
  return { subtotal, couponDiscount, total: subtotal - couponDiscount };
}
