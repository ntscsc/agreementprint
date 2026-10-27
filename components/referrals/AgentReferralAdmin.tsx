'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ListFilters, DateFilterFields, useListDates } from '@/components/ui/ListFilters';
import { useAuth } from '@/lib/auth-context';
import { readApiResponse } from '@/lib/api-response';
import Link from 'next/link';
import { Users, Wallet, CreditCard, Clock, CheckCircle2, Plus, RefreshCw, Eye, ChevronRight } from 'lucide-react';
import { agentDashboardTotals, agentReferralStage } from '@/lib/agent-dashboard';
import { summarizeAgentReferrals } from '@/lib/referral-summary';
import { normalizeReferralCode } from '@/lib/referral-utils';

interface Agent { loginEmail?: string; code: string; name: string; contact: string; rewardAmount?: number; customerDiscountAmount?: number; active?: boolean; deletedAt?: string }
interface Referral { uid: string; code: string; name: string; email: string; joinedAt: string; rewardStatus: string; rewardAmount?: number; rewardPaidAmount?: number; rewardNotes?: string; rewardedAt?: string; eligiblePaidOrderId?: string; hasPaidOrder: boolean; customerDiscountAmount?: number }
interface AgentForm { loginEmail: string; name: string; contact: string; code: string; rewardAmount: string; customerDiscountAmount: string; active: boolean }
const emptyForm: AgentForm = { loginEmail: '', name: '', contact: '', code: '', rewardAmount: '0', customerDiscountAmount: '0', active: true };
const money = (amount: number) => `INR ${amount.toLocaleString('en-IN')}`;
const input = 'min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-600';
const button = 'inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-800 transition-colors hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50';
const primary = 'inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-sky-700 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50';

