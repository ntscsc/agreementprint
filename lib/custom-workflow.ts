import { customQuoteStatus, type CustomRequest } from '@/lib/custom-agreement';
export const customStageFilters = [
  { value: 'ALL', label: 'All requests', statuses: [] },
  { value: 'REVIEW', label: 'Needs review', statuses: ['Submitted', 'Under Review'] },
  { value: 'WAITING', label: 'Waiting for customer', statuses: ['Uploading', 'Clarification Required', 'Quote Sent', 'Quoted / Awaiting Payment'] },
  { value: 'PROGRESS', label: 'In progress', statuses: ['Accepted', 'In Progress', 'Awaiting Approval', 'Ready', 'Dispatched'] },
  { value: 'COMPLETED', label: 'Completed', statuses: ['Completed'] },
  { value: 'CLOSED', label: 'Cancelled / declined', statuses: ['Cancelled', 'Declined'] },
];

export function customWorkStage(r: Pick<CustomRequest, 'status' | 'payment' | 'quoteAmount'>): string {
  const status = customQuoteStatus(r);
  return ({ Uploading: 'Awaiting files', Submitted: 'New', 'Under Review': 'Reviewing',
    'Clarification Required': 'Awaiting clarification', 'Quote Sent': 'Awaiting payment',
    'Quoted / Awaiting Payment': 'Awaiting payment', Accepted: r.payment?.status === 'Paid' ? 'Ready to draft' : 'Awaiting payment',
    'In Progress': 'Drafting', 'Awaiting Approval': 'Awaiting approval', Ready: 'Ready to dispatch', Dispatched: 'Dispatched',
    Completed: 'Completed', Declined: 'Declined', Cancelled: 'Cancelled' } as Record<string, string>)[status || ''] || 'Reviewing';
}
export function customNextAction(r: CustomRequest): string {
  const status = customQuoteStatus(r);
  if (status === 'Submitted') return 'Review request';
  if (status === 'Under Review') return 'Prepare quote';
  if (status === 'Clarification Required') return 'Await clarification';
  if (['Quote Sent', 'Quoted / Awaiting Payment', 'Accepted'].includes(status || '') && r.payment?.status !== 'Paid') return 'Await payment';
  if (status === 'Accepted') return 'Start drafting';
  if (status === 'In Progress') return 'Send draft for approval';
  if (status === 'Awaiting Approval') return r.customerApproval?.status === 'Approved' ? 'Mark ready' : r.customerApproval?.status === 'Changes requested' ? 'Revise draft' : 'Await customer approval';
  if (status === 'Ready') return 'Dispatch by courier';
  if (status === 'Dispatched') return 'Complete delivery';
  return 'View details';
}
export function customDateState(r: Pick<CustomRequest, 'status' | 'expectedDate' | 'preferredDate'>, now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const active = !['Completed', 'Declined', 'Cancelled'].includes(r.status);
  return { overdue: !!(active && r.expectedDate && r.expectedDate < today),
    preferencePassed: !!(active && r.preferredDate && r.preferredDate < today), today };
}
export function fileSize(size: number) { return size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`; }
