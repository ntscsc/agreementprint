import test from 'node:test';
import assert from 'node:assert/strict';

// Validation helpers
export function validatePhone(phone: string): boolean {
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.length === 12 && clean.startsWith('91')) {
    clean = clean.slice(2);
  } else if (clean.length === 11 && clean.startsWith('0')) {
    clean = clean.slice(1);
  }
  return /^[6-9]\d{9}$/.test(clean);
}

export function validateAadhaar(aadhaar?: string): boolean {
  if (!aadhaar || aadhaar.trim() === '') return true; // optional
  const clean = aadhaar.replace(/[\s-]/g, '');
  return /^\d{4,12}$/.test(clean);
}

export function validateAadhaarLast4(aadhaar?: string): boolean {
  return validateAadhaar(aadhaar);
}

export function validatePan(pan: string): boolean {
  if (!pan) return true; // optional
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan);
}

export function validateFileType(mimeType: string): boolean {
  const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
  return allowed.includes(mimeType);
}

export function validateFileSize(sizeBytes: number): boolean {
  const max = 5 * 1024 * 1024; // 5 MB
  return sizeBytes > 0 && sizeBytes <= max;
}

test('Phone Number Validation: Indian 10-digit mobile standards', () => {
  assert.equal(validatePhone('9876543210'), true, 'Valid 9-series mobile');
  assert.equal(validatePhone('8123456789'), true, 'Valid 8-series mobile');
  assert.equal(validatePhone('7012345678'), true, 'Valid 7-series mobile');
  assert.equal(validatePhone('6381234567'), true, 'Valid 6-series mobile');
  assert.equal(validatePhone('+91 98765 43210'), true, 'Valid formatted mobile');

  assert.equal(validatePhone('5123456789'), false, 'Cannot start with 5');
  assert.equal(validatePhone('1234567890'), false, 'Cannot start with 1');
  assert.equal(validatePhone('987654321'), false, 'Too short (9 digits)');
  assert.equal(validatePhone('98765432101'), false, 'Too long (11 digits)');
  assert.equal(validatePhone(''), false, 'Empty phone is invalid');
});

test('Aadhaar Number: Optional and accepts standard numeric identification', () => {
  assert.equal(validateAadhaar(''), true, 'Empty Aadhaar allowed because it is optional');
  assert.equal(validateAadhaar('1234'), true, '4 digits allowed');
  assert.equal(validateAadhaar('123456789012'), true, 'Full 12-digit Aadhaar allowed');
  assert.equal(validateAadhaar('1234 5678 9012'), true, 'Formatted 12-digit Aadhaar allowed');
  assert.equal(validateAadhaar('abcd'), false, 'Non-numeric letters rejected');
});

test('PAN Number Validation (Optional)', () => {
  assert.equal(validatePan(''), true, 'Empty PAN allowed because it is optional');
  assert.equal(validatePan('ABCDE1234F'), true, 'Valid Indian PAN');
  assert.equal(validatePan('abcde1234f'), false, 'Lowercase must be formatted/rejected');
  assert.equal(validatePan('ABCDE12345'), false, 'Invalid format (last char must be letter)');
  assert.equal(validatePan('12345ABCDE'), false, 'Invalid format (must start with letters)');
});

test('Document Proofs: File format and size limits', () => {
  assert.equal(validateFileType('image/jpeg'), true, 'JPEG accepted');
  assert.equal(validateFileType('image/png'), true, 'PNG accepted');
  assert.equal(validateFileType('application/pdf'), true, 'PDF accepted');

  assert.equal(validateFileType('image/webp'), false, 'WebP rejected');
  assert.equal(validateFileType('image/gif'), false, 'GIF rejected');
  assert.equal(validateFileType('application/msword'), false, 'Word doc rejected');
  assert.equal(validateFileType('application/octet-stream'), false, 'Binary rejected');

  assert.equal(validateFileSize(1024), true, '1 KB accepted');
  assert.equal(validateFileSize(4.5 * 1024 * 1024), true, '4.5 MB accepted');
  assert.equal(validateFileSize(5 * 1024 * 1024), true, 'Exact 5 MB accepted');
  assert.equal(validateFileSize(5.1 * 1024 * 1024), false, '5.1 MB rejected');
  assert.equal(validateFileSize(0), false, '0 bytes rejected');
});