export function AgentReferralAdmin() {
  const dates = useListDates();
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
    setAgents(data.agents.map((agent: Agent) => ({ ...agent, code: normalizeReferralCode(agent.code) })));
    setReferrals(data.customers.map((referral: Referral) => ({ ...referral, code: normalizeReferralCode(referral.code) })));
    setLoaded(true);
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
    setForm(agent ? { loginEmail: agent.loginEmail || '', name: agent.name, contact: agent.contact, code: agent.code, rewardAmount: String(agent.rewardAmount ?? 0), customerDiscountAmount: String(agent.customerDiscountAmount ?? 0), active: agent.active !== false } : { ...emptyForm });
    window.setTimeout(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setNotice('Share link copied.'); }
    catch { setError('Could not copy. Select the share link and copy it manually.'); }
  }
  const selected = agents.find(agent => agent.code === selectedCode);
  const visibleAgents = agents.filter(agent => (showRemoved || !agent.deletedAt) && [agent.name, agent.contact, agent.code].join(' ').toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code));
  const selectedReferrals = referrals.filter(referral => referral.code === selectedCode).sort((a, b) => b.joinedAt.localeCompare(a.joinedAt));
  const visibleReferrals = selectedReferrals.filter(referral => dates.matches(referral.joinedAt)).filter(referral => referralFilter === 'all' || (referralFilter === 'paid' ? referral.rewardStatus === 'Rewarded' : referralFilter === 'waiting' ? !referral.hasPaidOrder && referral.rewardStatus !== 'Rewarded' : referral.hasPaidOrder && referral.rewardStatus !== 'Rewarded' && (referral.rewardAmount ?? 0) > 0));
  const paid = referrals.filter(referral => referral.rewardStatus === 'Rewarded');
  const visibleCodes = new Set(visibleAgents.map(agent => agent.code));
  const summary = summarizeAgentReferrals(referrals.filter(referral => visibleCodes.has(referral.code)));
  const knownCodes = new Set(agents.map(agent => agent.code));
  const unassignedReferrals = referrals.filter(referral => !knownCodes.has(referral.code));
  const link = selected && typeof window !== 'undefined' ? `${window.location.origin}/order?coupon=${encodeURIComponent(selected.code)}` : '';

  return <section className="space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-base font-bold text-stone-900">Agent overview</h2><p className="mt-1 text-xs text-stone-500">Track referrals, commission due and recorded payments.</p></div>
      <div className="flex gap-2"><button type="button" disabled={busy || refreshing} onClick={() => void refresh()} className={button}><RefreshCw aria-hidden="true" className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />{refreshing ? 'Refreshing...' : 'Refresh'}</button><button type="button" disabled={busy} onClick={() => openEditor()} className={primary}><Plus aria-hidden="true" className="h-3.5 w-3.5" />Add agent</button></div>
    </header>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[
      { icon: Users, tint: 'sky', label: 'Active agents', value: visibleAgents.filter(agent => !agent.deletedAt && agent.active !== false).length },
      { icon: CreditCard, tint: 'violet', label: 'Customers who paid', value: summary.paidCustomers },
      { icon: Clock, tint: 'amber', label: 'Awaiting customer payment', value: summary.awaitingCustomerPayment },
      { icon: Wallet, tint: 'orange', label: 'Commission due', value: money(agentDashboardTotals(referrals.filter(referral => visibleCodes.has(referral.code))).dueAmount) },
      { icon: CheckCircle2, tint: 'emerald', label: 'Agent rewards paid', value: money(summary.recordedPaymentTotal) },
    ].map(stat => <div key={stat.label} className="rounded-xl border border-stone-200 bg-white p-3"><div className="flex items-start justify-between gap-2"><p className="text-xs text-stone-500">{stat.label}</p><stat.icon aria-hidden="true" className="h-4 w-4 shrink-0 text-sky-700" /></div><p className="mt-2 break-words text-2xl font-bold text-stone-900">{loaded ? stat.value : '...'}</p></div>)}</div>
    <p className="text-xs text-stone-500">Totals follow the agent search below. Sign-ups earn commission only after a qualifying first payment.</p>
    {loaded && unassignedReferrals.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p>{unassignedReferrals.length} referral records have no matching agent and are excluded from these totals. {summarizeAgentReferrals(unassignedReferrals).awaitingCustomerPayment} are awaiting customer payment.</p><p className="mt-1 break-words">Unmatched codes: {[...new Set(unassignedReferrals.map(referral => referral.code || '(missing code)'))].join(', ')}</p></div>}
    {editor && <div ref={editorRef} className="scroll-mt-6 rounded-2xl border border-brand-200 bg-stone-50 p-5 sm:p-6">
      <h3 className="text-lg font-bold">{editor === 'new' ? 'Add an agent' : `Edit ${selected?.name || 'agent'}`}</h3>
      <form onSubmit={event => { event.preventDefault(); void save({ action: editor === 'new' ? 'create' : 'update', ...form, rewardAmount: Number(form.rewardAmount), customerDiscountAmount: Number(form.customerDiscountAmount) }); }}>
        <fieldset disabled={busy} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold">Agent name<input autoFocus required maxLength={100} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className={input} /></label>
          <label className="grid gap-2 text-sm font-semibold">Phone or email (optional)<input maxLength={200} value={form.contact} onChange={event => setForm({ ...form, contact: event.target.value })} className={input} /></label>
          <label className="grid gap-2 text-sm font-semibold">Agent login email<input type="email" maxLength={254} value={form.loginEmail} onChange={event => setForm({ ...form, loginEmail: event.target.value })} placeholder="agent@example.com" className={input} /><span className="text-xs font-normal text-stone-600">The agent signs in with this verified email to view their own dashboard. Leave blank to keep dashboard access disabled.</span></label>
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
    {loaded && visibleAgents.length > 0 && <div className="overflow-hidden rounded-xl border border-stone-200 bg-white"><div className="hidden grid-cols-[1.3fr_1fr_1fr_auto] gap-3 border-b border-stone-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500 md:grid"><span>Agent</span><span>Referrals</span><span>Commission</span><span className="w-16" /></div><div className="divide-y divide-stone-100">{visibleAgents.map(agent => {
      const customers = referrals.filter(referral => referral.code === agent.code), totals = summarizeAgentReferrals(customers), payments = agentDashboardTotals(customers);
      return <article key={agent.code} className={`grid grid-cols-2 items-center gap-3 px-4 py-3 transition-colors md:grid-cols-[1.3fr_1fr_1fr_auto] ${selectedCode === agent.code ? 'bg-sky-50' : 'hover:bg-slate-50'}`}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-sm font-semibold text-stone-900">{agent.name}</h3><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${agent.deletedAt ? 'bg-red-50 text-red-700' : agent.active === false ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>{agent.deletedAt ? 'Removed' : agent.active === false ? 'Paused' : 'Active'}</span></div><p className="mt-1 font-mono text-xs text-stone-500">{agent.code}</p></div><div className="text-xs text-stone-600"><p><strong className="text-stone-800">{customers.length}</strong> signed up / <strong className="text-stone-800">{totals.paidCustomers}</strong> paid</p><p className="mt-1 text-[11px] text-stone-500">{totals.awaitingCustomerPayment} awaiting first payment</p></div><div className="text-xs"><p className="font-semibold text-amber-800">{money(payments.dueAmount)} due</p><p className="mt-1 text-[11px] text-stone-500">{money(payments.paidAmount)} paid / Rate: {money(agent.rewardAmount ?? 0)}</p></div><button type="button" onClick={() => { setSelectedCode(agent.code); setReferralFilter('all'); setEditor(null); window.setTimeout(() => detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); }} className={button}><Eye aria-hidden="true" className="h-3.5 w-3.5" />Details</button></article>;
    })}</div></div>}
    {loaded && !visibleAgents.length && <p className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-600">{agents.length ? 'No agents match your search.' : 'No agents yet. Add your first agent to get started.'}</p>}
    {selected && <div ref={detailsRef} className="scroll-mt-6 space-y-4 rounded-xl border border-sky-200 bg-sky-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-bold">{selected.name}</h3><p className="mt-1 break-all text-sm text-stone-600">{selected.contact || 'No contact added'} &middot; {selected.code}</p></div><div className="flex flex-wrap gap-2">{!selected.deletedAt && <><button type="button" disabled={busy} onClick={() => openEditor(selected)} className={button}>Edit agent</button><button type="button" disabled={busy} onClick={() => { if (window.confirm(`Remove ${selected.name}? The code will be disabled. Referral and payment history will be kept.`)) void save({ action: 'delete', code: selected.code }); }} className={`${button} text-red-700`}>Delete agent</button></>}<button type="button" onClick={() => setSelectedCode(null)} className={button}>Close</button></div></div>
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm"><p className="font-semibold text-sky-900">Agent dashboard access</p><p className="mt-1 text-xs text-sky-800">{selected.loginEmail ? `Linked login: ${selected.loginEmail}` : 'Add a login email in Edit agent to give this agent dashboard access.'}</p><Link href="/agent-dashboard" className="mt-2 inline-block text-xs font-semibold text-sky-800 underline">Open agent dashboard</Link></div>
      {!selected.deletedAt && <div className="flex flex-wrap items-end gap-2"><label className="grid min-w-0 flex-1 gap-2 text-sm font-semibold">Share this link<input readOnly value={link} onFocus={event => event.target.select()} className={input} /></label><button type="button" onClick={() => void copy(link)} className={primary}>Copy link</button></div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-5"><h4 className="font-bold">Referral activity ({selectedReferrals.length})</h4><ListFilters activeCount={dates.activeCount + Number(referralFilter !== 'all')} onClear={() => { dates.clear(); setReferralFilter('all'); }}><label className="flex items-center gap-2 text-sm">Show<select value={referralFilter} onChange={event => setReferralFilter(event.target.value)} className={input}><option value="all">All referrals</option><option value="pending">Agent payment due</option><option value="waiting">Awaiting first payment</option><option value="paid">Payment recorded</option></select></label><DateFilterFields {...dates} /></ListFilters></div>
      <p className="text-sm text-stone-600">The new customer gets the discount at checkout. After their first successful payment, pay the agent separately and record it below.</p>
      {!visibleReferrals.length && <p className="py-4 text-sm text-stone-600">No referrals in this view.</p>}
      {visibleReferrals.map(referral => <details key={referral.uid} className="group/referral rounded-lg border border-stone-200 bg-white"><summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden"><ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-stone-400 transition-transform group-open/referral:rotate-90" />
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{referral.name || 'Customer'}</p><p className="break-all text-sm text-stone-600">{referral.email}</p><p className="mt-1 text-xs text-stone-500">Referred {new Date(referral.joinedAt).toLocaleDateString('en-IN')}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${referral.rewardStatus === 'Rewarded' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>{agentReferralStage(referral)}</span></div></summary><div className="space-y-3 border-t border-stone-100 p-3">
        {referral.hasPaidOrder && <p className="text-sm text-emerald-800">New customer discount: {money(referral.customerDiscountAmount ?? 0)}. First paid order: {referral.eligiblePaidOrderId}.</p>}
        {referral.rewardStatus === 'Rewarded' ? <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><p className="font-semibold">{referral.rewardPaidAmount === undefined ? 'Amount recorded in payment notes' : `${money(referral.rewardPaidAmount)} paid to agent`}</p><p className="mt-1 whitespace-pre-wrap break-words">{referral.rewardNotes}</p>{referral.rewardedAt && <p className="mt-2 text-xs">Recorded {new Date(referral.rewardedAt).toLocaleString('en-IN')}</p>}</div> : !referral.hasPaidOrder ? <p className="text-sm text-stone-600">Awaiting the new customer first paid order. No agent payment is due yet.</p> : (referral.rewardAmount ?? 0) === 0 ? <p className="text-sm text-stone-600">The agent reward was set to zero when this customer paid. No agent payment is due.</p> : <form onSubmit={event => { event.preventDefault(); const amount = referral.rewardAmount ?? selected.rewardAmount ?? 0; if (window.confirm(`Confirm you have paid ${money(amount)} to ${selected.name} for this referral?`)) void save({ action: 'reward', uid: referral.uid, notes: notes[referral.uid] }); }}>
          <p className="mb-3 text-sm font-semibold">Agent reward: {money(referral.rewardAmount ?? selected.rewardAmount ?? 0)}. New customer discount: {money(referral.customerDiscountAmount ?? 0)}.</p><fieldset disabled={busy} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><label className="grid gap-2 text-sm font-semibold">Payment reference / notes<textarea required rows={2} maxLength={1000} value={notes[referral.uid] || ''} onChange={event => setNotes({ ...notes, [referral.uid]: event.target.value })} placeholder="UPI reference, payment date or bank transfer details" className={input} /></label><button disabled={!notes[referral.uid]?.trim()} className={`${primary} self-end`}>Record payment</button></fieldset>
        </form>}
      </div></details>)}
      {paid.some(referral => referral.code === selected.code && referral.rewardPaidAmount === undefined) && <p className="text-xs text-stone-500">Older payments without a numeric amount are kept in history and excluded from payment totals.</p>}
    </div>}
  </section>;
}
