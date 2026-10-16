'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { readApiResponse } from '@/lib/api-response';
import { summarizeAgentReferrals } from '@/lib/referral-summary';

interface Agent { code: string; name: string; contact: string; rewardAmount?: number; customerDiscountAmount?: number; active?: boolean; deletedAt?: string }
interface Referral { uid: string; code: string; name: string; email: string; joinedAt: string; rewardStatus: string; rewardAmount?: number; rewardPaidAmount?: number; rewardNotes?: string; rewardedAt?: string; eligiblePaidOrderId?: string; hasPaidOrder: boolean; customerDiscountAmount?: number }
interface AgentForm { name: string; contact: string; code: string; rewardAmount: string; customerDiscountAmount: string; active: boolean }
const emptyForm: AgentForm = { name: '', contact: '', code: '', rewardAmount: '0', customerDiscountAmount: '0', active: true };
const money = (amount: number) => `INR ${amount.toLocaleString('en-IN')}`;
const input = 'min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-600';
const button = 'min-h-11 rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold disabled:opacity-50';
const primary = 'min-h-11 rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';

export function AgentReferralAdmin() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [showRemoved, setShowRemoved] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [editor, setEditor] = useState<'new' | 'edit' | null>(null);
  const [form, setForm] = useState<AgentForm>(emptyForm);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [referralFilter, setReferralFilter] = useState('all');
  const editorRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const mutation = useRef(false);

  const load = useCallback(async () => {
    if (!user) return;
    const response = await fetch('/api/admin/agents', { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: 'no-store' });
    const data = await readApiResponse(response);
    setAgents(data.agents); setReferrals(data.customers); setLoaded(true);
  }, [user]);
  useEffect(() => { const timer = window.setTimeout(() => void load().catch(err => setError(err.message)), 0); return () => window.clearTimeout(timer); }, [load]);

  async function save(body: Record<string, unknown>) {
    if (!user || mutation.current) return;
    mutation.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/agents', { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      await readApiResponse(response);
      if (body.action === 'create' || body.action === 'update') { setEditor(null); setSelectedCode(String(body.code)); }
      if (body.action === 'reward') setNotes(previous => ({ ...previous, [String(body.uid)]: '' }));
      setNotice(body.action === 'reward' ? 'Payment recorded. No money was transferred by this action.' : body.action === 'delete' ? 'Agent removed. Their history is preserved.' : 'Agent saved.');
      try { await load(); } catch { setError('Saved successfully, but the list could not refresh. Refresh to see the latest details.'); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save changes.'); }
    finally { mutation.current = false; setBusy(false); }
  }
  async function refresh() {
    setRefreshing(true); setError('');
    try { await load(); } catch (err) { setError(err instanceof Error ? err.message : 'Could not refresh.'); }
    finally { setRefreshing(false); }
  }
  function openEditor(agent?: Agent) {
    setEditor(agent ? 'edit' : 'new');
    if (agent) setSelectedCode(agent.code);
    setForm(agent ? { name: agent.name, contact: agent.contact, code: agent.code, rewardAmount: String(agent.rewardAmount ?? 0), customerDiscountAmount: String(agent.customerDiscountAmount ?? 0), active: agent.active !== false } : { ...emptyForm });
    window.setTimeout(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setNotice('Share link copied.'); }
    catch { setError('Could not copy. Select the share link and copy it manually.'); }
  }
  const selected = agents.find(agent => agent.code === selectedCode);
  const visibleAgents = agents.filter(agent => (showRemoved || !agent.deletedAt) && [agent.name, agent.contact, agent.code].join(' ').toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code));
  const selectedReferrals = referrals.filter(referral => referral.code === selectedCode).sort((a, b) => b.joinedAt.localeCompare(a.joinedAt));
  const visibleReferrals = selectedReferrals.filter(referral => referralFilter === 'all' || (referralFilter === 'paid' ? referral.rewardStatus === 'Rewarded' : referralFilter === 'waiting' ? !referral.hasPaidOrder && referral.rewardStatus !== 'Rewarded' : referral.hasPaidOrder && referral.rewardStatus !== 'Rewarded' && (referral.rewardAmount ?? 0) > 0));
  const paid = referrals.filter(referral => referral.rewardStatus === 'Rewarded');
  const summary = summarizeAgentReferrals(referrals);
  const link = selected && typeof window !== 'undefined' ? `${window.location.origin}/order?coupon=${encodeURIComponent(selected.code)}` : '';

  return <section className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-xl font-bold text-stone-900">Agents</h2><p className="mt-1 max-w-2xl text-sm text-stone-600">Each agent has two amounts: their manual reward after a first paid order and the discount the new customer gets on that order.</p></div>
      <div className="flex gap-2"><button type="button" disabled={busy || refreshing} onClick={() => void refresh()} className={button}>{refreshing ? 'Refreshing...' : 'Refresh'}</button><button type="button" disabled={busy} onClick={() => openEditor()} className={primary}>Add agent</button></div>
    </header>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[
      { label: 'Active agents', value: agents.filter(agent => !agent.deletedAt && agent.active !== false).length },
      { label: 'Customers who paid', value: summary.paidCustomers },
      { label: 'Awaiting customer payment', value: summary.awaitingCustomerPayment },
      { label: 'Agent payments due', value: summary.paymentsDue },
      { label: 'Agent rewards paid', value: money(summary.recordedPaymentTotal) },
    ].map(stat => <div key={stat.label} className="admin-agent-metric rounded-2xl border border-stone-200 bg-stone-50 p-4"><p className="text-xs font-semibold text-stone-600">{stat.label}</p><p className="mt-2 break-words text-2xl font-bold text-stone-900">{loaded ? stat.value : '...'}</p></div>)}</div>
    <p className="text-xs text-stone-500">Customers who paid counts confirmed successful payments only. Customers who have only signed in appear under Awaiting customer payment.</p>
    {editor && <div ref={editorRef} className="scroll-mt-6 rounded-2xl border border-brand-200 bg-stone-50 p-5 sm:p-6">
      <h3 className="text-lg font-bold">{editor === 'new' ? 'Add an agent' : `Edit ${selected?.name || 'agent'}`}</h3>
      <form onSubmit={event => { event.preventDefault(); void save({ action: editor === 'new' ? 'create' : 'update', ...form, rewardAmount: Number(form.rewardAmount), customerDiscountAmount: Number(form.customerDiscountAmount) }); }}>
        <fieldset disabled={busy} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold">Agent name<input autoFocus required maxLength={100} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className={input} /></label>
          <label className="grid gap-2 text-sm font-semibold">Phone or email (optional)<input maxLength={200} value={form.contact} onChange={event => setForm({ ...form, contact: event.target.value })} className={input} /></label>
          <label className="grid gap-2 text-sm font-semibold">Agent coupon code<input required pattern="[A-Z0-9]{5,20}" maxLength={20} readOnly={editor === 'edit'} value={form.code} onChange={event => setForm({ ...form, code: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} placeholder="RAVI2026" className={input} /><span className="text-xs font-normal text-stone-600">{editor === 'edit' ? 'The code stays fixed to preserve referral history.' : 'Choose a unique code: 5 to 20 letters or numbers.'}</span></label>
          <label className="grid gap-2 text-sm font-semibold">Agent earns per first paid order (INR)<input required type="number" min={0} max={100000} step={1} value={form.rewardAmount} onChange={event => setForm({ ...form, rewardAmount: event.target.value })} className={input} /><span className="text-xs font-normal text-stone-600">Paid by you manually after the referred customer pays. Changes apply to future qualifying payments.</span></label>
          <div className="rounded-xl border border-stone-200 bg-white p-4 sm:col-span-2"><label className="grid gap-2 text-sm font-semibold">New customer discount on first order (INR)<input required type="number" min={0} max={100000} step={1} value={form.customerDiscountAmount} onChange={event => setForm({ ...form, customerDiscountAmount: event.target.value })} className={input} /><span className="text-xs font-normal text-stone-600">Deducted from the new customer first order before payment. Use 0 for no discount.</span></label></div>
          {editor === 'edit' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={event => setForm({ ...form, active: event.target.checked })} />Code active for new referrals</label>}
          <div className="flex flex-wrap gap-2 sm:col-span-2"><button className={primary}>{busy ? 'Saving...' : 'Save agent'}</button><button type="button" onClick={() => setEditor(null)} className={button}>Cancel</button></div>
        </fieldset>
      </form>
    </div>}
    <div className="flex flex-wrap items-end gap-4"><label className="grid min-w-0 flex-1 gap-2 text-sm font-semibold">Find an agent<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, code, phone or email" className={input} /></label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={showRemoved} onChange={event => setShowRemoved(event.target.checked)} />Include removed agents</label></div>
    {!loaded && !error && <p role="status" className="py-6 text-sm text-stone-600">Loading agents...</p>}
    {loaded && <div className="grid gap-3 md:grid-cols-2">{visibleAgents.map(agent => {
      const customers = referrals.filter(referral => referral.code === agent.code);
      const totals = summarizeAgentReferrals(customers);
      return <article key={agent.code} className={`rounded-2xl border p-5 ${selectedCode === agent.code ? 'border-brand-500 bg-brand-50' : 'border-stone-200 bg-white'}`}>
        <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-stone-900">{agent.name}</h3><p className="mt-1 break-all font-mono text-sm text-stone-600">{agent.code}</p></div><span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold">{agent.deletedAt ? 'Removed' : agent.active === false ? 'Paused' : 'Active'}</span></div>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-stone-500">Agent earns</dt><dd className="mt-1 font-bold">{money(agent.rewardAmount ?? 0)}</dd></div><div><dt className="text-stone-500">New customer saves</dt><dd className="mt-1 font-bold">{money(agent.customerDiscountAmount ?? 0)}</dd></div></dl>
        <p className="mt-4 text-sm text-stone-600">{totals.paidCustomers} customers paid &middot; {totals.awaitingCustomerPayment} awaiting customer payment &middot; {totals.paymentsDue} agent payments due</p>
        <button type="button" onClick={() => { setSelectedCode(agent.code); setReferralFilter('all'); setEditor(null); window.setTimeout(() => detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); }} className={`${button} mt-4 w-full`}>View agent &amp; referrals</button>
      </article>;
    })}</div>}
    {loaded && !visibleAgents.length && <p className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-600">{agents.length ? 'No agents match your search.' : 'No agents yet. Add your first agent to get started.'}</p>}
    {selected && <div ref={detailsRef} className="scroll-mt-6 space-y-5 rounded-2xl border border-stone-200 bg-stone-50 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-bold">{selected.name}</h3><p className="mt-1 break-all text-sm text-stone-600">{selected.contact || 'No contact added'} &middot; {selected.code}</p></div><div className="flex flex-wrap gap-2">{!selected.deletedAt && <><button type="button" disabled={busy} onClick={() => openEditor(selected)} className={button}>Edit agent</button><button type="button" disabled={busy} onClick={() => { if (window.confirm(`Remove ${selected.name}? The code will be disabled. Referral and payment history will be kept.`)) void save({ action: 'delete', code: selected.code }); }} className={`${button} text-red-700`}>Delete agent</button></>}<button type="button" onClick={() => setSelectedCode(null)} className={button}>Close</button></div></div>
      {!selected.deletedAt && <div className="flex flex-wrap items-end gap-2"><label className="grid min-w-0 flex-1 gap-2 text-sm font-semibold">Share this link<input readOnly value={link} onFocus={event => event.target.select()} className={input} /></label><button type="button" onClick={() => void copy(link)} className={primary}>Copy link</button></div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-5"><h4 className="font-bold">Referral activity ({selectedReferrals.length})</h4><label className="flex items-center gap-2 text-sm">Show<select value={referralFilter} onChange={event => setReferralFilter(event.target.value)} className={input}><option value="all">All referrals</option><option value="pending">Agent payment due</option><option value="waiting">Awaiting first payment</option><option value="paid">Payment recorded</option></select></label></div>
      <p className="text-sm text-stone-600">The new customer gets the discount at checkout. After their first successful payment, pay the agent separately and record it below.</p>
      {!visibleReferrals.length && <p className="py-4 text-sm text-stone-600">No referrals in this view.</p>}
      {visibleReferrals.map(referral => <article key={referral.uid} className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{referral.name || 'Customer'}</p><p className="break-all text-sm text-stone-600">{referral.email}</p><p className="mt-1 text-xs text-stone-500">Referred {new Date(referral.joinedAt).toLocaleDateString('en-IN')}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${referral.rewardStatus === 'Rewarded' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>{referral.rewardStatus === 'Rewarded' ? 'Payment recorded' : referral.hasPaidOrder ? (referral.rewardAmount ?? 0) > 0 ? 'Agent payment due' : 'No agent reward due' : 'Awaiting first payment'}</span></div>
        {referral.hasPaidOrder && <p className="text-sm text-emerald-800">New customer discount: {money(referral.customerDiscountAmount ?? 0)}. First paid order: {referral.eligiblePaidOrderId}.</p>}
        {referral.rewardStatus === 'Rewarded' ? <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><p className="font-semibold">{referral.rewardPaidAmount === undefined ? 'Amount recorded in payment notes' : `${money(referral.rewardPaidAmount)} paid to agent`}</p><p className="mt-1 whitespace-pre-wrap break-words">{referral.rewardNotes}</p>{referral.rewardedAt && <p className="mt-2 text-xs">Recorded {new Date(referral.rewardedAt).toLocaleString('en-IN')}</p>}</div> : !referral.hasPaidOrder ? <p className="text-sm text-stone-600">Awaiting the new customer first paid order. No agent payment is due yet.</p> : (referral.rewardAmount ?? 0) === 0 ? <p className="text-sm text-stone-600">The agent reward was set to zero when this customer paid. No agent payment is due.</p> : <form onSubmit={event => { event.preventDefault(); const amount = referral.rewardAmount ?? selected.rewardAmount ?? 0; if (window.confirm(`Confirm you have paid ${money(amount)} to ${selected.name} for this referral?`)) void save({ action: 'reward', uid: referral.uid, notes: notes[referral.uid] }); }}>
          <p className="mb-3 text-sm font-semibold">Agent reward: {money(referral.rewardAmount ?? selected.rewardAmount ?? 0)}. New customer discount: {money(referral.customerDiscountAmount ?? 0)}.</p><fieldset disabled={busy} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><label className="grid gap-2 text-sm font-semibold">Payment reference / notes<textarea required rows={2} maxLength={1000} value={notes[referral.uid] || ''} onChange={event => setNotes({ ...notes, [referral.uid]: event.target.value })} placeholder="UPI reference, payment date or bank transfer details" className={input} /></label><button disabled={!notes[referral.uid]?.trim()} className={`${primary} self-end`}>Record payment</button></fieldset>
        </form>}
      </article>)}
      {paid.some(referral => referral.code === selected.code && referral.rewardPaidAmount === undefined) && <p className="text-xs text-stone-500">Older payments without a numeric amount are kept in history and excluded from payment totals.</p>}
    </div>}
  </section>;
}
