'use client';
import { openPaymentCheckout } from '@/lib/open-payment-checkout';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Truck } from 'lucide-react';
import { CourierTrackingButton } from '@/components/order/CourierTrackingButton';
import { draftApprovalWhatsAppLink, quoteWhatsAppLink, courierWhatsAppLink, feedbackWhatsAppLink, requestStatusWhatsAppLink } from '@/lib/draft-whatsapp';
import { getCourierPartners } from '@/lib/courier-service';
import { courierTrackingUrl } from '@/lib/courier-tracking';
import { useCourierTrackingLinks } from '@/components/order/useCourierTrackingLinks';
import { ListFilters, DateFilterFields } from '@/components/ui/ListFilters';
import { RequestIcon } from './RequestIcon';
import { CustomRequestProgress } from './CustomRequestProgress';
import { useAuth } from '@/lib/auth-context';
import { readApiResponse } from '@/lib/api-response';
import { CUSTOM_STATUSES, CustomRequest, CustomStatus, canTransition, type SampleDescriptor } from '@/lib/custom-agreement';
import { customWorkStage, customNextAction, customDateState, fileSize, customStageFilters } from '@/lib/custom-workflow';
const input = 'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm';
const statusStyles: Record<CustomRequest['status'], string> = {
  Uploading: 'border-slate-300 bg-slate-100 text-slate-800',
  Submitted: 'border-blue-200 bg-blue-50 text-blue-800',
  'Under Review': 'border-blue-200 bg-blue-50 text-blue-800',
  'Clarification Required': 'border-yellow-300 bg-yellow-50 text-yellow-900',
  'Quote Sent': 'border-yellow-300 bg-yellow-50 text-yellow-900',
  'Quoted / Awaiting Payment': 'border-yellow-300 bg-yellow-50 text-yellow-900',
  Accepted: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  'In Progress': 'border-blue-200 bg-blue-50 text-blue-800',
  'Awaiting Approval': 'border-amber-300 bg-amber-50 text-amber-900',
  Dispatched: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  Ready: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Completed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Declined: 'border-red-300 bg-red-50 text-red-800',
  Cancelled: 'border-red-200 bg-red-50 text-red-800',
};

