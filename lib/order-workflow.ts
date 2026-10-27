import type { Order } from './types';

export type OrderChannel = 'Online' | 'Counter';
export type WorkflowAction = 'verify' | 'prepare' | 'dispatch' | 'complete' | 'cancel';
export interface WorkflowInput {
  action: WorkflowAction;
  detailsChecked?: boolean;
  checks?: { details?: boolean; stampAndCopies?: boolean; signingSpace?: boolean };
  allowUnpaid?: boolean;
  confirmed?: boolean;
  courierName?: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
}

export function hasDispatchDetails(order: Order): boolean {
  return typeof order.courier?.courierName === 'string' && !!order.courier.courierName.trim()
    && typeof order.courier?.trackingNumber === 'string' && !!order.courier.trackingNumber.trim()
    && typeof order.courier?.dispatchedAt === 'string' && Number.isFinite(Date.parse(order.courier.dispatchedAt));
}

export function workflowHold(order: Order): string | undefined {
  if (order.replacedByOrderId) return 'Replaced order: retained for history.';
  if (order.replacementPendingId) return 'Replacement payment pending.';
  if (order.modificationReviewId) return 'Changes need administrator review.';
  if (order.cancellationRefundId || order.status === 'Cancelled') return 'This order is cancelled.';
  if (order.status === 'Delivered') return 'This order is complete.';
}

export function nextWorkflowAction(order: Order, channel: OrderChannel): { action?: WorkflowAction; label: string; blocked?: string } {
  const held = workflowHold(order);
  if (held) return { label: order.status === 'Delivered' ? 'Complete' : 'On hold', blocked: held };
  if (channel === 'Online' && order.payment?.status !== 'Paid') return { label: 'Await payment', blocked: 'Customer payment is pending.' };
  if (order.status === 'Documents needed') return { label: 'Await customer corrections', blocked: 'Waiting for corrected details from the customer.' };
  if (['Submitted', 'Under verification'].includes(order.status) || (order.status === 'Drafting' && !order.detailsVerifiedAt)) return { action: 'verify', label: 'Verify details' };
  if (order.status === 'Drafting' && !order.preparationCompletedAt) return { action: 'prepare', label: 'Mark preparation complete' };
  if (order.status === 'Drafting' && channel === 'Online') return { action: 'dispatch', label: 'Dispatch' };
  if (order.status === 'Drafting' && channel === 'Counter') return order.payment?.status === 'Paid'
    ? { action: 'complete', label: 'Complete collection' } : { label: 'Record counter payment', blocked: 'Record payment at the counter before collection.' };
  if (order.status === 'Dispatched') {
    if (!order.preparationCompletedAt || !order.detailsVerifiedAt) return { action: 'prepare', label: 'Confirm preparation checks' };
    if (!hasDispatchDetails(order)) return { action: 'dispatch', label: 'Add courier details' };
    return { action: 'complete', label: 'Complete delivery' };
  }
  return { label: 'Review order', blocked: 'Review the saved order stage.' };
}

export function validOperationalDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

/** Pure validation shared by the API and tests; no status can be chosen freely. */
export function workflowPatch(order: Order, channel: OrderChannel, input: WorkflowInput, now: string): Partial<Order> {
  const fail = (message: string): never => { throw new Error(message); };
  if (workflowHold(order)) fail(workflowHold(order)!);
  if (input.action === 'cancel') {
    if (order.payment?.status === 'Paid') fail('Use the cancellation and original-payment refund workflow for a paid order.');
    if (order.preparationStartedAt || ['Drafting', 'Dispatched'].includes(order.status)) fail('Preparation has started; review cancellation separately.');
    return { status: 'Cancelled', stageChangedAt: now, updatedAt: now };
  }
  if (channel === 'Online' && order.payment?.status !== 'Paid') fail('Confirm payment before fulfilment.');
  const expected = nextWorkflowAction(order, channel).action;
  if (input.action !== expected) fail(`Complete the current step first: ${nextWorkflowAction(order, channel).label}.`);
  const base: Partial<Order> = { updatedAt: now, stageChangedAt: now };
  if (input.action === 'verify') {
    if (input.detailsChecked !== true) fail('Confirm that party details, agreement terms and proof documents have been checked.');
    return { ...base, detailsVerifiedAt: now, status: 'Drafting', preparationStartedAt: order.preparationStartedAt || now,
      preparationCompletedAt: undefined, preparationChecks: undefined, courier: undefined, completedAt: undefined };
  }
  if (input.action === 'prepare') {
    if (channel === 'Counter' && order.payment?.status !== 'Paid' && input.allowUnpaid !== true) fail('Confirm preparation without counter payment.');
    if (input.checks?.details !== true || input.checks.stampAndCopies !== true || input.checks.signingSpace !== true) fail('Complete all preparation checks first.');
    return { ...base, detailsVerifiedAt: order.detailsVerifiedAt || now, preparationStartedAt: order.preparationStartedAt || now, preparationCompletedAt: now,
      preparationChecks: { details: true, stampAndCopies: true, signingSpace: true } };
  }
  if (!order.detailsVerifiedAt || !order.preparationCompletedAt) fail('Verify the details and complete preparation checks first.');
  if (order.payment?.status !== 'Paid') fail('Confirm payment before dispatch or completion.');
  if (input.action === 'dispatch') {
    if (channel !== 'Online' || typeof input.courierName !== 'string' || !input.courierName.trim() || typeof input.trackingNumber !== 'string' || !input.trackingNumber.trim()) fail('Courier partner and tracking number are required.');
    if (input.courierName!.length > 100 || input.trackingNumber!.length > 150) fail('Courier details are too long.');
    if (input.estimatedDelivery && !validOperationalDate(input.estimatedDelivery)) fail('Choose a valid delivery estimate.');
    return { ...base, status: 'Dispatched', courier: { courierName: input.courierName!.trim(), trackingNumber: input.trackingNumber!.trim(), dispatchedAt: now,
      ...(input.estimatedDelivery ? { estimatedDelivery: input.estimatedDelivery } : {}) } };
  }
  if (input.action === 'complete') {
    if (input.confirmed !== true) fail('Confirm delivery or customer collection before completion.');
    if (channel === 'Online' && !hasDispatchDetails(order)) fail('Courier details are required before completion.');
    return { ...base, status: 'Delivered', completedAt: now };
  }
  return fail('Invalid workflow action.');
}
