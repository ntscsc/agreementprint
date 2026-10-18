import { before, after, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';

let env;
before(async () => {
  // Explicit local addresses and a demo project prevent production access.
  env = await initializeTestEnvironment({
    projectId: 'demo-stampsure-tests',
    firestore: { host: '127.0.0.1', port: 8085, rules: readFileSync('firestore.rules', 'utf8') },
    storage: { host: '127.0.0.1', port: 9195, rules: readFileSync('storage.rules', 'utf8') },
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await env.clearStorage(); });

const order = () => ({
  orderId: 'order-1', ownerUid: 'customer', customerEmail: 'customer@example.com',
  status: 'Submitted', payment: { status: 'Pending' }, createdAt: '2026-10-12', updatedAt: '2026-10-12',
  ownerDetails: { fullName: 'Owner Example', relativeName: 'Relative Example', age: 30, address: '12 Example Road Chennai', phone: '9876543210' },
  tenantDetails: { fullName: 'Tenant Example', relativeName: 'Relative Example', age: '25', address: '14 Example Road Chennai', phone: '9876543211' },
  propertyDetails: { fullAddress: '12 Example Road Chennai', city: 'Chennai', pincode: '600001', propertyType: 'Flat', furnishing: 'Unfurnished' },
  agreementTerms: { monthlyRent: 10000, securityDeposit: 20000, maintenanceCharges: 0, startDate: '2026-10-12', tenureMonths: 11, stampPaperDenomination: 100, deliveryLocation: 'Within Chennai', deliveryRecipient: 'Owner', includeNotary: false },
  proofUploads: {},
});
const db = (uid = 'customer', claims = {}) => env.authenticatedContext(uid, claims).firestore();
const admin = () => db('admin', { email: 'pradeep1992official@gmail.com', email_verified: true });
const seed = async (path, data) => env.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), path), data));

test('Tamil order language and painting deduction are validated without breaking legacy orders', async () => {
  const legacy = order();
  const tamil = { ...legacy, agreementTerms: { ...legacy.agreementTerms, language: 'Tamil', paintingDeduction: 0 } };
  let index = 0;
  const create = (data) => { const orderId = `tamil-order-${index++}`; return setDoc(doc(db(), 'orders', orderId), { ...data, orderId }); };
  await assertSucceeds(create(legacy));
  await assertSucceeds(create(tamil));
  for (const patch of [{ language: 'Other' }, { paintingDeduction: -1 }, { paintingDeduction: '5000' }]) {
    await assertFails(create({ ...tamil, agreementTerms: { ...tamil.agreementTerms, ...patch } }));
  }
  const missing = { ...tamil.agreementTerms }; delete missing.paintingDeduction;
  await assertFails(create({ ...tamil, agreementTerms: missing }));
  await assertSucceeds(create({ ...tamil, agreementTerms: missing, propertyDetails: { ...tamil.propertyDetails, propertyType: 'Commercial Shop', businessName: 'Test shop' } }));
  await assertFails(create({ ...tamil, agreementTerms: missing, propertyDetails: { ...tamil.propertyDetails, propertyType: 'Commercial Shop', businessName: '' } }));
});

test('agent attribution and rewards cannot be read or forged through client SDKs', async () => {
  await seed('agentReferralCustomers/customer', { code: 'AGRAVI', uid: 'customer', rewardStatus: 'Pending' });
  await seed('referralCodes/AGRAVI', { kind: 'agent', name: 'Ravi' });
  for (const client of [db(), db('other'), admin(), env.unauthenticatedContext().firestore()]) {
    await assertFails(getDoc(doc(client, 'agentReferralCustomers/customer')));
    await assertFails(setDoc(doc(client, 'agentReferralCustomers/forged'), { code: 'AGRAVI' }));
    await assertFails(updateDoc(doc(client, 'agentReferralCustomers/customer'), { rewardStatus: 'Rewarded' }));
    await assertFails(getDoc(doc(client, 'referralCodes/AGRAVI')));
    await assertFails(setDoc(doc(client, 'referralCodes/AGFORGED'), { kind: 'agent' }));
  }
});

