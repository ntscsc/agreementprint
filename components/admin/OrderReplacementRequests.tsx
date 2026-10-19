'use client';
import { OrderReference } from '@/components/order/OrderReference';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { readApiResponse } from '@/lib/api-response';
import type { Order } from '@/lib/types';

interface RequestRecord {
  requestId: string; originalOrderId: string; replacementOrderId: string; state: string; createdAt: string;
  refundStatus?: string; refundAmount?: number; creditReturned?: number;
  details: Pick<Order, 'ownerDetails' | 'tenantDetails' | 'propertyDetails' | 'agreementTerms'>;
  quote: { total: number; alreadyPaid: number; due: number };
}
export function OrderReplacementRequests() {
  const { user } = useAuth();
  const [records, setRecords] = useState<RequestRecord[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    if (!user) return;
    try { const result = await readApiResponse(await fetch('/api/admin/replacements', { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: 'no-store' })); setRecords(result.requests); setError(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load replacement requests.'); }
  }, [user]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  async function save(record: RequestRecord, action: string) {
    if (!user) return; setBusy(true); setError('');
    try {
      await readApiResponse(await fetch('/api/admin/replacements', { method: 'PATCH', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: record.requestId, action, notes: notes[record.requestId] }) }));
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save review.'); }
    finally { setBusy(false); }
  }
  const actionable = records.filter(record => record.state === 'Review required' || record.refundStatus === 'Requested');
  return <section className="rounded-2xl border border-stone-200 bg-white p-5"><h3 className="font-bold">Order Change Requests ({actionable.length} awaiting action)</h3><div className="mt-4 space-y-4"><button type="button" onClick={() => void load()} className="text-sm font-semibold underline">Refresh requests</button><p className="text-xs text-stone-500">Showing up to 100 pending reviews and 100 pending refunds.</p>{error && <p role="alert" className="text-rose-700">{error}</p>}{!actionable.length && <p className="text-sm text-stone-500">No change reviews or refund requests awaiting action.</p>}{actionable.map(record => <article key={record.requestId} className="space-y-3 rounded-xl border border-stone-200 p-4"><h3 className="break-all font-semibold"><OrderReference reference={record.originalOrderId} /></h3><p className="text-sm">{record.state === 'Review required' ? 'Changes requested after preparation began' : `Refund requested: ₹${record.refundAmount}`}</p><p className="text-sm text-stone-600">Proposed total: ₹{record.quote.total} · Previously paid: ₹{record.quote.alreadyPaid} · Difference: ₹{record.quote.due}</p><details><summary className="cursor-pointer text-sm font-semibold">Proposed agreement details</summary><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">{Object.entries(record.details).flatMap(([section, values]) => Object.entries(values).map(([key, value]) => <div key={`${section}-${key}`}><dt className="text-xs text-stone-500">{section.replace(/([A-Z])/g, ' $1')} / {key.replace(/([A-Z])/g, ' $1')}</dt><dd className="break-words">{String(value)}</dd></div>))}</dl></details><p className="text-xs text-stone-500">{record.refundStatus === 'Requested' ? 'Process the cash refund separately to the original payment method, then record its transfer reference. This action does not transfer money.' : 'Review the proposed changes with the customer before changing prepared documents or arranging any price adjustment. Recording the outcome does not replace the order automatically.'}</p><label className="block text-sm font-semibold">{record.refundStatus === 'Requested' ? 'Refund transfer reference' : 'Review outcome / next steps'}<textarea value={notes[record.requestId] || ''} onChange={event => setNotes(previous => ({ ...previous, [record.requestId]: event.target.value }))} maxLength={2000} rows={2} className="mt-1 w-full rounded-xl border border-stone-300 p-3" /></label><button type="button" disabled={busy || (notes[record.requestId]?.trim().length || 0) < 5} onClick={() => { if (record.refundStatus !== 'Requested' || window.confirm(`Confirm you have refunded ₹${record.refundAmount} to the original payment method?`)) void save(record, record.refundStatus === 'Requested' ? 'refund-recorded' : 'reviewed'); }} className="min-h-11 rounded-xl bg-stone-900 px-4 py-2 font-semibold text-white disabled:opacity-50">{record.refundStatus === 'Requested' ? 'Record Completed Refund' : 'Record Review Outcome'}</button></article>)}</div></section>;
}
