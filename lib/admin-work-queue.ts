import type { Order } from './types';
import { nextWorkflowAction } from '@/lib/order-workflow';
import { customWorkStage, customNextAction } from '@/lib/custom-workflow';
import type { CustomRequest } from '@/lib/custom-agreement';
import { customQuoteStatus } from '@/lib/custom-agreement';

export type QueueChannel = 'Online' | 'Changes' | 'Refunds' | 'Custom';
export interface WorkItem {
  id: string; channel: QueueChannel; reference: string; orderId?: string;
  customer: string; stage: string; nextAction: string; needsAction: boolean;
  createdAt?: string; stageStartedAt?: string; waitingOn?: string; paymentStatus?: string;
  target: 'order' | 'changes' | 'refunds' | 'custom';
}
export interface DeskSummary {
  pendingWorkload: number; needsAction: number; waiting: number; pendingRefunds: number;
  pendingRefundAmount: number; todayCounterCollections: number; todayCounterPayments: number;
  todayOnlineCollections: number; todayOnlinePayments: number;
}
export interface WorkQueueData { items: WorkItem[]; summary: DeskSummary; generatedAt: string; }
type RecordData = Record<string, any>;
export function indiaDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function stageStart(order: Order): string | undefined {
  return order.stageChangedAt
    || (order.status === 'Dispatched' ? order.courier?.dispatchedAt : undefined)
    || (order.status === 'Drafting' ? order.preparationCompletedAt || order.preparationStartedAt : undefined)
    || (order.status === 'Under verification' ? order.correctionSubmittedAt || undefined : undefined)
    || (order.status === 'Submitted' ? order.createdAt : undefined);
}
export function waitingTime(item: Pick<WorkItem, 'stageStartedAt' | 'createdAt'>, now = new Date()): string {
  const value = item.stageStartedAt || item.createdAt;
  if (!value || !Number.isFinite(Date.parse(value))) return 'Waiting time unavailable';
  const hours = Math.max(0, Math.floor((now.getTime() - Date.parse(value)) / 3600000));
  const elapsed = hours >= 24 ? `${Math.floor(hours / 24)} day${Math.floor(hours / 24) === 1 ? '' : 's'}` : hours >= 1 ? `${hours} hour${hours === 1 ? '' : 's'}` : 'less than an hour';
  return `${item.stageStartedAt ? 'Waiting for' : 'Open for'} ${elapsed}`;
}
export function orderWorkItem(order: Order): WorkItem | null {
  if ((order as Order & { source?: string }).source === 'Counter' || order.orderId.startsWith('COUNTER_')) return null;
  if (order.status === 'Cancelled' || order.status === 'Delivered' || order.replacedByOrderId) return null;
  const next = nextWorkflowAction(order, 'Online');
  return { id: `Online:${order.orderId}`, channel: 'Online', orderId: order.orderId, reference: order.publicReference || order.orderId,
    customer: [order.ownerDetails?.fullName, order.tenantDetails?.fullName].filter(Boolean).join(' & '),
    stage: order.preparationCompletedAt && order.status === 'Drafting' ? 'Ready for dispatch' : order.status,
    nextAction: next.label, needsAction: !!next.action,
    waitingOn: next.blocked, paymentStatus: order.payment?.status, createdAt: order.createdAt, stageStartedAt: stageStart(order), target: 'order' };
}
export function buildWorkQueue(input: { orders: Order[]; changes: RecordData[]; refunds: RecordData[]; custom: RecordData[]; todayCollections: RecordData[]; todayOnlineOrders?: RecordData[]; todayCustomPayments?: RecordData[] }, now = new Date()): WorkQueueData {
  const items: WorkItem[] = [];
  for (const order of input.orders) { const item = orderWorkItem(order); if (item) items.push(item); }
  for (const record of input.changes) {
    if (record.state !== 'Review required' && record.refundStatus !== 'Requested') continue;
    const refund = record.refundStatus === 'Requested';
    items.push({ id: `change:${record.requestId}`, channel: refund ? 'Refunds' : 'Changes', reference: record.originalOrderId || record.requestId,
      orderId: record.originalOrderId, customer: record.details?.ownerDetails?.fullName || 'Change request', stage: refund ? 'Replacement refund requested' : 'Changes need review',
      nextAction: refund ? 'Review replacement refund' : 'Review proposed changes', needsAction: true, createdAt: record.createdAt,
      stageStartedAt: refund ? record.refundRequestedAt || record.latePaymentAt : record.createdAt, target: 'changes' });
  }
  const pendingRefunds = input.refunds.filter(record => ['Awaiting approval', 'Processing'].includes(record.state));
  for (const record of pendingRefunds) items.push({ id: `refund:${record.requestId}`, channel: 'Refunds', reference: record.orderId || record.requestId,
    orderId: record.orderId, customer: record.source || 'Refund request', stage: record.state, nextAction: record.state === 'Processing' ? 'Check refund status' : 'Review refund', needsAction: true,
    createdAt: record.createdAt, stageStartedAt: record.state === 'Awaiting approval' ? record.createdAt : record.processingStartedAt || record.approvedAt, target: 'refunds' });
  for (const record of input.custom) {
    const status = customQuoteStatus(record) || record.status;
    if (['Completed', 'Cancelled', 'Declined', 'Uploading'].includes(status)) continue;
    const waiting = status === 'Clarification Required' || status === 'Awaiting Approval' && record.customerApproval?.status === 'Pending' || ['Quote Sent', 'Quoted / Awaiting Payment'].includes(status) && record.payment?.status !== 'Paid';
    items.push({ id: `custom:${record.requestId}`, channel: 'Custom', reference: record.publicReference || record.requestId, customer: record.name || 'Custom request', stage: customWorkStage(record as unknown as CustomRequest),
      nextAction: customNextAction(record as unknown as CustomRequest), needsAction: !waiting,
      createdAt: record.createdAt, stageStartedAt: record.stageChangedAt, waitingOn: waiting ? 'Customer clarification or payment pending.' : undefined, target: 'custom' });
  }
  items.sort((a, b) => Number(b.needsAction) - Number(a.needsAction) || (Date.parse(a.stageStartedAt || a.createdAt || '') || now.getTime()) - (Date.parse(b.stageStartedAt || b.createdAt || '') || now.getTime()) || a.id.localeCompare(b.id));
  const today = indiaDay(now), paidToday = input.todayCollections.filter(order => order.payment?.status === 'Paid' && order.payment?.paidAt && Number.isFinite(Date.parse(order.payment.paidAt)) && indiaDay(new Date(order.payment.paidAt)) === today);
  const replacementRefunds = input.changes.filter(record => record.refundStatus === 'Requested');
  const onlineReceipts = new Map<string, number>();
  for (const record of [...(input.todayOnlineOrders || []), ...(input.todayCustomPayments || [])]) {
    const payment = record.payment;
    if (!['Paid', 'Refunded'].includes(payment?.status) || !Number.isFinite(Date.parse(payment.paidAt)) || indiaDay(new Date(payment.paidAt)) !== today) continue;
    // A replacement's carried payment is not a new collection.
    const amount = record.replacesOrderId || payment.carriedFromOrderId ? payment.additionalPayment ?? record.replacementAdjustment?.additionalPayment : payment.amount;
    const key = payment.phonepeMerchantOrderId || payment.razorpayPaymentId || payment.merchantOrderId || `recorded:${record.orderId || record.requestId || record.id}`;
    if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0 && !onlineReceipts.has(key)) onlineReceipts.set(key, amount);
  }
  return { items, generatedAt: now.toISOString(), summary: { pendingWorkload: items.length, needsAction: items.filter(item => item.needsAction).length,
    waiting: items.filter(item => !item.needsAction).length, pendingRefunds: pendingRefunds.length + replacementRefunds.length,
    pendingRefundAmount: [...pendingRefunds.map(record => record.amount), ...replacementRefunds.map(record => record.refundAmount)].reduce((sum, amount) => sum + (typeof amount === 'number' && Number.isFinite(amount) ? amount : 0), 0),
    todayCounterCollections: paidToday.reduce((sum, order) => sum + (typeof order.payment.amount === 'number' && Number.isFinite(order.payment.amount) ? order.payment.amount : 0), 0), todayCounterPayments: paidToday.length,
    todayOnlineCollections: [...onlineReceipts.values()].reduce((sum, amount) => sum + amount, 0), todayOnlinePayments: onlineReceipts.size } };
}
