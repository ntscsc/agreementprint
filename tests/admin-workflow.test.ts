import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import type { Order } from '../lib/types.ts';
const require = createRequire(import.meta.url), ts = require('typescript');
const cache = new Map<string, any>();
function load(name: string): any {
  if (!name.startsWith('@/')) return require(name);
  if (cache.has(name)) return cache.get(name);
  const target = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(new URL(`../${name.slice(2)}.ts`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { module: target, exports: target.exports, require: load, Date, console });
  cache.set(name, target.exports); return target.exports;
}
const { workflowPatch, nextWorkflowAction } = load('@/lib/order-workflow');
const { buildWorkQueue, waitingTime, indiaDay, stageStart } = load('@/lib/admin-work-queue');
const now = '2026-10-26T10:00:00.000Z';
const checks = { details: true, stampAndCopies: true, signingSpace: true };
function order(fields: Partial<Order> = {}): Order {
  return { orderId: 'ORDER1', publicReference: 'AP-100001', ownerUid: 'customer', customerEmail: '', status: 'Under verification',
    ownerDetails: { fullName: 'Example Owner' }, tenantDetails: { fullName: 'Example Tenant' },
    agreementTerms: { extraCopies: 1 }, propertyDetails: {}, proofUploads: {}, payment: { status: 'Paid', amount: 350 },
    createdAt: '2026-10-23T10:00:00.000Z', updatedAt: '2026-10-25T10:00:00.000Z', ...fields } as Order;
}

test('Online orders cannot skip verification, preparation checks, tracking or delivery confirmation', () => {
  let current = order();
  for (const action of ['prepare', 'dispatch', 'complete']) assert.throws(() => workflowPatch(current, 'Online', { action, checks, confirmed: true }, now));
  assert.throws(() => workflowPatch(current, 'Online', { action: 'verify' }, now), /Confirm/);
  current = { ...current, ...workflowPatch(current, 'Online', { action: 'verify', detailsChecked: true }, now) };
  assert.equal(current.status, 'Drafting');
  assert.throws(() => workflowPatch(current, 'Online', { action: 'prepare', checks: { details: true } }, now), /all preparation checks/);
  assert.throws(() => workflowPatch(current, 'Online', { action: 'prepare', checks: { details: 'true', stampAndCopies: true, signingSpace: true } }, now), /all preparation checks/);
  assert.throws(() => workflowPatch(current, 'Online', { action: 'complete', confirmed: true }, now));
  current = { ...current, ...workflowPatch(current, 'Online', { action: 'prepare', checks }, now) };
  assert.ok(current.preparationCompletedAt);
  assert.throws(() => workflowPatch(current, 'Online', { action: 'dispatch', courierName: 'Courier' }, now), /tracking/);
  current = { ...current, ...workflowPatch(current, 'Online', { action: 'dispatch', courierName: ' Courier ', trackingNumber: ' TRACK123 ' }, now) };
  assert.equal(current.status, 'Dispatched'); assert.equal(current.courier?.trackingNumber, 'TRACK123');
  assert.throws(() => workflowPatch(current, 'Online', { action: 'complete' }, now), /Confirm delivery/);
  current = { ...current, ...workflowPatch(current, 'Online', { action: 'complete', confirmed: true }, now) };
  assert.equal(current.status, 'Delivered'); assert.ok(current.completedAt);
  assert.throws(() => workflowPatch(current, 'Online', { action: 'verify', detailsChecked: true }, now), /complete/);
});

test('Counter unpaid preparation remains explicit and collection always requires payment', () => {
  let current = order({ payment: { status: 'Pending' } });
  assert.equal(nextWorkflowAction(current, 'Online').action, undefined);
  current = { ...current, ...workflowPatch(current, 'Counter', { action: 'verify', detailsChecked: true }, now) };
  assert.throws(() => workflowPatch(current, 'Counter', { action: 'prepare', checks }, now), /without counter payment/);
  current = { ...current, ...workflowPatch(current, 'Counter', { action: 'prepare', checks, allowUnpaid: true }, now) };
  assert.throws(() => workflowPatch(current, 'Counter', { action: 'complete', confirmed: true }, now));
  current = { ...current, payment: { status: 'Paid', amount: 350 } };
  current = { ...current, ...workflowPatch(current, 'Counter', { action: 'complete', confirmed: true }, now) };
  assert.equal(current.status, 'Delivered');
});

test('Replacement, modification review and refund holds cannot advance fulfilment', () => {
  for (const fields of [{ replacementPendingId: 'REPL1' }, { replacedByOrderId: 'ORDER2' }, { modificationReviewId: 'CHANGE1' }, { cancellationRefundId: 'REFUND1' }]) {
    const current = order(fields);
    assert.equal(nextWorkflowAction(current, 'Online').action, undefined);
    assert.throws(() => workflowPatch(current, 'Online', { action: 'verify', detailsChecked: true }, now));
  }
  assert.throws(() => workflowPatch(order(), 'Online', { action: 'cancel' }, now), /refund workflow/);
  assert.equal(workflowPatch(order({ payment: { status: 'Pending' } }), 'Online', { action: 'cancel' }, now).status, 'Cancelled');
});

test('Re-verification clears stale preparation and courier evidence', () => {
  const prior = order({ detailsVerifiedAt: 'old', preparationCompletedAt: 'old', preparationChecks: checks,
    courier: { courierName: 'Old courier', trackingNumber: 'OLD', dispatchedAt: now } });
  const patch = workflowPatch(prior, 'Online', { action: 'verify', detailsChecked: true }, now);
  const current = { ...prior, ...patch };
  assert.equal(current.preparationCompletedAt, undefined); assert.equal(current.courier, undefined);
  assert.equal(nextWorkflowAction(current, 'Online').action, 'prepare');
});

test('Legacy dispatched orders require explicit checks; dates are never invented', () => {
  const legacy = order({ status: 'Dispatched', courier: { courierName: 'Courier', trackingNumber: 'ABC', dispatchedAt: now } });
  assert.equal(nextWorkflowAction(legacy, 'Online').action, 'prepare');
  assert.throws(() => workflowPatch(legacy, 'Online', { action: 'complete', confirmed: true }, now));
  const checked = { ...legacy, ...workflowPatch(legacy, 'Online', { action: 'prepare', checks }, now) };
  assert.equal(workflowPatch(checked, 'Online', { action: 'complete', confirmed: true }, now).status, 'Delivered');
  const incomplete = { ...checked, courier: undefined };
  assert.equal(nextWorkflowAction(incomplete, 'Online').action, 'dispatch');
  assert.throws(() => workflowPatch(incomplete, 'Online', { action: 'complete', confirmed: true }, now));
  assert.equal(stageStart(order()), undefined);
  assert.match(waitingTime({ createdAt: '2026-10-24T10:00:00Z' }, new Date(now)), /Open for 2 days/);
  assert.match(waitingTime({ stageStartedAt: '2026-10-24T10:00:00Z' }, new Date(now)), /Waiting for 2 days/);
  assert.equal(waitingTime({ createdAt: 'bad-date' }, new Date(now)), 'Waiting time unavailable');
});

test('Online receipts exclude carried cash and count each saved payment once', () => {
  const payment = { status: 'Paid', paidAt: now, amount: 350, phonepeMerchantOrderId: 'PAY1' };
  const data = buildWorkQueue({ orders: [], changes: [], refunds: [], custom: [], todayCollections: [],
    todayOnlineOrders: [{ orderId: 'ORIGINAL', payment }, { orderId: 'DUPLICATE', payment },
      { orderId: 'REPLACEMENT', replacesOrderId: 'ORIGINAL', payment: { ...payment, phonepeMerchantOrderId: 'PAY2', amount: 400, additionalPayment: 50, carriedCash: 350 } }],
    todayCustomPayments: [{ requestId: 'CUSTOM1', payment: { status: 'Paid', merchantOrderId: 'CUSTOMPAY1', paidAt: now, amount: 100 } }],
  }, new Date(now));
  assert.equal(data.summary.todayOnlineCollections, 500); assert.equal(data.summary.todayOnlinePayments, 3);
  assert.equal(data.summary.pendingWorkload, 0);
});

test('Queue excludes counter orders and completed work; counter receipts remain separate', () => {
  const data = buildWorkQueue({
    orders: [order(), order({ orderId: 'CLOSED', status: 'Delivered' }), order({ orderId: 'WAIT', payment: { status: 'Pending' } }), order({ orderId: 'COUNTER_hidden' })],
    changes: [{ requestId: 'CHANGE1', state: 'Review required', originalOrderId: 'ORDER1', createdAt: now }, { requestId: 'OLD', state: 'Reviewed' }],
    refunds: [{ requestId: 'REFUND1', state: 'Awaiting approval', amount: 350, createdAt: now }], custom: [],
    todayCollections: [{ orderId: 'COUNTER1', payment: { status: 'Paid', paidAt: '2026-10-25T19:00:00Z', amount: 250 } },
      { orderId: 'COUNTER2', payment: { status: 'Paid', paidAt: '2026-10-25T18:00:00Z', amount: 1000 } }, { payment: { status: 'Paid', paidAt: 'bad-date', amount: 500 } }],
  }, new Date(now));
  assert.equal(data.items.length, 4); assert.equal(data.summary.pendingWorkload, 4);
  assert.equal(data.items.some((item: any) => item.channel === 'Counter' || item.orderId?.startsWith('COUNTER')), false);
  assert.equal(data.summary.needsAction, 3); assert.equal(data.summary.waiting, 1);
  assert.equal(data.summary.pendingRefunds, 1); assert.equal(data.summary.pendingRefundAmount, 350);
  assert.equal(data.summary.todayCounterCollections, 250); assert.equal(data.summary.todayCounterPayments, 1);
  assert.equal(indiaDay(new Date('2026-10-25T19:00:00Z')), '2026-10-26');
});
