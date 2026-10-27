'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { ListFilters, DateFilterFields, useListDates } from '@/components/ui/ListFilters';
import { useAuth } from '@/lib/auth-context';
import { readApiResponse } from '@/lib/api-response';
import { waitingTime, type QueueChannel, type WorkItem, type WorkQueueData } from '@/lib/admin-work-queue';
import { formatAgreementAmount } from '@/lib/agreement-formatter';
import type { Order } from '@/lib/types';

export function AdminWorkQueue({ onOpenOrder, onOpenSection, summaryOnly = false, revision = '' }: {
  onOpenOrder?: (order: Order, changeRequestId?: string) => void;
  onOpenSection?: (section: 'changes' | 'refunds' | 'custom', requestId: string) => void;
  summaryOnly?: boolean; revision?: string;
}) {
  const dates = useListDates();
  const { user } = useAuth();
  const [data, setData] = useState<WorkQueueData | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<QueueChannel | 'All'>('All'), [view, setView] = useState<'All' | 'Needs action' | 'Waiting'>('Needs action'), [search, setSearch] = useState('');
  const [opening, setOpening] = useState('');
  const [refreshNotice, setRefreshNotice] = useState('');
  const loadSequence = useRef(0);
  const invalidateLoads = useCallback(() => { ++loadSequence.current; }, []);
  const load = useCallback(async (silent = true) => {
    if (!user) return;
    const sequence = ++loadSequence.current;
    setLoading(true); setError(''); setRefreshNotice('');
    try {
      const result = await readApiResponse(await fetch('/api/admin/work-queue', { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: 'no-store', signal: AbortSignal.timeout(30000) }));
      if (sequence !== loadSequence.current) return;
      setData(result as WorkQueueData);
      if (!silent) setRefreshNotice('Queue refreshed. Showing the latest available records.');
    }
    catch (reason) {
      if (sequence === loadSequence.current) setError(reason instanceof Error && reason.name === 'TimeoutError' ? 'Refreshing took too long. Please try again.' : reason instanceof Error ? reason.message : 'Unable to load the work queue.');
    }
    finally { if (sequence === loadSequence.current) setLoading(false); }
  }, [user]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); const refresh = setInterval(() => void load(), 60000); return () => { clearTimeout(timer); clearInterval(refresh); invalidateLoads(); }; }, [load, revision, invalidateLoads]);
  async function open(item: WorkItem) {
    if (item.target !== 'order' && item.target !== 'changes') { onOpenSection?.(item.target, item.id.split(':').slice(1).join(':')); return; }
    if (!user || !item.orderId) return;
    setOpening(item.id); setError('');
    try {
      const result = await readApiResponse(await fetch(`/api/admin/order-workflow?channel=Online&orderId=${encodeURIComponent(item.orderId)}`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: 'no-store' }));
      onOpenOrder?.(result.order, item.target === 'changes' ? item.id.split(':').slice(1).join(':') : undefined);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to open order.'); }
    finally { setOpening(''); }
  }
  const visible = (data?.items || []).filter(item => dates.matches(item.createdAt) && (channel === 'All' || item.channel === channel) && (view === 'All' || (view === 'Needs action' ? item.needsAction : !item.needsAction)) && `${item.reference} ${item.customer} ${item.stage}`.toLowerCase().includes(search.toLowerCase()));
  const select = 'min-h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm';
  return <section className="space-y-4" aria-label={summaryOnly ? 'Operational summary' : 'Consolidated work queue'}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-stone-900">{summaryOnly ? 'Operations at a glance' : view === 'All' ? 'Work queue' : view}</h2><p className="mt-1 text-sm text-stone-600">{summaryOnly ? 'Current workload and recorded receipts in India time.' : 'Online, change, refund and custom work in one queue. Payment records remain separate.'}</p></div><button type="button" disabled={loading} aria-busy={loading} onClick={() => void load(false)} className={`${select} inline-flex cursor-pointer items-center gap-2 font-semibold transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:cursor-wait disabled:opacity-60`}><RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{loading ? 'Refreshing...' : 'Refresh queue'}</button></div>
    {refreshNotice && <p role="status" className="text-xs font-medium text-emerald-700">{refreshNotice}</p>}
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error} {data ? 'The previous snapshot is still shown; totals may be out of date.' : ''}</p>}
    {loading && !data && <p role="status">Loading operational workload…</p>}
    {data && <><div className={`grid grid-cols-2 gap-3 ${summaryOnly ? 'xl:grid-cols-3' : 'xl:grid-cols-4'}`}>{[
      ['Needs action', data.summary.needsAction, 'Staff action available'], ['Pending workload', data.summary.pendingWorkload, 'All open queue items'],
      ['Waiting', data.summary.waiting, 'Customer response or payment'], ...(summaryOnly ? [
        ['Online collections today', `₹${formatAgreementAmount(data.summary.todayOnlineCollections)}`, `${data.summary.todayOnlinePayments} recorded payments · IST`],
        ['Counter collections today', `₹${formatAgreementAmount(data.summary.todayCounterCollections)}`, `${data.summary.todayCounterPayments} recorded payments · IST`],
      ] : []),
      ['Pending refunds', data.summary.pendingRefunds, `₹${formatAgreementAmount(data.summary.pendingRefundAmount)} awaiting completion`],
    ].map(([label, value, hint]) => <div key={String(label)} className="rounded-2xl border border-stone-200 bg-white p-4"><p className="text-xs font-semibold text-stone-600">{label}</p><p className="mt-2 text-2xl font-bold tabular-nums text-stone-900">{value}</p><p className="mt-1 text-xs text-stone-500">{hint}</p></div>)}</div>
    <p className="text-xs text-stone-500">Updated {new Date(data.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST. {summaryOnly && 'Collections use saved paid-at dates, exclude carried replacement payments and credits, and are shown before refunds. '}Older records without a stage timestamp show total open time.</p>
    {!summaryOnly && <><div className="flex items-center gap-2"><input aria-label="Search work queue" value={search} onChange={event => setSearch(event.target.value)} className={`${select} min-w-0 flex-1`} placeholder="Search reference or customer" /><ListFilters activeCount={dates.activeCount + Number(channel !== 'All') + Number(view !== 'Needs action')} onClear={() => { dates.clear(); setChannel('All'); setView('Needs action'); }}><div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Channel<select aria-label="Work queue channel" className={`${select} mt-1 w-full cursor-pointer transition-colors hover:border-sky-300`} value={channel} onChange={event => setChannel(event.target.value as typeof channel)}>{['All', 'Online', 'Changes', 'Refunds', 'Custom'].map(value => <option key={value}>{value}</option>)}</select></label><label className="text-sm font-semibold">Show<select aria-label="Work queue state" className={`${select} mt-1 w-full cursor-pointer transition-colors hover:border-sky-300`} value={view} onChange={event => setView(event.target.value as typeof view)}>{['Needs action', 'Waiting', 'All'].map(value => <option key={value}>{value}</option>)}</select></label></div><DateFilterFields {...dates} /></ListFilters></div>
    <div className="space-y-3">{!visible.length && <p className="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-600">No work matches these filters.</p>}{visible.map(item => <article key={item.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="break-all font-mono text-sm font-bold">{item.reference}</h3><span className="rounded-full bg-stone-100 px-2 py-1 text-xs font-semibold">{item.channel}</span><span className={`text-xs font-semibold ${item.needsAction ? 'text-blue-800' : 'text-amber-800'}`}>{item.stage}</span></div><p className="mt-1 break-words text-sm text-stone-700">{item.customer}</p><p className="mt-1 text-xs font-medium text-stone-600">{waitingTime(item)}{item.paymentStatus ? ` · Payment: ${item.paymentStatus}` : ''}</p>{item.waitingOn && <p className="mt-1 text-xs text-amber-800">{item.waitingOn}</p>}{item.target === 'order' && item.needsAction && <p className="mt-1 text-xs text-blue-800">Next: {item.nextAction}</p>}</div><div className="flex shrink-0 flex-wrap items-center gap-2"><button type="button" disabled={!!opening} onClick={() => void open(item)} className="min-h-11 shrink-0 cursor-pointer rounded-xl bg-blue-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-900 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-50">{opening === item.id ? 'Opening...' : item.target === 'order' || item.stage === 'Dispatched' ? 'View details' : item.needsAction ? item.nextAction : 'View details'}</button></div></article>)}</div></>}
    </>}

  </section>;
}