test('Visitor counters and browser deduplication records stay private to server APIs', async () => {
  for (const path of ['visitorAnalytics/total','visitorRegistry/example','visitorAnalyticsLimits/global']) {
    await seed(path,{count:1});
    for (const client of [db(),admin(),env.unauthenticatedContext().firestore()]) {
      await assertFails(getDoc(doc(client,path)));
      await assertFails(setDoc(doc(client,path),{count:999}));
    }
  }
});

test('actual rules allow valid order creation and reject forged payment, ownership, IDs and fields', async () => {
  await assertSucceeds(setDoc(doc(db(), 'orders/order-1'), order()));
  await env.clearFirestore();
  for (const changes of [{ ownerDetails: {} }, { tenantDetails: null }, { propertyDetails: {} }, { agreementTerms: {} }, { ownerUid: 'other' }, { orderId: 'wrong' }, { status: 'Paid' }, { courier: {} }, { rogue: true }, { payment: { status: 'Paid' } }, { payment: { status: 'Pending', amount: 1 } }, { payment: { status: 'Pending', phonepeMerchantOrderId: 'stolen' } }]) {
    await assertFails(setDoc(doc(db(), 'orders/order-1'), { ...order(), ...changes }));
  }
  await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'orders/order-1'), order()));
});

test('actual rules restrict order reads to owner and verified admin and forbid deletion', async () => {
  await seed('orders/order-1', order());
  await assertSucceeds(getDoc(doc(db(), 'orders/order-1')));
  await assertSucceeds(getDoc(doc(admin(), 'orders/order-1')));
  await assertFails(getDoc(doc(db('other'), 'orders/order-1')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'orders/order-1')));
  await assertFails(getDoc(doc(db('admin', { email: 'pradeep1992official@gmail.com', email_verified: false }), 'orders/order-1')));
  await assertSucceeds(getDoc(doc(db('secondary-admin', { email: 'ntcsc@gmail.com', email_verified: true }), 'orders/order-1')));
  await assertFails(deleteDoc(doc(admin(), 'orders/order-1')));
});

test('actual rules allow corrections but forbid changing payment, identity and courier', async () => {
  const original = { ...order(), status: 'Documents needed', courier: { trackingNumber: 'ABC' } };
  for (const changes of [{ ownerDetails: {} }, { propertyDetails: {} }, { agreementTerms: { ...original.agreementTerms, includeNotary: true } }, { payment: { status: 'Paid' } }, { ownerUid: 'other' }, { createdAt: 'changed' }, { courier: {} }, { notes: 'unauthorised' }]) {
    await seed('orders/order-1', original);
    await assertFails(updateDoc(doc(db(), 'orders/order-1'), { status: 'Under verification', ...changes }));
  }
  await assertSucceeds(updateDoc(doc(db(), 'orders/order-1'), { status: 'Under verification', ownerDetails: { ...original.ownerDetails, fullName: 'Corrected Owner' } }));
  await assertFails(updateDoc(doc(db(), 'orders/order-1'), { status: 'Paid' }));
});

test('customer clarifications persist only through the restricted correction transition', async () => {
  const ref = doc(db(), 'orders/order-1');
  const original = { ...order(), status: 'Documents needed' };
  for (const customerClarification of ['', 'tiny', 123, 'x'.repeat(3001)]) {
    await seed('orders/order-1', original);
    await assertFails(updateDoc(ref, { status: 'Under verification', customerClarification }));
  }
  await seed('orders/order-1', original);
  await assertSucceeds(updateDoc(ref, { status: 'Under verification', customerClarification: 'Please use the corrected spelling.' }));
  await assertFails(updateDoc(ref, { customerClarification: 'Changed after submission.' }));
});

test('private payment attempts, locks and referral records deny even client admins', async () => {
  for (const collection of ['phonepePaymentAttempts', 'checkoutLocks', 'referralAccounts', 'referralLedger', 'orderTrackingLimits', 'firstOrderCoupons']) {
    await seed(`${collection}/private`, { secret: true });
    for (const client of [db(), admin(), env.unauthenticatedContext().firestore()]) {
      await assertFails(getDoc(doc(client, `${collection}/private`)));
      await assertFails(setDoc(doc(client, `${collection}/private`), { secret: false }));
    }
  }
});

