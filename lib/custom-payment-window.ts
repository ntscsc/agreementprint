export const CUSTOM_PAYMENT_WAIT_MS = 20 * 60 * 1000;
export function customPaymentRetryAt(attempt: { resumedAt?: string; initiatedAt?: string }, fallback?: string): number | null {
  const started = Date.parse(attempt.resumedAt || attempt.initiatedAt || fallback || '');
  return Number.isFinite(started) ? started + CUSTOM_PAYMENT_WAIT_MS : null;
}
