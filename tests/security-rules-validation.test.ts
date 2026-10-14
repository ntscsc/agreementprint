import test from 'node:test';
import assert from 'node:assert/strict';

// Structural rule validator representing the logic encoded in firestore.rules
interface OrderDataMock {
  orderId: string;
  ownerUid: string;
  customerEmail: string;
  status: string;
  payment: { status: string; amount?: number };
  courier?: unknown;
  correctionMessage?: unknown;
  [key: string]: unknown;
}

const ALLOWED_ORDER_KEYS = [
  'orderId',
  'ownerUid',
  'referralCode',
  'customerEmail',
  'customerPhone',
  'ownerDetails',
  'tenantDetails',
  'propertyDetails',
  'agreementTerms',
  'proofUploads',
  'status',
  'payment',
  'notes',
  'createdAt',
  'updatedAt',
];

function canCustomerCreateOrder(
  auth: { uid: string } | null,
  orderData: OrderDataMock
): { allowed: boolean; reason?: string } {
  if (!auth) return { allowed: false, reason: 'Unauthenticated' };
  if (orderData.ownerUid !== auth.uid) {
    return { allowed: false, reason: 'ownerUid does not match auth.uid' };
  }
  if (orderData.status !== 'Submitted') {
    return { allowed: false, reason: 'Initial status must be Submitted' };
  }
  if (orderData.payment?.status !== 'Pending') {
    return { allowed: false, reason: 'Payment status must be Pending on create' };
  }
  if (Object.keys(orderData.payment).some((key) => key !== 'status')) {
    return { allowed: false, reason: 'Gateway payment metadata is server-managed' };
  }
  if ('courier' in orderData) {
    return { allowed: false, reason: 'courier is disallowed on create' };
  }
  if ('correctionMessage' in orderData) {
    return { allowed: false, reason: 'correctionMessage is disallowed on create' };
  }

  const keys = Object.keys(orderData);
  const invalidKeys = keys.filter((k) => !ALLOWED_ORDER_KEYS.includes(k));
  if (invalidKeys.length > 0) {
    return { allowed: false, reason: `Disallowed keys: ${invalidKeys.join(', ')}` };
  }

  return { allowed: true };
}

function canCustomerUpdateOrder(
  auth: { uid: string; email?: string; email_verified?: boolean } | null,
  existingDoc: OrderDataMock,
  incomingDoc: OrderDataMock
): { allowed: boolean; reason?: string } {
  if (!auth) return { allowed: false, reason: 'Unauthenticated' };
  const isAdmin = (auth.email === 'pradhiip92@gmail.com' || auth.email === 'pradeep1992official@gmail.com') && auth.email_verified === true;
  if (isAdmin) return { allowed: true }; // Admin can update

  const isOwner = auth.uid === existingDoc.ownerUid;
  if (!isOwner) return { allowed: false, reason: 'Not owner or admin' };

  // Owner update condition
  if (existingDoc.status !== 'Documents needed') {
    return { allowed: false, reason: 'Owner can only update when status is Documents needed' };
  }
  if (incomingDoc.status !== 'Under verification') {
    return { allowed: false, reason: 'Owner update must transition to Under verification' };
  }
  if (incomingDoc.ownerUid !== existingDoc.ownerUid || incomingDoc.orderId !== existingDoc.orderId) {
    return { allowed: false, reason: 'Immutable fields changed' };
  }
  if (JSON.stringify(incomingDoc.payment) !== JSON.stringify(existingDoc.payment)) {
    return { allowed: false, reason: 'Owner cannot alter payment' };
  }

  return { allowed: true };
}

