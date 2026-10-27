'use client';

import { useCourierTrackingLinks } from '@/components/order/useCourierTrackingLinks';
import { courierTrackingUrl } from '@/lib/courier-tracking';
import { orderWhatsAppLink } from '@/lib/order-whatsapp';
import { RequestIcon } from '@/components/custom-agreements/RequestIcon';
import { WorkflowProgress } from '@/components/ui/WorkflowProgress';
import { ClipboardCheck, PenLine, Truck, PackageCheck } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { readApiResponse } from '@/lib/api-response';
import { hasDispatchDetails, nextWorkflowAction, type OrderChannel, type WorkflowInput } from '@/lib/order-workflow';
import { stageStart, waitingTime } from '@/lib/admin-work-queue';
import type { Order } from '@/lib/types';

export function OrderWorkflowPanel({ order, channel = 'Online', onSaved, courierPartners = [] }: {
  order: Order; channel?: OrderChannel; onSaved: (order: Order) => void; courierPartners?: string[];
}) {
  const courierLinks = useCourierTrackingLinks();
  const { user } = useAuth();
  const [checks, setChecks] = useState({ details: false, stampAndCopies: false, signingSpace: false });
  const [confirmed, setConfirmed] = useState(false), [allowUnpaid, setAllowUnpaid] = useState(false);
  const [courierName, setCourierName] = useState(''), [tracking, setTracking] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const next = nextWorkflowAction(order, channel);
  const trackingUrl = order.courier ? courierTrackingUrl(order.courier.courierName, order.courier.trackingNumber, courierLinks) : null;
  const whatsAppAction = (stage: 'review' | 'prepare' | 'courier' | 'feedback') => {
    if (channel !== 'Online') return undefined;
    const href = typeof window !== 'undefined' ? orderWhatsAppLink(order, stage, window.location.origin, trackingUrl) : null;
    const label = stage === 'courier' ? 'Tracking' : stage === 'feedback' ? 'Feedback' : 'Notify';
    const classes = 'workflow-whatsapp-action relative inline-flex min-h-6 max-w-full flex-nowrap whitespace-nowrap items-center justify-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-1 text-[10px] font-semibold text-emerald-800';
    return href ? <a href={href} target="_blank" rel="noopener noreferrer" title={`Open WhatsApp ${stage} message`} style={{ minHeight: 24, height: 24, padding: '2px 6px', fontSize: 10, lineHeight: '14px' }} className={`${classes} cursor-pointer transition-colors hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600`}><RequestIcon name="brand-whatsapp" small />{label}<span className="sr-only"> (opens a prefilled message in a new tab)</span></a>
      : <button type="button" disabled title="Available at this stage with a valid customer mobile number" style={{ minHeight: 24, height: 24, padding: '2px 6px', fontSize: 10, lineHeight: '14px' }} className={`${classes} cursor-not-allowed opacity-40`}><RequestIcon name="brand-whatsapp" small />{label}</button>;
  };
  const check = (key: keyof typeof checks, label: string) => <label className="flex items-start gap-3 text-sm text-stone-700"><input className="mt-1 h-4 w-4 shrink-0" type="checkbox" checked={checks[key]} onChange={event => setChecks(previous => ({ ...previous, [key]: event.target.checked }))} />{label}</label>;
  const ready = next.action === 'verify' ? confirmed : next.action === 'prepare' ? Object.values(checks).every(Boolean) && (channel !== 'Counter' || order.payment.status === 'Paid' || allowUnpaid)
    : next.action === 'dispatch' ? !!courierName.trim() && !!tracking.trim() : next.action === 'complete' ? confirmed : false;
  async function save() {
    if (!user || !next.action || !ready || busy) return;
    setBusy(true); setError('');
    try {
      const input: WorkflowInput = { action: next.action, detailsChecked: confirmed, checks, confirmed, allowUnpaid,
        ...(next.action === 'dispatch' ? { courierName, trackingNumber: tracking } : {}) };
      const result = await readApiResponse(await fetch('/api/admin/order-workflow', { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, channel, orderId: order.orderId, updatedAt: order.updatedAt }) }));
      setChecks({ details: false, stampAndCopies: false, signingSpace: false }); setConfirmed(false); setAllowUnpaid(false);
      onSaved(result.order);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update the order.'); }
    finally { setBusy(false); }
  }
  async function refresh() {
    if (!user || busy) return;
    setBusy(true);
    try {
      const result = await readApiResponse(await fetch(`/api/admin/order-workflow?channel=${channel}&orderId=${encodeURIComponent(order.orderId)}`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: 'no-store' }));
      setConfirmed(false); setChecks({ details: false, stampAndCopies: false, signingSpace: false }); setAllowUnpaid(false); setError('');
      onSaved(result.order);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to refresh this order.'); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 sm:p-5" aria-label="Order work status">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base font-bold text-stone-900">{order.status === 'Delivered' ? 'Complete' : next.label}</h3><p className="mt-1 text-sm text-stone-600">{order.status} · {waitingTime({ createdAt: order.createdAt, stageStartedAt: stageStart(order) })}</p></div><span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold">{channel} · {order.payment.status}</span></div>
    <WorkflowProgress label="Fulfilment stages" current={!order.detailsVerifiedAt ? 0 : !order.preparationCompletedAt ? 1 : channel !== 'Counter' && !(hasDispatchDetails(order) && ['Dispatched', 'Delivered'].includes(order.status)) ? 2 : 3} complete={order.status === 'Delivered'} stopped={order.status === 'Cancelled'} attention={order.status === 'Documents needed'} steps={[
      { label: 'Verify details', icon: ClipboardCheck, completed: !!order.detailsVerifiedAt, action: whatsAppAction('review') },
      { label: 'Prepare', icon: PenLine, completed: !!order.preparationCompletedAt, action: whatsAppAction('prepare') },
      { label: channel === 'Counter' ? 'Collection' : 'Dispatch', icon: Truck, completed: channel === 'Counter' ? !!order.preparationCompletedAt : hasDispatchDetails(order) && ['Dispatched', 'Delivered'].includes(order.status), action: whatsAppAction('courier') },
      { label: 'Complete', icon: PackageCheck, completed: order.status === 'Delivered', action: whatsAppAction('feedback') },
    ]} />
    {trackingUrl && <p className="text-sm text-stone-700">{order.courier?.courierName} / {order.courier?.trackingNumber}<a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="ml-3 inline-flex min-h-9 items-center font-semibold text-brand-700 underline">Track on {order.courier?.courierName}<span className="sr-only"> (opens in a new tab)</span></a></p>}
    {next.blocked && <p role="status" className="text-sm text-amber-900">{next.blocked}</p>}
    {next.action === 'verify' && <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I have checked the party details, agreement terms and available proof documents.</label>}
    {next.action === 'prepare' && <div className="space-y-3"><p className="text-sm font-semibold">Preparation checklist</p>{check('details', 'The prepared document matches the verified details.')}{check('stampAndCopies', `The stamp denomination and all ${1 + (order.agreementTerms.extraCopies || 0)} copies are correct.`)}{check('signingSpace', 'All pages, signing areas and witness space are checked.')}{channel === 'Counter' && order.payment.status !== 'Paid' && <label className="flex items-start gap-3 rounded-lg bg-amber-100 p-3 text-sm text-amber-950"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={allowUnpaid} onChange={event => setAllowUnpaid(event.target.checked)} />Prepare this unpaid counter order. Payment is still required before collection.</label>}</div>}
    {next.action === 'dispatch' && <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Courier partner<select value={courierName} onChange={event => setCourierName(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 font-normal"><option value="">Select courier partner</option>{courierPartners.map(name => <option key={name} value={name}>{name}</option>)}</select></label><label className="text-sm font-semibold">Tracking number<input value={tracking} maxLength={150} onChange={event => setTracking(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-normal" /></label></div>}
    {next.action === 'complete' && <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />{channel === 'Counter' ? 'The customer has collected the prepared document.' : 'Delivery has been confirmed with the customer or courier.'}</label>}
    {next.action && <button type="button" disabled={!ready || busy} onClick={() => void save()} className="min-h-11 rounded-xl bg-blue-800 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : next.label}</button>}
    {error && <div><p role="alert" className="text-sm text-rose-800">{error}</p><button type="button" disabled={busy} onClick={() => void refresh()} className="mt-2 min-h-11 rounded-lg border border-stone-300 bg-white px-4 text-sm font-semibold">Refresh order</button></div>}
  </section>;
}
