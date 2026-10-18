/** Mask at render time so legacy records containing a full number stay private. */
export function maskedAadhaar(value: unknown): string {
  if (typeof value !== 'string' && !(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)) return 'Not provided';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length < 4 || digits.length > 12) return 'Not provided';
  return `XXXX-XXXX-${digits.slice(-4)}`;
}