test('Firestore Security Rules: Customer Order Creation Enforcement', () => {
  const validOrder: OrderDataMock = {
    orderId: 'TNR_001',
    ownerUid: 'user_123',
    customerEmail: 'user@example.com',
    status: 'Submitted',
    payment: { status: 'Pending' },
  };

  // Valid create
  assert.equal(canCustomerCreateOrder({ uid: 'user_123' }, validOrder).allowed, true);

  // Unauthenticated attempt
  assert.equal(canCustomerCreateOrder(null, validOrder).allowed, false);

  // Spoofed ownerUid
  assert.equal(
    canCustomerCreateOrder({ uid: 'attacker_999' }, validOrder).allowed,
    false,
    'Attacker cannot create order for another user'
  );

  // Client attempting to set payment as 'Paid'
  const paidOrder = { ...validOrder, payment: { status: 'Paid' } };
  assert.equal(
    canCustomerCreateOrder({ uid: 'user_123' }, paidOrder).allowed,
    false,
    'Client cannot bypass payment'
  );

  // Client attempting to sneak in courier or status: Dispatched
  const dispatchedOrder = { ...validOrder, status: 'Dispatched' };
  assert.equal(
    canCustomerCreateOrder({ uid: 'user_123' }, dispatchedOrder).allowed,
    false,
    'Client cannot skip status steps'
  );

  // Client attempting ghost field injection
  for (const payment of [
    { status: 'Pending', amount: 1 },
    { status: 'Pending', phonepeMerchantOrderId: 'STOLEN_ATTEMPT' },
    { status: 'Pending', phonepeRedirectUrl: 'https://attacker.example' },
    { status: 'Pending', phonepePaymentAttempts: [{ merchantOrderId: 'STOLEN_ATTEMPT', amount: 1 }] },
    { status: 'Pending', referralCreditApplied: 1000 },
  ]) {
    assert.equal(canCustomerCreateOrder({ uid: 'user_123' }, { ...validOrder, payment }).allowed, false);
  }

  const ghostFieldOrder = { ...validOrder, isVerifiedByVendor: true };
  assert.equal(
    canCustomerCreateOrder({ uid: 'user_123' }, ghostFieldOrder).allowed,
    false,
    'Ghost fields rejected by hasOnly'
  );
});

test('Firestore Security Rules: Status Transitions & Tamper Protection', () => {
  const existingOrder: OrderDataMock = {
    orderId: 'TNR_001',
    ownerUid: 'user_123',
    customerEmail: 'user@example.com',
    status: 'Submitted',
    payment: { status: 'Pending' },
  };

  // Owner cannot update while 'Submitted'
  const updateWhileSubmitted = { ...existingOrder, status: 'Drafting' };
  assert.equal(
    canCustomerUpdateOrder({ uid: 'user_123' }, existingOrder, updateWhileSubmitted).allowed,
    false,
    'Owner cannot update order in Submitted status'
  );

  // Owner cannot alter payment
  const docNeededOrder: OrderDataMock = { ...existingOrder, status: 'Documents needed' };
  const ownerTamperingPayment: OrderDataMock = {
    ...docNeededOrder,
    status: 'Under verification',
    payment: { status: 'Paid' },
  };
  assert.equal(
    canCustomerUpdateOrder({ uid: 'user_123' }, docNeededOrder, ownerTamperingPayment).allowed,
    false,
    'Owner cannot tamper with payment'
  );

  // Legitimate correction transition: Documents needed -> Under verification
  const legitimateCorrection: OrderDataMock = {
    ...docNeededOrder,
    status: 'Under verification',
  };
  assert.equal(
    canCustomerUpdateOrder({ uid: 'user_123' }, docNeededOrder, legitimateCorrection).allowed,
    true,
    'Owner correction allowed'
  );

  // Admin update always permitted
  assert.equal(
    canCustomerUpdateOrder(
      { uid: 'admin_1', email: 'pradhiip92@gmail.com', email_verified: true },
      existingOrder,
      {
        ...existingOrder,
        status: 'Drafting',
      }
    ).allowed,
    true,
    'Admin can transition status'
  );

  // Non-admin email cannot transition status
  assert.equal(
    canCustomerUpdateOrder(
      { uid: 'admin_1', email: 'other@example.com', email_verified: true },
      existingOrder,
      {
        ...existingOrder,
        status: 'Drafting',
      }
    ).allowed,
    false,
    'Non-admin cannot transition status'
  );
});
