'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { maskedAadhaar } from '@/lib/identity-display';
import { readApiResponse } from '@/lib/api-response';
interface Correction { id: string; message: string; requestedAt: string; submittedAt?: string; status: string; changes: { field: string; before: unknown; after: unknown }[] }
export function OrderCorrectionHistory({ orderId, updatedAt }: { orderId: string; updatedAt: string }) {
  const { user } = useAuth();
  const [history, setHistory] = useState<Correction[]>([]), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    if (user) void (async () => {
      try { const result = await readApiResponse(await fetch(`/api/orders/corrections?orderId=${encodeURIComponent(orderId)}`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: 'no-store' })); if (active) { setHistory(result.history); setError(''); } }
      catch (reason) { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load correction history.'); }
    })();
    return () => { active = false; };
  }, [user, orderId, updatedAt]);
  return <details className="rounded-xl border border-stone-200 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-stone-700">Correction messages &amp; history</summary><div className="mt-4 space-y-4">{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}{!history.length && !error && <p className="text-sm text-stone-500">No correction messages recorded yet.</p>}{history.map(record => <article key={record.id} className="space-y-2 border-b border-stone-100 pb-4 last:border-0"><p className="text-xs text-stone-500">Requested {new Date(record.requestedAt).toLocaleString('en-IN')} · {record.status}</p><p className="whitespace-pre-wrap text-sm text-stone-800">{record.message}</p>{record.submittedAt && <p className="text-xs font-semibold text-emerald-800">Customer corrections submitted {new Date(record.submittedAt).toLocaleString('en-IN')}</p>}{record.changes?.length > 0 && <dl className="space-y-2">{record.changes.map(change => <div key={change.field} className="rounded-lg bg-stone-50 p-3 text-sm"><dt className="font-semibold capitalize">{change.field.replaceAll('.', ' / ').replace(/([A-Z])/g, ' $1')}</dt><dd className="mt-1 break-words text-stone-600">Before: {change.before == null ? 'Not provided' : change.field.endsWith('aadhaarLast4') ? maskedAadhaar(change.before) : String(change.before)}</dd><dd className="mt-1 break-words text-emerald-800">After: {change.after == null ? 'Not provided' : change.field.endsWith('aadhaarLast4') ? maskedAadhaar(change.after) : String(change.after)}</dd></div>)}</dl>}</article>)}</div></details>;
}
