import test from 'node:test';
import assert from 'node:assert/strict';
import { isChennaiPincode, detectCourierRegion, extractPincode } from '../lib/pincode-utils.ts';

test('Pincode Utils: Chennai PIN codes detection (600xxx)', () => {
  // Chennai district and suburban PIN codes (600001 - 600134)
  assert.equal(isChennaiPincode('600001'), true); // Chennai GPO
  assert.equal(isChennaiPincode('600028'), true); // Mylapore / RA Puram
  assert.equal(isChennaiPincode('600040'), true); // Anna Nagar
  assert.equal(isChennaiPincode('600096'), true); // Perungudi / OMR
  assert.equal(isChennaiPincode('600 100'), true); // Medavakkam with space

  // Non-Chennai Tamil Nadu PIN codes
  assert.equal(isChennaiPincode('625001'), false); // Madurai
  assert.equal(isChennaiPincode('641001'), false); // Coimbatore
  assert.equal(isChennaiPincode('620001'), false); // Trichy
  assert.equal(isChennaiPincode('636001'), false); // Salem
  assert.equal(isChennaiPincode('627001'), false); // Tirunelveli

  // Other states & invalid codes
  assert.equal(isChennaiPincode('560001'), false); // Bengaluru
  assert.equal(isChennaiPincode('110001'), false); // New Delhi
  assert.equal(isChennaiPincode(''), false);
  assert.equal(isChennaiPincode(null), false);
});

test('Pincode Utils: Address & City Region Auto-Detection', () => {
  // Chennai Pincode
  assert.equal(
    detectCourierRegion({ pincode: '600028' }),
    'Within Chennai'
  );

  // Other Tamil Nadu Pincode
  assert.equal(
    detectCourierRegion({ pincode: '641018' }),
    'Within Tamil Nadu'
  );
  assert.equal(
    detectCourierRegion({ pincode: '605757' }),
    'Within Tamil Nadu'
  );

  // City based detection
  assert.equal(
    detectCourierRegion({ city: 'Chennai' }),
    'Within Chennai'
  );
  assert.equal(
    detectCourierRegion({ city: 'chennai' }),
    'Within Chennai'
  );

  // Address string extraction
  assert.equal(
    detectCourierRegion({ address: 'Flat 4B, 3rd Cross Street, T. Nagar, Chennai 600017' }),
    'Within Chennai'
  );
  assert.equal(
    detectCourierRegion({ address: 'Door 12, West Masi Street, Madurai 625001' }),
    'Within Tamil Nadu'
  );
});

test('Pincode Utils: Extract 6-digit PIN code from text', () => {
  assert.equal(extractPincode('Chennai 600028, Tamil Nadu'), '600028');
  assert.equal(extractPincode('No pincode mentioned here'), null);
});
