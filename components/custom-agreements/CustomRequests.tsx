'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { CUSTOM_STATUSES, CustomRequest, CustomStatus, canTransition } from '@/lib/custom-agreement';
const input = 'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm';
async function api(token: string, url: string, method = 'GET', body?: unknown) {
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not process the request.');
  return result;
}
export function CustomRequests({ admin = false }: { admin?: boolean }) {
  const { user } = useAuth();
  return <RequestsBody key={`${user?.uid ?? 'guest'}-${admin}`} admin={admin} />;
}
function RequestsBody({ admin = false }: { admin?: boolean }) {
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [requests, setRequests] = useState<CustomRequest[]>([]), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError('');
    try { const result = await api(await user.getIdToken(), `/api/custom-agreements${admin ? '?scope=admin' : ''}`); setRequests(result.requests); }
    catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, [user, admin]);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) void load(); });
    return () => { active = false; };
  }, [load]);
  if (authLoading) return <p role="status">Checking your sign-in…</p>;
  if (!user) return <div className="rounded-2xl border border-stone-200 bg-white p-6 space-y-4"><p>Sign in with Google to view your custom agreement requests.</p><button className="rounded-xl bg-amber-600 px-5 py-3 font-semibold text-white" onClick={() => { void signInWithGoogle().catch((err) => setError(err.message)); }}>Sign In with Google</button>{error && <p role="alert" className="text-rose-700">{error}</p>}</div>;
  return <section className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{admin ? 'Custom Agreement Requests' : 'My Requests'}</h2><button disabled={loading} onClick={() => void load()} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">{loading ? 'Loading…' : 'Refresh'}</button></div>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-800">{error}</p>}
    {!loading && !error && !requests.length && <p className="rounded-xl bg-white p-6 text-stone-600">No custom agreement requests yet. {!admin && <Link href="/custom-agreement" className="text-brand-700 underline">Create a request</Link>}</p>}
    <p className="text-xs text-stone-500">Showing up to 100 most recent requests.</p>
    {requests.map((request) => <RequestCard key={`${request.requestId}-${request.updatedAt}`} request={request} admin={admin} token={() => user.getIdToken()} refresh={load} />)}
  </section>;
}
function RequestCard({ request: r, admin, token, refresh }: { request: CustomRequest; admin: boolean; token: () => Promise<string>; refresh: () => Promise<void> }) {
  const [status, setStatus] = useState(r.status), [notes, setNotes] = useState(r.internalNotes ?? ''), [assigned, setAssigned] = useState(r.assignedTo ?? '');
  const [message, setMessage] = useState(r.customerMessage ?? ''), [quote, setQuote] = useState(r.quoteAmount?.toString() ?? ''), [date, setDate] = useState(r.expectedDate ?? '');
  const [reply, setReply] = useState(''), [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function action(body: Record<string, unknown>, method = 'PATCH') {
    setBusy(true); setError('');
    try { await api(await token(), '/api/custom-agreements', method, { requestId: r.requestId, ...body }); await refresh(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  async function download(sampleId: string) {
    setBusy(true); setError('');
    try { const result = await api(await token(), `/api/custom-agreements/sample?requestId=${encodeURIComponent(r.requestId)}&sampleId=${sampleId}`); window.location.assign(result.url); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  return <article className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-bold">{r.agreementType}</h3><p className="mt-1 break-all text-xs text-stone-500">{r.requestId}</p><p className="text-xs text-stone-500">Submitted {new Date(r.createdAt).toLocaleDateString('en-IN')}</p></div><span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-semibold text-brand-800">{r.status === 'Uploading' ? 'Awaiting sample verification' : r.status}</span></div>
    <dl className="grid gap-4 sm:grid-cols-2"><Detail label="Purpose" value={r.purpose} /><Detail label="Language" value={r.language} /><Detail label="Customisation instructions" value={r.instructions} /><Detail label="Preferred completion date" value={r.preferredDate || 'Not specified'} />
      <Detail label="Contact" value={`${r.name} · ${r.phone}${r.email ? ` · ${r.email}` : ''}`} /><Detail label="Preferred contact method" value={r.contactMethod} /></dl>
    {admin && <div className="flex flex-wrap gap-3 text-sm font-semibold text-brand-700"><a href={`tel:${r.phone}`}>Call customer</a><a target="_blank" rel="noopener noreferrer" href={`https://wa.me/91${r.phone}`}>Open WhatsApp</a>{r.email && <a href={`mailto:${r.email}`}>Email customer</a>}</div>}
    <div><h4 className="mb-2 text-sm font-semibold">Samples</h4><ul className="space-y-2">{Object.values(r.files).map((sample) => <li key={sample.id} className="flex flex-wrap items-center gap-2 text-sm"><span className="break-all">{sample.name} ({(sample.size / 1024 / 1024).toFixed(1)} MB)</span>{r.status !== 'Uploading' && <button disabled={busy} onClick={() => void download(sample.id)} className="font-semibold text-brand-700 underline disabled:opacity-50">Download</button>}</li>)}</ul>{r.status === 'Uploading' && <p className="mt-2 text-sm text-stone-600">Complete your uploads and verification before review. If an upload is missing or invalid, cancel this draft and create a new request.</p>}</div>
    {r.quoteAmount !== undefined && <p className="rounded-xl bg-brand-50 p-4 font-semibold">Quoted amount: ₹{r.quoteAmount.toLocaleString('en-IN')}{r.expectedDate && <span className="mt-1 block text-sm font-normal">Expected completion: {r.expectedDate}</span>}<span className="mt-1 block text-sm font-normal">Acceptance and payment arrangements are confirmed directly with our team.</span></p>}
    {r.customerMessage && <Detail label="Message from StampSure" value={r.customerMessage} />}{r.customerReply && <Detail label="Customer clarification" value={r.customerReply} />}
    {!admin && r.status === 'Clarification Required' && <div className="space-y-2"><label className="block text-sm font-semibold">Your clarification<textarea maxLength={3000} rows={3} className={`${input} mt-1`} value={reply} onChange={(e) => setReply(e.target.value)} /></label><button disabled={busy || reply.trim().length < 5} onClick={() => void action({ action: 'reply', customerReply: reply })} className="rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Send Clarification</button></div>}
    {!admin && r.status === 'Uploading' && <button disabled={busy} onClick={() => void action({ action: 'finalize' }, 'POST')} className="rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Retry Sample Verification</button>}
    {!admin && ['Uploading', 'Submitted', 'Under Review', 'Clarification Required', 'Quote Sent'].includes(r.status) && <button disabled={busy} onClick={() => { if (window.confirm('Cancel this custom agreement request?')) void action({ action: 'cancel' }); }} className="ml-2 text-sm font-semibold text-rose-700 underline disabled:opacity-50">Cancel Request</button>}
    {admin && r.status !== 'Uploading' && <details className="border-t border-stone-200 pt-4"><summary className="cursor-pointer font-semibold text-brand-800">Manage request</summary><fieldset disabled={busy} className="mt-4 space-y-4"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Status<select className={`${input} mt-1`} value={status} onChange={(e) => setStatus(e.target.value as CustomStatus)}>{CUSTOM_STATUSES.filter((s) => canTransition(r.status as CustomStatus, s)).map((s) => <option key={s}>{s}</option>)}</select></label><label className="text-sm font-semibold">Assigned administrator<input maxLength={100} className={`${input} mt-1`} value={assigned} onChange={(e) => setAssigned(e.target.value)} /></label><label className="text-sm font-semibold">Quote (whole rupees)<input type="number" min={1} max={1000000} step={1} className={`${input} mt-1`} value={quote} onChange={(e) => setQuote(e.target.value)} disabled={['Accepted', 'In Progress', 'Completed'].includes(r.status)} /></label><label className="text-sm font-semibold">Expected completion date<input type="date" className={`${input} mt-1`} value={date} onChange={(e) => setDate(e.target.value)} /></label></div><label className="block text-sm font-semibold">Message to customer<textarea maxLength={3000} rows={3} className={`${input} mt-1`} value={message} onChange={(e) => setMessage(e.target.value)} /></label><label className="block text-sm font-semibold">Internal notes (administrators only)<textarea maxLength={5000} rows={3} className={`${input} mt-1`} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      {r.status === 'Quote Sent' && status === 'Accepted' && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1" />I confirm the customer accepted this quote during our direct contact.</label>}
      <p className="text-xs text-stone-500">Contact is manual. Record “Quote Sent” after communicating the quote to the customer.</p><button onClick={() => void action({ status, internalNotes: notes, assignedTo: assigned, customerMessage: message, ...(quote ? { quoteAmount: Number(quote) } : {}), expectedDate: date, acceptanceConfirmed: confirmed })} className="rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white">Save Review</button></fieldset></details>}
    {busy && <p role="status" className="text-sm text-brand-700">Processing…</p>}{error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
  </article>;
}
function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm text-stone-800">{value}</dd></div>; }