async function api(token: string, url: string, method = 'GET', body?: unknown) {
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return readApiResponse(response);
}
export function CustomRequests({ admin = false, focusRequestId }: { admin?: boolean; focusRequestId?: string }) {
  const { user } = useAuth();
  return <RequestsBody key={`${user?.uid ?? 'guest'}-${admin}-${focusRequestId || 'all'}`} admin={admin} focusRequestId={focusRequestId} />;
}
function RequestsBody({ admin = false, focusRequestId }: { admin?: boolean; focusRequestId?: string }) {
  const { user, loading: authLoading, signIn } = useAuth();
  const [requests, setRequests] = useState<CustomRequest[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const loadSequence = useRef(0);
  const invalidateLoads = useCallback(() => { ++loadSequence.current; }, []);
  const [search, setSearch] = useState(focusRequestId || '');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [from, setFrom] = useState(''), [to, setTo] = useState('');
  const [cursors, setCursors] = useState<string[]>([]), [nextCursor, setNextCursor] = useState<string | null>(null);
  const [paymentReturn] = useState(() => !admin && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('paymentRequest') || new URLSearchParams(window.location.search).get('requestId') || '' : '');
  const [selectedId, setSelectedId] = useState(focusRequestId || paymentReturn);
  const [cancellingId, setCancellingId] = useState('');
  const closePanel = useCallback(() => setSelectedId(''), []);
  const cursor = cursors.at(-1) || '';
  const focusedRequest = admin && focusRequestId && search === focusRequestId ? focusRequestId : '';
  const filteredRequests = requests.filter(request => [request.requestId, request.publicReference || '', request.name, request.phone, request.email, request.agreementType, request.assignedTo ?? ''].some(value => value.toLowerCase().includes(search.trim().toLowerCase())));
  const load = useCallback(async () => {
    if (!user) return;
    const sequence = ++loadSequence.current;
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams(admin ? { scope: 'admin', stage: statusFilter } : {});
      if (focusedRequest) params.set('requestId', focusedRequest);
      if (cursor) params.set('cursor', cursor);
      if (from) params.set('from', from); if (to) params.set('to', to);
      const result = await api(await user.getIdToken(), `/api/custom-agreements?${params}`);
      if (paymentReturn && !result.requests.some((r: CustomRequest) => r.requestId === paymentReturn)) { const focused = await api(await user.getIdToken(), `/api/custom-agreements?requestId=${encodeURIComponent(paymentReturn)}`); result.requests = [...focused.requests, ...result.requests]; }
      if (sequence === loadSequence.current) { setRequests(result.requests); setNextCursor(result.nextCursor || null); }
    }
    catch (err) { if (sequence === loadSequence.current) setError((err as Error).message); }
    finally { if (sequence === loadSequence.current) setLoading(false); }
  }, [user, admin, focusedRequest, cursor, from, to, statusFilter, paymentReturn]);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) void load(); });
    return () => { active = false; invalidateLoads(); };
  }, [load, invalidateLoads]);
  async function cancelRequest(request: CustomRequest) {
    if (!user || cancellingId || !window.confirm('Cancel this custom agreement request?')) return;
    setCancellingId(request.requestId); setError('');
    try {
      await api(await user.getIdToken(), '/api/custom-agreements', 'PATCH', { requestId: request.requestId, updatedAt: request.updatedAt, action: 'cancel' });
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to cancel this request.'); }
    finally { setCancellingId(''); }
  }
  if (authLoading) return <p role="status">Checking your sign-in…</p>;
  if (!user) return <div className="rounded-2xl border border-stone-200 bg-white p-6 space-y-4"><p>Sign in to view your custom agreement requests.</p><button className="rounded-xl bg-amber-600 px-5 py-3 font-semibold text-white" onClick={() => { void signIn().catch((err) => setError(err.message)); }}>Sign In</button>{error && <p role="alert" className="text-rose-700">{error}</p>}</div>;
  return <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3">{admin ? <h2 className="text-xl font-bold">Custom Agreement Requests</h2> : <p className="text-sm text-stone-500" aria-live="polite">{loading ? 'Loading requests...' : `${requests.length} ${requests.length === 1 ? 'request' : 'requests'}`}</p>}<button disabled={loading} onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"><RequestIcon name="refresh" />{loading ? 'Loading…' : 'Refresh'}</button></div>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-800">{error}</p>}
    {!loading && !error && !requests.length && <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-6 text-center"><h3 className="font-bold text-stone-900">No requests yet</h3><p className="text-sm text-stone-600">Your custom agreement requests and quotes will appear here.</p>{!admin && <Link href="/custom-agreement" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white hover:bg-brand-800">Start your first request</Link>}</div>}
    <div className="flex items-center gap-2"><label className="min-w-0 flex-1"><span className="sr-only">Search this page</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name or reference" className={`${input} min-h-11`} /></label><ListFilters activeCount={Number(!!from) + Number(!!to) + Number(statusFilter !== 'ALL')} onClear={() => { setStatusFilter('ALL'); setFrom(''); setTo(''); setCursors([]); }}>
      {admin && <label className="block text-sm font-semibold">Work stage<select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setCursors([]); }} className={`${input} mt-1`}>{customStageFilters.map(filter => <option key={filter.value} value={filter.value}>{filter.label}</option>)}</select></label>}
      <DateFilterFields from={from} to={to} setFrom={value => { setFrom(value); setCursors([]); }} setTo={value => { setTo(value); setCursors([]); }} fromLabel="Submitted from" toLabel="Submitted to" />
    </ListFilters></div>
    <p aria-live="polite" className="text-xs text-stone-500">{filteredRequests.length} of {requests.length} shown</p>
    {admin && !loading && !error && requests.length > 0 && filteredRequests.length === 0 && <p className="rounded-xl border border-stone-200 bg-white p-5 text-sm text-stone-600">No requests match your search or selected work stage.</p>}
    {admin ? <div className="overflow-hidden rounded-xl border border-stone-200 bg-white divide-y divide-stone-200">{filteredRequests.map(request => {
      const dates = customDateState(request);
      return <div key={request.requestId} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-bold">{request.publicReference || request.requestId}</span><CopyReference value={request.publicReference || request.requestId} /><span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusStyles[request.status]}`}>{customWorkStage(request)}</span><span className={`rounded-full px-2 py-1 text-xs font-semibold ${request.payment?.status === 'Paid' ? 'bg-emerald-50 text-emerald-900' : 'bg-stone-100 text-stone-700'}`}>{request.payment?.status === 'Paid' ? 'Paid' : request.payment?.status === 'Pending' ? 'Payment pending' : 'Unpaid'}</span></div>
        <p className="mt-2 break-words text-sm font-semibold">{request.name} <span className="font-normal text-stone-600">/ {request.agreementType}</span></p>
        <p className={`mt-1 text-xs ${dates.overdue ? 'font-semibold text-rose-800' : 'text-stone-600'}`}>{request.expectedDate ? `${dates.overdue ? 'Overdue / ' : ''}Committed: ${request.expectedDate}` : 'No committed date'}{request.preferredDate ? ` / Customer preference: ${request.preferredDate}${dates.preferencePassed ? ' (passed)' : ''}` : ''}</p></div>
        <button onClick={() => setSelectedId(request.requestId)} className="min-h-11 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-900">{request.status === 'Dispatched' ? 'View details' : customNextAction(request)}</button>
      </div>;
    })}</div> : filteredRequests.length > 0 && <div className="space-y-4">{filteredRequests.map(request => <details key={request.requestId} className="group/request rounded-2xl border border-stone-200 bg-white shadow-sm">
      <summary className="cursor-pointer list-none space-y-2 p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 [&::-webkit-details-marker]:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><h3 className="font-mono text-sm font-semibold text-stone-900">{request.publicReference || request.requestId}</h3><CopyReference value={request.publicReference || request.requestId} /></div><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[request.status]}`}>{customWorkStage(request)}</span></div>
      <div className="flex items-center justify-between gap-3"><p className="break-words text-sm font-semibold text-stone-900">{request.name}</p><ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-stone-400 transition-transform group-open/request:rotate-180" /></div>
      {customerNeedsAction(request) && <p className="text-xs font-semibold text-amber-800">Action needed: {customerRequestAction(request)}</p>}
      </summary><div className="space-y-3 border-t border-stone-100 p-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4"><div><dt className="text-stone-500">Document type</dt><dd className="mt-0.5 break-words font-medium text-stone-800">{request.agreementType === 'Custom document' ? request.purpose : request.agreementType}</dd></div><div><dt className="text-stone-500">Language</dt><dd className="mt-0.5 font-medium text-stone-800">{request.language}</dd></div><div><dt className="text-stone-500">Printed copies</dt><dd className="mt-0.5 font-medium text-stone-800">{1 + (request.extraCopies || 0)} on {String.fromCharCode(8377)}{request.stampPaperDenomination || 100} stamp</dd></div><div><dt className="text-stone-500">Requested on</dt><dd className="mt-0.5 font-medium text-stone-800">{new Date(request.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}</dd></div></dl>
      <CustomRequestProgress request={request} compact />
      <div className="flex flex-wrap items-center gap-2">{customerNeedsAction(request) && <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">Action needed</span>}<p className="text-xs leading-5 text-stone-600">{customerRequestUpdate(request)}</p></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-3"><p className={`text-sm font-semibold ${request.payment?.status === 'Paid' ? 'text-emerald-700' : 'text-stone-700'}`}>{request.payment?.status === 'Paid' ? `${String.fromCharCode(8377)}${request.payment.amount.toLocaleString('en-IN')} Paid` : request.quoteAmount !== undefined ? `Quote: ${String.fromCharCode(8377)}${request.quoteAmount.toLocaleString('en-IN')}${request.payment?.status === 'Pending' && !request.payment.retryAvailable ? ' / Payment pending' : ''}` : 'Quote not received yet'}</p><div className="flex flex-wrap items-center gap-2">{customerNeedsAction(request) && <button type="button" onClick={() => setSelectedId(request.requestId)} className={`min-h-9 rounded-lg px-3 text-xs font-semibold text-white ${['Quote Sent', 'Quoted / Awaiting Payment', 'Accepted'].includes(request.status) && request.payment?.status !== 'Paid' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-brand-700 hover:bg-brand-800'}`}>{customerRequestAction(request)}</button>}{!customerNeedsAction(request) && <button type="button" onClick={() => setSelectedId(request.requestId)} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 text-xs font-semibold text-sky-700 hover:bg-sky-100"><RequestIcon name="eye" small />View request</button>}{['Uploading', 'Submitted', 'Under Review', 'Clarification Required', 'Quote Sent', 'Quoted / Awaiting Payment'].includes(request.status) && <div className="ml-1 border-l border-stone-200 pl-2"><button type="button" disabled={!!cancellingId || (request.payment?.status === 'Pending' && !request.payment.retryAvailable)} title={request.payment?.status === 'Pending' && !request.payment.retryAvailable ? 'Check the pending payment before cancelling' : 'Cancel request'} onClick={() => void cancelRequest(request)} className="h-9 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">{cancellingId === request.requestId ? 'Cancelling...' : 'Cancel request'}</button></div>}</div></div>
    </div></details>)}</div>}

    {(admin || cursors.length > 0 || nextCursor) && <div className="flex items-center justify-between gap-3"><button disabled={loading || !cursors.length} onClick={() => setCursors(previous => previous.slice(0, -1))} className="min-h-11 rounded-lg border px-4 text-sm font-semibold disabled:opacity-40">Previous</button><span className="text-sm text-stone-600">Page {cursors.length + 1}</span><button disabled={loading || !nextCursor} onClick={() => { if (nextCursor) setCursors(previous => [...previous, nextCursor]); }} className="min-h-11 rounded-lg border px-4 text-sm font-semibold disabled:opacity-40">Next</button></div>}
    {selectedId && requests.find(r => r.requestId === selectedId) && <RequestPanel onClose={closePanel} compact={!admin}><RequestCard key={`${selectedId}-${requests.find(r => r.requestId === selectedId)!.updatedAt}`} request={requests.find(r => r.requestId === selectedId)!} admin={admin} token={() => user.getIdToken()} refresh={load} onClose={closePanel} /></RequestPanel>}
  </section>;
}
function paymentMessage(result: { state?: string; retryAvailable?: boolean; reviewRequired?: boolean }) {
  if (result.retryAvailable) return 'Payment was not completed. You can retry now.';
  if (result.reviewRequired) return 'The gateway is still processing this payment. Contact our team before trying another payment.';
  if (result.state === 'PENDING') return 'Payment confirmation is pending. We check automatically every 15 seconds, with a safe-retry check after 20 minutes.';
  return 'Payment did not complete. You can retry payment.';
}
function customerRequestUpdate(r: CustomRequest) {
  if (r.status === 'Cancelled') return 'This request is cancelled.';
  if (r.status === 'Declined') return 'We are unable to proceed with this request. Open the request for details.';
  if (r.status === 'Uploading') return 'Complete sample verification to submit your request.';
  if (r.status === 'Clarification Required') return 'We need more information. Open your request to reply.';
  if (r.status === 'Awaiting Approval') return r.customerApproval?.status === 'Pending' ? 'Your draft is ready. Review it and approve or request changes.' : r.customerApproval?.status === 'Changes requested' ? 'We have received your changes and will update the draft.' : 'Your draft approval has been received.';
  if (['Quote Sent', 'Quoted / Awaiting Payment', 'Accepted'].includes(r.status) && r.payment?.status !== 'Paid') return r.payment?.retryAvailable ? 'Payment was not completed. You can retry now.' : 'Your quote is ready. Open your request to review payment.';
  if (r.status === 'In Progress' || r.status === 'Accepted') return 'We are preparing your custom document.';
  if (r.status === 'Ready') return 'Your approved agreement is being prepared for courier dispatch.';
  if (r.status === 'Dispatched') return 'Your agreement is on its way. Open the request for courier tracking.';
  if (r.status === 'Completed') return 'Your agreement has been delivered.';
  return r.status === 'Submitted' ? 'Your request is received and waiting for review.' : 'We are reviewing your requirements and samples.';
}

function customerNeedsAction(r: CustomRequest) {
  return r.status === 'Uploading' || r.status === 'Clarification Required' || (r.status === 'Awaiting Approval' && r.customerApproval?.status === 'Pending') || (['Quote Sent', 'Quoted / Awaiting Payment', 'Accepted'].includes(r.status) && r.payment?.status !== 'Paid');
}
function customerRequestAction(r: CustomRequest) {
  if (r.status === 'Uploading') return 'Finish submission';
  if (r.status === 'Clarification Required') return 'Reply';
  if (r.status === 'Awaiting Approval' && r.customerApproval?.status === 'Pending') return 'Review draft';
  if (['Quote Sent', 'Quoted / Awaiting Payment', 'Accepted'].includes(r.status) && r.payment?.status !== 'Paid') return r.payment?.retryAvailable ? 'Retry payment' : r.payment?.status === 'Pending' ? 'Check payment' : 'View quote & pay';
  if ((r.documents || []).some(d => d.kind === 'final')) return 'View document';
  return 'View details';
}
function RequestCard({ request: r, admin, token, refresh, onClose }: { request: CustomRequest; admin: boolean; token: () => Promise<string>; refresh: () => Promise<void>; onClose?: () => void }) {
  const [status, setStatus] = useState<CustomRequest['status']>(r.status === 'Quote Sent' ? 'Quoted / Awaiting Payment' : r.status);
  const [message, setMessage] = useState(r.customerMessage ?? ''), [quote, setQuote] = useState((r.quoteBaseAmount ?? r.quoteAmount)?.toString() ?? '');
  const [validUntil, setValidUntil] = useState(r.quoteValidUntil || '');
  const [preview, setPreview] = useState<{ url: string; name: string; contentType: string } | null>(null);
  const dateState = customDateState(r);
  const quoteExpired = !!r.quoteValidUntil && r.quoteValidUntil < dateState.today;
  const quoteLocked = r.payment?.status === 'Pending' || r.payment?.status === 'Paid' || ['Accepted', 'In Progress', 'Awaiting Approval', 'Ready', 'Dispatched', 'Completed'].includes(r.status);
  const baseQuote = Number(quote);
  const [paymentNotice, setPaymentNotice] = useState('');
  const paymentChecking = useRef(false);
  const [reply, setReply] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const draftFileInput = useRef<HTMLInputElement>(null);
  const courierLinks = useCourierTrackingLinks();
  const [courierPartners, setCourierPartners] = useState<string[]>([]);
  const [courierName, setCourierName] = useState(r.courier?.courierName || '');
  const [trackingNumber, setTrackingNumber] = useState(r.courier?.trackingNumber || '');
  const [deliveryConfirmed, setDeliveryConfirmed] = useState(false);
  useEffect(() => {
    if (!admin || r.status !== 'Ready') return;
    let active = true;
    void getCourierPartners().then(partners => { if (active) setCourierPartners(partners); }).catch(() => { if (active) setError('Could not load courier partners. Refresh the request to retry.'); });
    return () => { active = false; };
  }, [admin, r.status]);
  const draftWhatsAppUrl = typeof window !== 'undefined' ? draftApprovalWhatsAppLink(r, window.location.origin) : null;
  const quoteWhatsAppUrl = typeof window !== 'undefined' ? quoteWhatsAppLink(r, window.location.origin) : null;
  const trackingUrl = r.courier ? courierTrackingUrl(r.courier.courierName, r.courier.trackingNumber, courierLinks) : null;
  const courierMessageUrl = typeof window !== 'undefined' ? courierWhatsAppLink(r, window.location.origin, trackingUrl) : null;
  const feedbackMessageUrl = typeof window !== 'undefined' ? feedbackWhatsAppLink(r, window.location.origin) : null;
  const courierSummary = r.courier && <section className="rounded-xl border border-sky-200 bg-sky-50 p-3"><h4 className="flex items-center gap-2 text-sm font-semibold text-sky-900"><Truck aria-hidden="true" className="h-4 w-4" />{r.status === 'Completed' ? 'Delivered by courier' : 'Dispatched by courier'}</h4><div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs text-sky-900"><span>{r.courier.courierName} / Consignment: <strong>{r.courier.trackingNumber}</strong></span>{trackingUrl && <CourierTrackingButton className="ml-auto" href={trackingUrl} courierName={r.courier.courierName} trackingNumber={r.courier.trackingNumber} />}</div></section>;
  async function action(body: Record<string, unknown>, method = 'PATCH') {
    setBusy(true); setError('');
    try { await api(await token(), '/api/custom-agreements', method, { requestId: r.requestId, updatedAt: r.updatedAt, ...body, ...(body.status === 'Dispatched' ? { courierName, trackingNumber } : {}), ...(body.status === 'Completed' ? { deliveryConfirmed } : {}) }); await refresh(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  async function payment(action: 'pay' | 'status') {
    if (paymentChecking.current) return;
    paymentChecking.current = true;
    try {
      const authorization = await token();
      setBusy(true); setError(''); setPaymentNotice('');
      const result = await api(authorization, '/api/custom-agreements/payment', 'POST', { requestId: r.requestId, action, quoteAmount: r.quoteAmount });
      if (result.redirectUrl && action === 'pay') { await openPaymentCheckout(result.redirectUrl); return; }
      if (!result.paid) setPaymentNotice(paymentMessage(result));
      await refresh();
    } catch (err) { setError((err as Error).message); }
    finally { paymentChecking.current = false; setBusy(false); }
  }
  useEffect(() => {
    if (admin || r.payment?.status !== 'Pending' || r.payment.retryAvailable || r.payment.reviewRequired) return;
    let active = true, checks = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const checkStatus = async () => {
      if (!active) return;
      if (paymentChecking.current) { timer = setTimeout(checkStatus, 15000); return; }
      paymentChecking.current = true;
      try {
        const result = await api(await token(), '/api/custom-agreements/payment', 'POST', { requestId: r.requestId, action: 'status', quoteAmount: r.quoteAmount });
        if (!active) return;
        if (!result.paid) setPaymentNotice(paymentMessage(result));
        if (result.paid || result.retryAvailable || result.reviewRequired || ['FAILED', 'EXPIRED'].includes(result.state)) { await refresh(); return; }
        if (++checks <= 80) timer = setTimeout(checkStatus, 15000);
        else setPaymentNotice('Confirmation is taking longer than expected. Check payment again or contact our team.');
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : 'Unable to check payment status.'); }
      finally { paymentChecking.current = false; }
    };
    void checkStatus();
    return () => { active = false; if (timer) clearTimeout(timer); };
    // This request's panel owns the polling timer; a changed request version remounts it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function openFile(file: SampleDescriptor, previewFile = false, document = false) {
    setBusy(true); setError('');
    try {
      const result = await api(await token(), `/api/custom-agreements/sample?requestId=${encodeURIComponent(r.requestId)}&${document ? 'documentId' : 'sampleId'}=${encodeURIComponent(file.id)}${previewFile ? '&preview=1' : ''}`);
      if (previewFile) setPreview({ url: result.url, name: file.name, contentType: file.contentType }); else window.location.assign(result.url);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function uploadDocument(file: File, kind: 'draft' | 'final') {
    setBusy(true); setError('');
    try {
      await readApiResponse(await fetch(`/api/custom-agreements/document?requestId=${r.requestId}&kind=${kind}&name=${encodeURIComponent(file.name)}`, { method: 'POST', headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': file.type }, body: file }));
      await refresh();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  const fileRow = (file: SampleDescriptor, document = false) => <li key={file.id} className={`flex flex-wrap items-center rounded-lg border border-stone-200 ${admin ? 'gap-3 p-3 text-sm' : 'gap-2 bg-white/70 p-2 text-xs'}`}>{admin ? <RequestIcon name="file-text" /> : <span className={`inline-flex h-8 min-w-9 shrink-0 items-center justify-center rounded-md px-1.5 text-[10px] font-bold tracking-wide ${file.contentType === 'application/pdf' ? 'bg-rose-50 text-rose-700' : file.contentType.startsWith('image/') ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-700'}`}>{file.contentType === 'application/pdf' ? 'PDF' : file.contentType.startsWith('image/') ? 'IMG' : 'FILE'}</span>}<span className="min-w-0 flex-1 basis-[calc(100%-2rem)] break-words sm:basis-0">{file.name}<span className="block text-xs text-stone-500">{fileSize(file.size)}</span></span>{r.status !== 'Uploading' && <>{admin && ['application/pdf', 'image/jpeg', 'image/png'].includes(file.contentType) && <button disabled={busy} onClick={() => void openFile(file, true, document)} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 text-xs font-semibold text-sky-800 transition hover:bg-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:opacity-50"><RequestIcon name="eye" />Preview</button>}<button disabled={busy} onClick={() => void openFile(file, false, document)} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50"><RequestIcon name="download" />Download</button></>}</li>;
  const primaryStatus = r.status === 'Submitted' ? 'Under Review' : r.status === 'Accepted' && r.payment?.status === 'Paid' ? 'In Progress' : r.status === 'In Progress' ? 'Awaiting Approval' : r.status === 'Awaiting Approval' && r.customerApproval?.status === 'Approved' ? 'Ready' : r.status === 'Awaiting Approval' && r.customerApproval?.status === 'Changes requested' ? 'In Progress' : r.status === 'Ready' ? 'Dispatched' : r.status === 'Dispatched' ? 'Completed' : undefined;
  if (!admin) return <article className="flex h-full min-h-0 flex-col overflow-hidden text-sm text-stone-900">
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4 pt-2 sm:px-6">
      <div className="flex justify-end"><button type="button" aria-label="Close request details" title="Close" onClick={onClose} className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600"><RequestIcon name="x" /></button></div>
    <CustomerRequestSection title="Request information" number="01" collapsible={r.customerApproval?.status === 'Approved'}><table className="w-full table-fixed border-separate border-spacing-0 overflow-hidden rounded-xl border border-stone-200 text-left text-xs"><caption className="sr-only">Requirements and contact information</caption><tbody className="divide-y divide-stone-100">{[
      ['Purpose', r.purpose],
      ['Instructions', r.instructions],
      ['Notary', r.includeNotary ? 'Requested' : 'Not requested'],
      ['Preferred date', r.preferredDate || 'Not specified'],
      ...(r.expectedDate ? [['Confirmed date', r.expectedDate]] : []),
      ['Phone', r.phone],
      ...(r.email ? [['Email', r.email]] : []),
      ...(r.customerReply ? [['Your clarification', r.customerReply]] : []),
      ...(r.customerApproval?.message ? [['Requested changes', r.customerApproval.message]] : []),
    ].map(([label, value]) => <tr key={label} className="odd:bg-slate-50/80 even:bg-white"><th scope="row" className="w-[32%] border-b border-stone-100 px-2.5 py-2 align-top font-medium text-slate-500">{label}</th><td className="whitespace-pre-wrap break-words border-b border-stone-100 px-2.5 py-2 align-top leading-5 text-slate-900">{value}</td></tr>)}</tbody></table></CustomerRequestSection>
    <CustomerRequestSection title="Files" number="02" collapsible={r.customerApproval?.status === 'Approved'}>
      {(r.documents || []).some(d => d.kind === 'final') && <section className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3"><div className="mb-3"><h5 className="text-sm font-semibold text-emerald-900">Final document</h5><p className="mt-0.5 text-xs text-emerald-800">Completed document from our team. Ready to download.</p></div><ul className="space-y-2">{(r.documents || []).filter(d => d.kind === 'final').slice().reverse().map(d => fileRow(d, true))}</ul></section>}
      {(() => {
        const drafts = (r.documents || []).filter(d => d.kind === 'draft').slice().reverse();
        const current = drafts.find(d => d.id === r.customerApproval?.documentId) || drafts[0];
        if (!current) return null;
        const older = drafts.filter(d => d.id !== current.id);
        return <section className="rounded-xl border border-sky-200 bg-sky-50/80 p-3"><div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div><h5 className="text-sm font-semibold text-sky-900">Draft from our team</h5><p className="mt-0.5 text-xs text-sky-800">Download and review this document before approving.</p></div><span className="rounded-full border border-sky-200 bg-white px-2 py-1 text-[10px] font-semibold text-sky-800">{r.customerApproval?.status === 'Pending' ? 'Awaiting your approval' : r.customerApproval?.status === 'Approved' ? 'Approved' : r.customerApproval?.status === 'Changes requested' ? 'Changes requested' : 'Latest draft'}</span></div><p className="mb-2 text-[11px] font-semibold text-sky-800">Version {current.version} / Shared {new Date(current.publishedAt || current.uploadedAt).toLocaleDateString('en-IN')}</p><ul>{fileRow(current, true)}</ul>{r.status === 'Awaiting Approval' && <section className="mt-3 space-y-3 border-t border-sky-200 pt-3">{r.customerApproval?.status === 'Pending' && <><button disabled={busy} onClick={() => { if (window.confirm('Approve this draft for the final document?')) void action({ action: 'approve-draft', documentId: r.customerApproval?.documentId }); }} className="min-h-11 w-full rounded-lg bg-emerald-700 px-4 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">Approve draft</button><details><summary className="cursor-pointer text-sm font-semibold text-brand-700">Request changes</summary><label className="mt-2 block">Changes needed<textarea value={reply} maxLength={3000} rows={2} onChange={e => setReply(e.target.value)} className={`${input} mt-1`} /></label><button disabled={busy || reply.trim().length < 5} onClick={() => void action({ action: 'request-revision', documentId: r.customerApproval?.documentId, customerReply: reply })} className="mt-2 min-h-11 rounded-lg border border-blue-200 bg-white px-4 font-semibold disabled:opacity-50">Send changes</button></details></>}</section>}{older.length > 0 && <details className="mt-3 border-t border-sky-200 pt-2"><summary className="cursor-pointer text-xs font-medium text-sky-800">Previous drafts ({older.length})</summary><ul className="mt-2 space-y-2">{older.map(d => <li key={d.id}><p className="mb-1 text-[11px] text-slate-500">Version {d.version}</p><ul>{fileRow(d, true)}</ul></li>)}</ul></details>}</section>;
      })()}
      <details open={!(r.documents || []).length} className="rounded-xl border border-dashed border-stone-300 bg-white/60 p-3"><summary className="cursor-pointer text-xs font-semibold text-slate-600">Your uploaded samples ({Object.keys(r.files).length})<span className="mt-1 block text-[11px] font-normal text-slate-500">Reference files you sent us. These are not drafts for approval.</span></summary><ul className="mt-3 space-y-2">{Object.values(r.files).map(file => fileRow(file))}</ul></details>
    </CustomerRequestSection>

    {preview && <section className="border-b border-stone-100 pb-3"><div className="mb-2 flex items-center justify-between gap-2"><h4 className="break-all text-sm font-semibold">{preview.name}</h4><button onClick={() => setPreview(null)} className="min-h-10 rounded-lg border border-stone-200 px-3">Close preview</button></div>{preview.contentType === 'application/pdf' ? <iframe title={preview.name} src={preview.url} className="h-[55vh] w-full rounded-lg bg-white" /> : <div role="img" aria-label={preview.name} className="h-[55vh] bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${JSON.stringify(preview.url)})` }} />}</section>}

    {r.payment?.status === 'Paid' && r.payment.reviewRequired && ['Cancelled', 'Declined'].includes(r.status) && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Payment arrived after this request was closed. Please contact our team for refund review.</p>}

    {r.payment?.status === 'Pending' && !['Cancelled', 'Declined'].includes(r.status) && <div role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">{paymentNotice || (r.payment.retryAvailable ? 'Payment was not completed. You can retry now.' : r.payment.reviewRequired ? 'The gateway is still processing this payment. Contact our team before trying another payment.' : 'Checking payment automatically every 15 seconds. After 20 minutes, we will check whether a safe retry is available.')}</div>}
    {paymentNotice && r.payment?.status !== 'Pending' && <p role="status" className="rounded-lg bg-stone-100 p-3 text-sm">{paymentNotice}</p>}
    {r.customerMessage && <section className="border-l-2 border-sky-300 pl-3"><h4 className="font-semibold text-blue-900">Message from our team</h4><p className="mt-1 whitespace-pre-wrap break-words text-blue-950">{r.customerMessage}</p></section>}
    {r.status === 'Clarification Required' && <section className="space-y-2 border-b border-stone-100 pb-3"><label className="block font-semibold">Your reply<textarea maxLength={3000} rows={3} className={`${input} mt-2`} value={reply} onChange={e => setReply(e.target.value)} /></label><button disabled={busy || reply.trim().length < 5} onClick={() => void action({ action: 'reply', customerReply: reply })} className="min-h-11 rounded-lg bg-brand-700 px-4 font-semibold text-white disabled:opacity-50">Send reply</button></section>}
    {r.status === 'Uploading' && <section className="border-l-2 border-amber-400 pl-3"><p>Your samples still need verification.</p><button disabled={busy} onClick={() => void action({ action: 'finalize' }, 'POST')} className="mt-3 min-h-11 rounded-lg bg-brand-700 px-4 font-semibold text-white">Retry verification</button></section>}





    {courierSummary}
    </div>
    {(busy || error) && <div className="max-h-24 shrink-0 overflow-y-auto border-t border-sky-100 bg-white px-5 py-2 sm:px-6">{busy && <p role="status" className="text-sm text-brand-800">Processing...</p>}{error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}</div>}
    {r.quoteAmount !== undefined && <section aria-label="Quote and payment" className="relative z-20 shrink-0 border-t border-sky-200 bg-gradient-to-r from-sky-50 to-white px-5 py-3 shadow-[0_-4px_16px_rgba(14,116,144,0.08)] sm:px-6" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0"><h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total quote</h4><div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1"><strong className="text-2xl font-bold tracking-tight text-brand-900">{String.fromCharCode(8377)}{r.quoteAmount.toLocaleString('en-IN')}</strong><span className={`inline-flex items-center gap-1.5 text-[11px] ${r.payment?.status === 'Paid' ? 'text-emerald-800' : 'text-slate-600'}`}><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${r.payment?.status === 'Paid' ? 'bg-emerald-500' : 'bg-amber-500'}`} />{r.payment?.status === 'Paid' ? 'Paid' : r.payment?.retryAvailable ? 'Payment not completed' : r.payment?.reviewRequired ? 'Payment needs review' : r.payment?.status === 'Pending' ? 'Awaiting confirmation' : 'Not paid'}</span></div></div>
        {r.payment?.status !== 'Paid' && ['Quote Sent', 'Quoted / Awaiting Payment', 'Accepted'].includes(r.status) && <div className="flex flex-wrap items-center gap-2">{(r.payment?.status !== 'Pending' || r.payment.retryAvailable) && <button disabled={busy || (quoteExpired && !r.payment?.retryAvailable)} onClick={() => void payment('pay')} className="min-h-10 rounded-lg bg-emerald-700 px-4 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50">{busy ? 'Please wait...' : r.payment?.retryAvailable ? 'Retry payment' : 'Accept quote & pay'}</button>}{r.payment?.merchantOrderId && <button disabled={busy} onClick={() => void payment('status')} className="min-h-10 rounded-lg border border-sky-200 bg-white px-3 text-xs font-semibold text-brand-800 hover:bg-sky-50 disabled:opacity-50">Check payment</button>}</div>}
      </div>
      {(r.quoteValidUntil || !!r.extraCopies) && <p className="mt-2 text-[11px] leading-4 text-slate-500">{r.quoteValidUntil ? `Valid until ${r.quoteValidUntil}` : ''}{r.quoteValidUntil && r.extraCopies ? ' / ' : ''}{r.extraCopies ? `Includes ${r.extraCopies} extra stamped ${r.extraCopies === 1 ? 'copy' : 'copies'}` : ''}</p>}
      {quoteExpired && r.payment?.status !== 'Paid' && <p className="mt-2 text-xs text-amber-800">Quote expired. Contact our team for an updated quote.</p>}
    </section>}


  </article>;
  const adminSections = {
    customer: <>
      <section className="overflow-hidden rounded-xl border border-sky-300 bg-sky-100" aria-label="Customer">
      <div className="flex flex-wrap items-center gap-3 bg-sky-100 px-4 py-2.5"><div aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-bold text-sky-800 shadow-sm ring-1 ring-sky-100">{r.name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()}</div><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-wider text-sky-700">Customer</p><h4 className="mt-0.5 break-words text-sm font-bold text-brand-900">{r.name}</h4><dl className="mt-1 space-y-0.5 text-xs"><div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-2"><dt className="text-slate-500">Phone</dt><dd className="font-medium text-slate-700">{r.phone}</dd></div>{r.email && <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-2"><dt className="text-slate-500">Email</dt><dd className="break-all font-medium text-slate-700">{r.email}</dd></div>}</dl></div><div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:ml-auto"><a className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-3 text-xs font-semibold text-sky-800 hover:bg-sky-100" href={`tel:${r.phone}`}><RequestIcon name="phone" small />Call</a><a className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100" target="_blank" rel="noopener noreferrer" href={`https://wa.me/91${r.phone}`}><RequestIcon name="brand-whatsapp" small />WhatsApp</a>{r.email && <a className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 text-xs font-semibold text-violet-800 hover:bg-violet-100" href={`mailto:${r.email}`}><RequestIcon name="mail" small />Email</a>}</div></div>

      <div className="px-4 py-2.5">

    <details open={['Submitted', 'Under Review', 'Clarification Required'].includes(r.status)} className="space-y-2"><summary className="cursor-pointer text-sm font-semibold text-brand-900">Requirements <span className="ml-1 font-normal text-stone-500">{r.language} / {1 + (r.extraCopies || 0)} {(r.extraCopies || 0) === 0 ? 'copy' : 'copies'}</span></summary><dl className="space-y-2"><Detail label="Purpose" value={r.purpose} /><Detail label="Instructions" value={r.instructions} /></dl><div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-sky-200 pt-3 text-xs text-stone-600"><span>{r.language}</span><span>{1 + (r.extraCopies || 0)} {(r.extraCopies || 0) === 0 ? 'copy' : 'copies'} / ₹{r.stampPaperDenomination || 100} stamp</span><span>{r.includeNotary ? 'Notary requested' : 'No notary'}</span></div></details></div></section>
    </>,
    manage: <>
      {!['Uploading', 'Cancelled', 'Declined', 'Completed'].includes(r.status) && <details open={['Submitted', 'Under Review', 'Clarification Required'].includes(r.status)} className="group/manage overflow-hidden rounded-xl border border-indigo-300 bg-indigo-100" aria-label="Manage request" style={{ borderColor: '#a5b4fc' }}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 bg-indigo-200/60 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 [&::-webkit-details-marker]:hidden"><div><h4 className="text-sm font-bold text-brand-900">Manage request</h4><p className="mt-0.5 text-xs text-slate-500">Update the stage, prepare the quote and reply to the customer.</p></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${r.payment?.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>{r.payment?.status === 'Paid' ? 'Payment received' : 'Payment not confirmed'}</span><ChevronDown aria-hidden="true" className="h-4 w-4 text-indigo-700 transition-transform group-open/manage:rotate-180" /></summary>
      <fieldset style={{ border: 0, borderTop: '1px solid #c7d2fe' }} disabled={busy} className="min-w-0 space-y-4 border-0 border-t border-indigo-200 p-4">
        <label className="block text-xs font-semibold text-slate-600">Work status<select style={{ borderColor: '#c7d2fe', outlineColor: '#818cf8' }} className={`${input} mt-1.5 min-h-10`} value={status} onChange={e => setStatus(e.target.value as CustomStatus)}>{CUSTOM_STATUSES.filter(s => s !== 'Quote Sent').filter(s => canTransition(r.status as CustomStatus, s) && (s === r.status || r.payment?.status === 'Paid' || !['Accepted', 'In Progress', 'Awaiting Approval', 'Ready', 'Dispatched', 'Completed'].includes(s))).map(s => <option key={s} value={s}>{customWorkStage({ ...r, status: s })}</option>)}</select></label>
        {r.payment?.status !== 'Paid' && <p className="text-xs leading-5 text-slate-500">Drafting becomes available after payment is confirmed.</p>}
        {!quoteLocked && <div style={{ borderColor: '#c7d2fe' }} className="space-y-3 border-t border-indigo-200 pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><h5 className="text-xs font-bold uppercase tracking-wide text-slate-500">Quote</h5></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-600">Base amount (Rs.)<input style={{ borderColor: '#c7d2fe', outlineColor: '#818cf8' }} type="number" min={1} max={1000000} step={1} className={`${input} mt-1.5 min-h-10`} value={quote} onChange={e => setQuote(e.target.value)} disabled={quoteLocked} /><span className="mt-1 block text-[11px] font-normal text-slate-500">Before extra printed copies. Whole rupees.</span></label><label className="text-xs font-semibold text-slate-600">Valid until<input style={{ borderColor: '#c7d2fe', outlineColor: '#818cf8' }} type="date" disabled={quoteLocked} value={validUntil} onChange={e => setValidUntil(e.target.value)} className={`${input} mt-1.5 min-h-10`} /></label></div><div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2"><span className="text-xs text-emerald-900">Total including extra copies</span><strong className="text-base text-emerald-900">{String.fromCharCode(8377)}{(baseQuote + (r.extraCopies || 0) * 150).toLocaleString('en-IN')}</strong></div></div>}
        <label style={{ borderColor: '#c7d2fe' }} className="block border-t border-indigo-200 pt-4 text-xs font-semibold text-slate-600">Message to customer<textarea style={{ borderColor: '#c7d2fe', outlineColor: '#818cf8' }} maxLength={3000} rows={2} placeholder="Explain what is needed or share an update..." className={`${input} mt-1.5 font-normal`} value={message} onChange={e => setMessage(e.target.value)} /><span className="mt-1 block text-[11px] font-normal text-slate-500">Visible to the customer.</span></label>
        

        <div style={{ borderColor: '#c7d2fe' }} className="flex items-center justify-end border-t border-indigo-200 pt-3">      <button onClick={() => void action({ status, customerMessage: message, ...(quote && !quoteLocked && !['Cancelled', 'Declined'].includes(status) ? { quoteAmount: baseQuote, quoteValidUntil: validUntil } : {}) })} className="min-h-11 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">{busy ? 'Saving...' : 'Save request'}</button></div>
      </fieldset>
    </details>}
    </>,
    documents: <>
      <details open={['Uploading', 'Submitted', 'Under Review', 'In Progress', 'Awaiting Approval', 'Ready', 'Dispatched'].includes(r.status)} className="group/documents rounded-xl border border-violet-200 bg-violet-100 p-4" style={{ borderColor: '#ddd6fe' }}><summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-violet-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500 [&::-webkit-details-marker]:hidden"><span>Documents <span className="ml-1 font-normal text-stone-500">{Object.keys(r.files).length} {Object.keys(r.files).length === 1 ? 'sample' : 'samples'} / {(r.documents || []).length} versions</span></span><ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-violet-700 transition-transform group-open/documents:rotate-180" /></summary><div className="mt-4 space-y-4">
    <section className="space-y-3 rounded-lg border border-slate-300 bg-slate-100 p-3"><h4 className="text-sm font-bold text-slate-800">Customer samples</h4><ul className="space-y-2">{Object.values(r.files).map(file => fileRow(file))}</ul>{r.status === 'Uploading' && <p className="text-sm text-stone-600">Samples are awaiting upload verification.</p>}</section>
    {(['In Progress', 'Awaiting Approval', 'Ready', 'Dispatched', 'Completed'].includes(r.status) || (r.documents || []).some(d => d.kind === 'draft')) && <section className="space-y-3 rounded-lg border border-sky-300 bg-sky-100 p-3">
      <div><h4 className="text-sm font-bold">Draft for customer review</h4><p className="mt-1 text-xs leading-5 text-stone-600">Upload the prepared agreement as a PDF, check it, then send it to the customer for approval.</p></div>
      <ul className="space-y-2">{(r.documents || []).filter(d => d.kind === 'draft').map(d => <li key={d.id}><p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-stone-500"><span className="font-semibold text-stone-700">Draft {d.version}</span><span>{new Date(d.uploadedAt).toLocaleDateString('en-IN')}</span><span className={`rounded-full px-2 py-0.5 ${d.publishedAt ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{d.publishedAt ? 'Shared with customer' : 'Not shared yet'}</span></p><ul>{fileRow(d, true)}</ul></li>)}</ul>
      {admin && r.status === 'In Progress' && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-sky-200 bg-sky-50/50 p-4"><div><p className="text-sm font-semibold text-stone-800">{(r.documents || []).some(d => d.kind === 'draft') ? 'Upload a revised draft' : 'Add the first draft'}</p><p className="mt-1 text-xs text-stone-500">PDF only, up to 10 MB. Uploading does not share it with the customer.</p></div><button type="button" disabled={busy} onClick={() => draftFileInput.current?.click()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-sky-700 px-4 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-50"><RequestIcon name="plus" small />{busy ? 'Please wait...' : 'Choose PDF & upload'}</button><input ref={draftFileInput} type="file" accept="application/pdf,.pdf" disabled={busy} aria-label="Choose draft PDF to upload" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) void uploadDocument(file, 'draft'); e.target.value = ''; }} /></div>}
      {r.status === 'In Progress' && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sky-200 pt-3"><p className="max-w-sm text-xs leading-5 text-slate-600">{(r.documents || []).some(d => d.kind === 'draft') ? 'Preview the latest draft above. When it is ready, share it with the customer for approval.' : 'Upload a draft PDF to enable sending it for approval.'}</p><button type="button" disabled={busy || !(r.documents || []).some(d => d.kind === 'draft')} onClick={() => void action({ status: 'Awaiting Approval' })} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Please wait...' : 'Send draft for approval'}</button></div>}

    </section>}

    {(r.documents || []).some(d => d.kind === 'final') && <section className="space-y-3 rounded-lg border border-emerald-300 bg-emerald-100 p-3"><h4 className="text-sm font-bold">Previously uploaded final documents</h4><ul className="space-y-2">{(r.documents || []).filter(d => d.kind === 'final').map(d => fileRow(d, true))}</ul></section>}

    </div></details>
    </>,
    courier: <>
      {['Ready', 'Dispatched', 'Completed'].includes(r.status) && <section className="space-y-3 rounded-xl border border-sky-300 bg-sky-100 p-4" aria-label="Courier delivery"><h4 className="text-sm font-bold text-sky-900">Courier delivery</h4>{courierSummary}{r.status === 'Ready' && <><p className="text-xs text-slate-600">Send the approved agreement by courier, then enter the dispatch details.</p><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Courier partner<select value={courierName} onChange={e => setCourierName(e.target.value)} className={`${input} mt-1`}><option value="">Select courier</option>{courierPartners.map(name => <option key={name} value={name}>{name}</option>)}</select></label><label className="text-xs font-semibold">Consignment number<input value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} maxLength={150} className={`${input} mt-1`} /></label></div><button type="button" disabled={busy || !courierName || !trackingNumber.trim()} onClick={() => void action({ status: 'Dispatched' })} className="min-h-10 rounded-lg bg-emerald-700 px-4 text-xs font-semibold text-white disabled:opacity-50">Mark dispatched</button></>}{r.status === 'Dispatched' && <><label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={deliveryConfirmed} onChange={e => setDeliveryConfirmed(e.target.checked)} className="mt-0.5" />Delivery has been confirmed with the customer or courier.</label><button type="button" disabled={busy || !deliveryConfirmed} onClick={() => void action({ status: 'Completed' })} className="min-h-10 rounded-lg bg-emerald-700 px-4 text-xs font-semibold text-white disabled:opacity-50">Complete delivery</button></>}</section>}
    </>
  };
  const activeSection = ['Ready', 'Dispatched', 'Completed'].includes(r.status) ? 'courier'
    : ['In Progress', 'Awaiting Approval'].includes(r.status) ? 'documents'
    : ['Under Review', 'Clarification Required', 'Quote Sent', 'Quoted / Awaiting Payment'].includes(r.status) ? 'manage' : 'customer';
  const sectionOrder = [...(['manage', 'documents', 'courier'] as const).filter(key => key === activeSection), ...(['manage', 'documents', 'courier'] as const).filter(key => key !== activeSection)] as (keyof typeof adminSections)[];
  return <article className="custom-request-admin space-y-4 text-stone-900">
    <header className="border-b border-stone-200 pb-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="text-lg font-bold">{r.agreementType === 'Custom document' ? r.purpose : r.agreementType}</h3><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500"><span className="font-mono">{r.publicReference || r.requestId}</span><CopyReference value={r.publicReference || r.requestId} /><span>{new Date(r.createdAt).toLocaleDateString('en-IN')}</span></div></div><span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[r.status]}`}>{customWorkStage(r)}</span></div><div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-stone-500"><span>Payment: <strong className={r.payment?.status === 'Paid' ? 'font-semibold text-emerald-800' : 'font-medium text-stone-600'}>{r.payment?.status === 'Paid' ? `Paid / ₹${r.payment.amount.toLocaleString('en-IN')}` : r.payment?.status === 'Pending' && !['Cancelled', 'Declined'].includes(r.status) ? 'Pending' : 'Not paid'}</strong></span><span>Approval: <strong className={r.customerApproval?.status === 'Approved' ? 'font-semibold text-emerald-800' : 'font-medium text-stone-600'}>{r.customerApproval?.status || 'Not requested'}</strong></span></div></header>

    {adminSections.customer}
    <CustomRequestProgress request={r} showWhatsAppActions submittedNotifyUrl={typeof window !== 'undefined' ? requestStatusWhatsAppLink(r, 'submitted', window.location.origin) || undefined : undefined} reviewNotifyUrl={typeof window !== 'undefined' ? requestStatusWhatsAppLink(r, 'review', window.location.origin) || undefined : undefined} paymentReminderUrl={r.payment?.status !== 'Paid' && !quoteExpired && ['Quote Sent', 'Quoted / Awaiting Payment', 'Accepted'].includes(r.status) ? quoteWhatsAppUrl || undefined : undefined} draftReminderUrl={r.status === 'Awaiting Approval' && r.customerApproval?.status === 'Pending' ? draftWhatsAppUrl || undefined : undefined} courierMessageUrl={r.status === 'Dispatched' ? courierMessageUrl || undefined : undefined} feedbackMessageUrl={r.status === 'Completed' ? feedbackMessageUrl || undefined : undefined} />
    {r.payment?.status === 'Paid' && r.payment.reviewRequired && ['Cancelled', 'Declined'].includes(r.status) && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">Payment arrived after this request was closed. Review the transaction and arrange the appropriate refund; this request remains closed.</p>}
    {!['Awaiting Approval', 'Dispatched', 'Completed'].includes(primaryStatus || '') && !['Cancelled', 'Declined', 'Completed'].includes(r.status) && <section className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 sm:flex-row sm:items-center sm:justify-between" aria-label="Next action"><div><p className="text-xs font-semibold text-blue-800">Next step</p><p className="mt-1 text-sm text-blue-950">{primaryStatus === 'Awaiting Approval' && !(r.documents || []).some(d => d.kind === 'draft') ? 'Upload a draft PDF, then send it for approval.' : primaryStatus ? r.status === 'Submitted' ? 'Check the sample and customer requirements.' : 'Continue to the next work stage.' : customNextAction(r)}</p></div>{primaryStatus && <button disabled={busy || (primaryStatus === 'Awaiting Approval' && !(r.documents || []).some(d => d.kind === 'draft'))} onClick={() => void action({ status: primaryStatus })} className="min-h-11 shrink-0 rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50">{customNextAction(r)}</button>}</section>}
    {sectionOrder.map(key => <Fragment key={key}>{adminSections[key]}</Fragment>)}
    {(dateState.overdue || dateState.preferencePassed) && <p className={`rounded-lg border px-3 py-2 text-sm ${dateState.overdue ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{dateState.overdue ? `Overdue / committed ${r.expectedDate}. Update the commitment below.` : `Preferred date ${r.preferredDate} has passed. ${r.expectedDate ? `Committed: ${r.expectedDate}.` : 'No committed date yet.'}`}</p>}


    {(r.expectedDate || r.preferredDate) && <details className="rounded-xl border border-amber-300 bg-amber-100 p-3"><summary className="cursor-pointer text-sm font-semibold text-amber-900">Dates <span className="ml-1 font-normal text-stone-500">{r.expectedDate ? `Committed ${r.expectedDate}` : `Preferred ${r.preferredDate}`}</span></summary><dl className="mt-3 grid gap-3 sm:grid-cols-2"><Detail label="Customer preference" value={r.preferredDate || 'Not specified'} /><Detail label="Our commitment" value={r.expectedDate || 'Not committed'} /></dl></details>}


    {preview && <section className="rounded-xl border border-cyan-300 bg-cyan-100 p-3"><div className="mb-3 flex items-center justify-between gap-3"><h4 className="break-all text-sm font-semibold">{preview.name}</h4><button onClick={() => setPreview(null)} className="min-h-10 rounded-lg border border-cyan-300 px-3 text-sm">Close preview</button></div>{preview.contentType === 'application/pdf' ? <iframe title={preview.name} src={preview.url} className="h-[60vh] w-full rounded-lg bg-white" /> : <div role="img" aria-label={preview.name} className="h-[60vh] w-full bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${JSON.stringify(preview.url)})` }} />}<p className="mt-2 text-xs text-stone-500">Private link expires shortly. Reopen Preview to refresh it.</p></section>}
    {r.customerApproval?.message && <Detail label="Requested document changes" value={r.customerApproval.message} />}
    {r.quoteAmount !== undefined && <section className="rounded-xl border border-emerald-300 bg-emerald-100 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold text-stone-900">{['Cancelled', 'Declined'].includes(r.status) ? 'Last quote' : 'Quote'}</h4><strong className="text-lg text-stone-900">₹{r.quoteAmount.toLocaleString('en-IN')}</strong></div><p className="mt-1 text-xs text-stone-500">{r.payment?.status === 'Paid' ? 'Payment received' : 'Payment not received'} / Valid until {r.quoteValidUntil || 'not specified'}</p>{!!r.quoteHistory?.length && <details className="mt-3 border-t border-emerald-200 pt-3"><summary className="cursor-pointer text-sm font-semibold">Quote revision history ({r.quoteHistory.length})</summary><ul className="mt-3 space-y-2 text-sm">{r.quoteHistory.map((revision, index) => <li key={index}>Version {index + 1}: ₹{revision.amount.toLocaleString('en-IN')} / {new Date(revision.at).toLocaleString('en-IN')} / Valid until {revision.validUntil || 'not specified'}</li>)}</ul></details>}</section>}
    {quoteExpired && r.payment?.status !== 'Paid' && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">This quote has expired. Ask our team for a revised quote. An existing pending payment can still be checked.</p>}

    {r.customerMessage && <Detail label="Message from AgreementPrint" value={r.customerMessage} />}{r.customerReply && <Detail label="Customer clarification" value={r.customerReply} />}

    {busy && <p role="status" className="text-sm text-brand-700">Processing…</p>}{error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
  </article>;
}
function CustomerRequestSection({ title, number, collapsible, children }: { title: string; number: string; collapsible: boolean; children: React.ReactNode }) {
  const heading = <span className="flex items-center gap-2 font-semibold text-brand-900"><span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-bold ${number === '01' ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'}`}>{number}</span>{title}</span>;
  if (!collapsible) return <section aria-label={title} className="space-y-3"><h4>{heading}</h4>{children}</section>;
  return <details className="group/customer-section rounded-xl border border-sky-200 bg-white/60 p-3"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">{heading}<ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-sky-700 transition-transform group-open/customer-section:rotate-180" /></summary><div className="mt-3 space-y-3">{children}</div></details>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-stone-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-900">{value}</dd></div>; }

function CopyReference({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return <button type="button" aria-label={`Copy ${value}`} title={copied ? 'Copied' : 'Copy reference'} onClick={event => { event.preventDefault(); event.stopPropagation(); void navigator.clipboard.writeText(value).then(() => setCopied(true)); }} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"><RequestIcon name={copied ? 'check' : 'copy'} small /><span className="sr-only" role="status">{copied ? 'Copied' : ''}</span></button>;
}
function RequestPanel({ children, onClose, compact = false }: { children: React.ReactNode; onClose: () => void; compact?: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; panel.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary') || []).filter(el => el.getClientRects().length);
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', key); previous?.focus(); };
  }, [onClose]);
  return <div className="fixed inset-0 z-[80] bg-black/30" onClick={onClose}>
    <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Custom agreement request details" onClick={e => e.stopPropagation()} className={`absolute inset-y-0 right-0 isolate flex w-full flex-col overflow-hidden shadow-xl ${compact ? 'customer-request-panel max-w-lg bg-gradient-to-br from-sky-50 via-slate-50 to-indigo-50' : 'max-w-3xl bg-stone-50'}`}>
      {!compact && <div className={`relative z-30 flex shrink-0 items-center border-b border-stone-200 px-5 py-2 sm:px-6 ${compact ? 'justify-end bg-slate-50' : 'justify-between bg-white'}`}>
        {!compact && <h3 className="font-bold">Request details</h3>}
        <button aria-label="Close request details" title="Close" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"><RequestIcon name="x" /></button>
      </div>}
      <div className={`min-h-0 flex-1 ${compact ? 'overflow-hidden' : 'overflow-y-auto p-4 sm:p-5'}`}>{children}</div>
    </div>
  </div>;
}