test('actual pricing rules enforce minimums, whole numbers, maximum and admin access', async () => {
  const pricing = { stamp100Chennai: 350, stamp100TamilNadu: 400, stamp200Chennai: 450, stamp200TamilNadu: 500, notaryExtraFee: 0 };
  await assertSucceeds(setDoc(doc(admin(), 'settings/pricing'), pricing));
  await assertSucceeds(setDoc(doc(admin(), 'settings/pricing'), { stamp100Chennai: 150, stamp100TamilNadu: 200, stamp200Chennai: 250, stamp200TamilNadu: 300, notaryExtraFee: 0 }));
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'settings/pricing')));
  await assertFails(setDoc(doc(db(), 'settings/pricing'), pricing));
  for (const value of [-1, 0, 99, 100, 149, 150.5, '350', null, 45035996273705]) {
    await assertFails(setDoc(doc(admin(), 'settings/pricing'), { ...pricing, stamp100Chennai: value }));
  }
  await assertFails(setDoc(doc(admin(), 'settings/pricing'), { ...pricing, stamp200Chennai: 199 }));
  await assertFails(setDoc(doc(admin(), 'settings/pricing'), { ...pricing, notaryExtraFee: -1 }));
  await assertFails(deleteDoc(doc(admin(), 'settings/pricing')));
});

test('draft form reads, writes and deletes are owner-only', async () => {
  await assertSucceeds(setDoc(doc(db(), 'drafts/customer'), { ownerUid: 'customer', currentStep: 1, formData: {}, updatedAt: 'now' }));
  await assertSucceeds(getDoc(doc(db(), 'drafts/customer')));
  await assertFails(getDoc(doc(db('other'), 'drafts/customer')));
  await assertFails(setDoc(doc(db(), 'drafts/customer'), { ownerUid: 'other' }));
  await assertSucceeds(deleteDoc(doc(db(), 'drafts/customer')));
});

test('Shared customer coupon discount is bounded and writable only by verified administrators', async () => {
  const couponRef = doc(admin(), 'settings/coupons');
  await assertSucceeds(setDoc(couponRef, { customerDiscountAmount: 80 }));
  await assertFails(setDoc(doc(db(), 'settings/coupons'), { customerDiscountAmount: 999 }));
  await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'settings/coupons'), { customerDiscountAmount: 999 }));
  for (const customerDiscountAmount of [-1, 0.5, '80', 100001, null]) {
    await assertFails(setDoc(couponRef, { customerDiscountAmount }));
  }
  await assertSucceeds(setDoc(couponRef, { customerDiscountAmount: 0 }));
});

test('historical draft files can be read and deleted without a new resource', async () => {
  const owner = env.authenticatedContext('customer').storage();
  await assertSucceeds(uploadBytes(ref(owner, 'drafts/customer/draft.pdf'), new Uint8Array([1, 2, 3]), { contentType: 'application/pdf' }));
  await assertSucceeds(getBytes(ref(owner, 'drafts/customer/draft.pdf')));
  await assertFails(getBytes(ref(env.authenticatedContext('other').storage(), 'drafts/customer/draft.pdf')));
  await assertFails(deleteObject(ref(env.authenticatedContext('other').storage(), 'drafts/customer/draft.pdf')));
  await assertSucceeds(deleteObject(ref(owner, 'drafts/customer/draft.pdf')));
});

