/**
 * Pincode and Region detection utilities for Tamil Nadu and Chennai.
 * Chennai postal delivery offices span the 600xxx PIN code series (600001 to 600134+).
 */

/**
 * Checks whether a 6-digit pincode falls within the Chennai postal division (600xxx).
 */
export function isChennaiPincode(pincode?: string | null): boolean {
  if (!pincode) return false;
  const digits = pincode.toString().replace(/[^0-9]/g, '');
  return /^600\d{3}$/.test(digits);
}

/**
 * Extracts a 6-digit Indian PIN code from address text.
 */
export function extractPincode(text?: string | null): string | null {
  if (!text) return null;
  const match = text.match(/\b(6\d{5})\b/);
  return match ? match[1] : null;
}

/**
 * Determines whether a customer's address details place them in Chennai or other Tamil Nadu regions.
 * Returns 'Within Chennai' (Rs. 350 package) or 'Within Tamil Nadu' (Rs. 400 package).
 */
export function detectCourierRegion(params: {
  pincode?: string | null;
  city?: string | null;
  address?: string | null;
}): 'Within Chennai' | 'Within Tamil Nadu' | null {
  // 1. Direct Pincode check
  if (params.pincode) {
    const cleanPin = params.pincode.toString().replace(/[^0-9]/g, '');
    if (cleanPin.length === 6) {
      if (isChennaiPincode(cleanPin)) {
        return 'Within Chennai';
      }
      if (/^6\d{5}$/.test(cleanPin)) {
        return 'Within Tamil Nadu';
      }
    }
  }

  // 2. City name check
  if (params.city) {
    const cleanCity = params.city.trim().toLowerCase();
    if (cleanCity === 'chennai' || cleanCity.includes('chennai') || cleanCity === 'madras') {
      return 'Within Chennai';
    }
  }

  // 3. Address text inspection for embedded PIN or Chennai locality
  if (params.address) {
    const extracted = extractPincode(params.address);
    if (extracted) {
      if (isChennaiPincode(extracted)) {
        return 'Within Chennai';
      }
      return 'Within Tamil Nadu';
    }
    if (/\b(chennai|madras)\b/i.test(params.address)) {
      return 'Within Chennai';
    }
  }

  return null;
}
