import { FileText, ClipboardCheck, CreditCard, PenLine, Truck, PackageCheck } from 'lucide-react';
import { WorkflowProgress } from '@/components/ui/WorkflowProgress';
import type { CustomRequest } from '@/lib/custom-agreement';
import { customWorkStage } from '@/lib/custom-workflow';
import { RequestIcon } from './RequestIcon';

export function CustomRequestProgress({ request: r, compact = false, showWhatsAppActions = false, submittedNotifyUrl, reviewNotifyUrl, paymentReminderUrl, draftReminderUrl, courierMessageUrl, feedbackMessageUrl }: { request: CustomRequest; compact?: boolean; showWhatsAppActions?: boolean; submittedNotifyUrl?: string; reviewNotifyUrl?: string; paymentReminderUrl?: string; draftReminderUrl?: string; courierMessageUrl?: string; feedbackMessageUrl?: string }) {
  const closed = ['Cancelled', 'Declined'].includes(r.status);
  const complete = r.status === 'Completed';
  let phase = r.status === 'Completed' ? 4 : ['Ready', 'Dispatched'].includes(r.status) ? 3
    : ['Accepted', 'In Progress', 'Awaiting Approval'].includes(r.status) && r.payment?.status === 'Paid' ? 2
    : ['Quote Sent', 'Quoted / Awaiting Payment', 'Accepted'].includes(r.status) ? 1 : 0;
  if (closed) phase = r.customerApproval?.status === 'Approved' || (r.documents || []).some(d => d.kind === 'final') ? 3
    : r.payment?.status === 'Paid' || (r.documents || []).some(d => d.kind === 'draft') ? 2 : r.quoteAmount ? 1 : 0;
  phase = ['Uploading', 'Submitted'].includes(r.status) ? 0 : phase + 1;
  const labels = ['Submitted', 'Review', 'Payment', 'Draft & approval', 'Courier', 'Delivered'];
  const whatsappAction = (index: number) => {
    if (!showWhatsAppActions) return undefined;
    const href = [submittedNotifyUrl, reviewNotifyUrl, paymentReminderUrl, draftReminderUrl, courierMessageUrl, feedbackMessageUrl][index];
    const label = index < 2 ? 'Notify' : index < 4 ? 'Remind' : index === 4 ? 'Tracking' : 'Feedback';
    const title = ['Notify customer that the request was received', 'Notify customer about the review', 'Remind customer about payment', 'Remind customer to review the draft', 'Send courier tracking details', 'Send feedback link'][index];
    const classes = 'workflow-whatsapp-action relative inline-flex max-w-full flex-nowrap items-center justify-center gap-1 whitespace-nowrap rounded-md border border-emerald-200 bg-emerald-50 text-[10px] font-semibold text-emerald-800';
    const sizing = { minHeight: 24, height: 24, padding: '2px 6px', fontSize: 10, lineHeight: '14px' };
    return href ? <a href={href} target="_blank" rel="noopener noreferrer" title={`${title} on WhatsApp`} aria-label={`${title} on WhatsApp (opens in a new tab)`} style={sizing} className={`${classes} cursor-pointer transition-colors hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600`}><RequestIcon name="brand-whatsapp" small />{label}</a>
      : <button type="button" disabled title="Available at the relevant stage with a valid customer mobile number" style={sizing} className={`${classes} cursor-not-allowed opacity-40`}><RequestIcon name="brand-whatsapp" small />{label}</button>;
  };
  return <section aria-label="Request work status" className="rounded-xl bg-stone-50 p-3">
    {!compact && <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">Work status</h4><span className="text-xs text-stone-600">{closed ? `Closed during ${labels[phase].toLowerCase()}` : customWorkStage(r)}</span></div>}
    <WorkflowProgress steps={labels.map((label, index) => ({ label, icon: [FileText, ClipboardCheck, CreditCard, PenLine, Truck, PackageCheck][index], ...(index === 0 ? { completed: r.status !== 'Uploading' } : {}),
      action: whatsappAction(index),
    }))} current={phase} complete={complete} stopped={closed} attention={r.status === 'Clarification Required' || r.customerApproval?.status === 'Changes requested'} label="Request work status stages" />
    {closed && !compact && <p className="mt-3 border-t border-stone-200 pt-3 text-xs text-stone-600">This request is {r.status.toLowerCase()}. No further action is needed.</p>}
  </section>;
}
