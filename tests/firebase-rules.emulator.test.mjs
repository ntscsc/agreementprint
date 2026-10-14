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

const order = () => ({ orderId: 'order-1', ownerUid: 'customer', customerEmail: 'customer@example.com', status: 'Submitted', payment: { status: 'Pending' }, createdAt: '2026-10-12' });
const db = (uid = 'customer', claims = {}) => env.authenticatedContext(uid, claims).firestore();
const admin = () => db('admin', { email: 'pradhiip92@gmail.com', email_verified: true });
const seed = async (path, data) => env.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), path), data));

test('actual rules allow valid order creation and reject forged payment, ownership, IDs and fields', async () => {
  await assertSucceeds(setDoc(doc(db(), 'orders/order-1'), order()));
  await env.clearFirestore();
  for (const changes of [{ ownerUid: 'other' }, { orderId: 'wrong' }, { status: 'Paid' }, { courier: {} }, { rogue: true }, { payment: { status: 'Paid' } }, { payment: { status: 'Pending', amount: 1 } }, { payment: { status: 'Pending', phonepeMerchantOrderId: 'stolen' } }]) {
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
  await assertFails(getDoc(doc(db('admin', { email: 'pradhiip92@gmail.com', email_verified: false }), 'orders/order-1')));
  await assertFails(deleteDoc(doc(admin(), 'orders/order-1')));
});

test('actual rules allow corrections but forbid changing payment, identity and courier', async () => {
  const original = { ...order(), status: 'Documents needed', courier: { trackingNumber: 'ABC' } };
  for (const changes of [{ payment: { status: 'Paid' } }, { ownerUid: 'other' }, { createdAt: 'changed' }, { courier: {} }, { notes: 'unauthorised' }]) {
    await seed('orders/order-1', original);
    await assertFails(updateDoc(doc(db(), 'orders/order-1'), { status: 'Under verification', ...changes }));
  }
  await assertSucceeds(updateDoc(doc(db(), 'orders/order-1'), { status: 'Under verification', ownerDetails: { name: 'Corrected' } }));
  await assertFails(updateDoc(doc(db(), 'orders/order-1'), { status: 'Paid' }));
});

test('private payment attempts, locks and referral records deny even client admins', async () => {
  for (const collection of ['phonepePaymentAttempts', 'checkoutLocks', 'referralAccounts', 'referralLedger']) {
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