test('draft file writes reject unsupported types, oversized content and foreign owners', async () => {
  const storage = env.authenticatedContext('customer').storage();
  await assertFails(uploadBytes(ref(storage, 'drafts/customer/file.txt'), new Uint8Array([1]), { contentType: 'text/plain' }));
  await assertFails(uploadBytes(ref(storage, 'drafts/customer/large.pdf'), new Uint8Array(5 * 1024 * 1024 + 1), { contentType: 'application/pdf' }));
  await assertFails(uploadBytes(ref(storage, 'drafts/other/file.pdf'), new Uint8Array([1]), { contentType: 'application/pdf' }));
});

 test('public enquiry creation and client limiter access are denied', async () => {
   for (const client of [env.unauthenticatedContext().firestore(), db()]) {
     await assertFails(setDoc(doc(client, 'enquiries/spam'), { enquiryId: 'spam', name: 'Spam', phone: '9876543210', district: 'Chennai', message: 'Bypass attempt', status: 'New', createdAt: 'now' }));
     await assertFails(setDoc(doc(client, 'enquiryLimits/global'), { minute: 1, count: 0 }));
     await assertFails(getDoc(doc(client, 'enquiryLimits/global')));
   }
 });

test('custom request records, limits and audit deny all direct client access', async () => {
  for (const collection of ['customAgreementRequests', 'customAgreementLimits', 'customAgreementAudit']) {
    await seed(`${collection}/private`, { ownerUid: 'customer', internalNotes: 'Staff only' });
    for (const client of [db(), db('other'), admin(), env.unauthenticatedContext().firestore()]) {
      await assertFails(getDoc(doc(client, `${collection}/private`)));
      await assertFails(setDoc(doc(client, `${collection}/private`), { ownerUid: 'customer' }));
    }
  }
});

test('custom samples require server-reserved ownership, exact metadata, immutable writes and staging status', async () => {
  const path = 'custom-agreements/customer/CUSTOM_test/sample-1';
  const reserved = { ownerUid: 'customer', status: 'Uploading', files: { 'sample-1': { size: 3, contentType: 'application/pdf' } } };
  const owner = env.authenticatedContext('customer').storage();
  const other = env.authenticatedContext('other').storage();
  await assertFails(uploadBytes(ref(owner, path), new Uint8Array([1, 2, 3]), { contentType: 'application/pdf' }));
  await seed('customAgreementRequests/CUSTOM_test', reserved);
  await assertFails(uploadBytes(ref(other, path), new Uint8Array([1, 2, 3]), { contentType: 'application/pdf' }));
  await assertFails(uploadBytes(ref(owner, path), new Uint8Array([1, 2]), { contentType: 'application/pdf' }));
  await assertFails(uploadBytes(ref(owner, path), new Uint8Array([1, 2, 3]), { contentType: 'image/png' }));
  await assertFails(uploadBytes(ref(owner, path), new Uint8Array([1, 2, 3]), { contentType: 'application/pdf', customMetadata: { arbitrary: 'forged' } }));
  await assertSucceeds(uploadBytes(ref(owner, path), new Uint8Array([1, 2, 3]), { contentType: 'application/pdf' }));
  await assertFails(uploadBytes(ref(owner, path), new Uint8Array([1, 2, 3]), { contentType: 'application/pdf' }));
  await assertFails(getBytes(ref(owner, path)));
  await assertFails(getBytes(ref(env.authenticatedContext('admin', { email: 'pradhiip92@gmail.com', email_verified: true }).storage(), path)));
  await assertFails(deleteObject(ref(owner, path)));
  await env.clearStorage();
  await seed('customAgreementRequests/CUSTOM_test', { ...reserved, status: 'Submitted' });
  await assertFails(uploadBytes(ref(owner, path), new Uint8Array([1, 2, 3]), { contentType: 'application/pdf' }));
});

test('Customer referral rewards and first-order discounts require bounded amounts and administrator access', async () => {
  const settings = { rewardAmount: 100, refereeDiscountAmount: 25 };
  await assertSucceeds(setDoc(doc(admin(), 'settings/referrals'), settings));
  await assertFails(setDoc(doc(db(), 'settings/referrals'), settings));
  await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'settings/referrals'), settings));
  for (const key of ['rewardAmount', 'refereeDiscountAmount']) {
    for (const value of [-1, 1.5, '25', 100001, null]) {
      await assertFails(setDoc(doc(admin(), 'settings/referrals'), { ...settings, [key]: value }));
    }
  }
  await assertSucceeds(setDoc(doc(admin(), 'settings/referrals'), { rewardAmount: 0, refereeDiscountAmount: 100000 }));
});
