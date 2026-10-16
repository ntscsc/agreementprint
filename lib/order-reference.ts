// Keep references as strings: sixteen-digit IDs can exceed JavaScript's safe
// integer range. Rejection sampling produces unbiased, cryptographically random
// decimal digits, with no leading zero to lose when sharing a reference.
export function createOrderReference(): string {
  let reference = '';
  while (reference.length < 16) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    for (const byte of bytes) {
      if (byte >= 250) continue;
      const digit = byte % 10;
      if (!reference && digit === 0) continue;
      reference += String(digit);
      if (reference.length === 16) break;
    }
  }
  return reference;
}
