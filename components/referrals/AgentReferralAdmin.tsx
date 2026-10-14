'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, RefreshCw, Users, Ticket, Gift, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface Agent { code: string; name: string; contact: string }
interface Customer { uid: string; code: string; name: string; email: string; joinedAt: string; rewardStatus: string; rewardNotes?: string; rewardedAt?: string }

export function AgentReferralAdmin() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [code, setCode] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const response = await fetch('/api/admin/agents', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setAgents(data.agents); setCustomers(data.customers); setLoaded(true);
  }, [user]);
  useEffect(() => { void Promise.resolve().then(load).catch(e => setError(e.message)); }, [load]);
  async function save(body: { action: 'create' | 'reward'; name?: string; contact?: string; code?: string; uid?: string; notes?: string }) {
    if (!user || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/agents', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (body.action === 'create') { setName(''); setContact(''); setCode(''); }
      setNotice(body.action === 'create' ? 'Agent code created. You can now copy and share the link.' : 'Reward recorded successfully.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setBusy(false); }
  }
  const inputClass = 'min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-600';
  const pendingCount = customers.filter(customer => customer.rewardStatus !== 'Rewarded').length;
  const visibleAgents = agents.filter(agent => {
    const referrals = customers.filter(customer => customer.code === agent.code);
    const matchesSearch = [agent.name, agent.code, agent.contact, ...referrals.flatMap(customer => [customer.name, customer.email])].join(' ').toLowerCase().includes(search.trim().toLowerCase());
    return matchesSearch && (filter === 'ALL' || (filter === 'PENDING' ? referrals.some(customer => customer.rewardStatus !== 'Rewarded') : referrals.some(customer => customer.rewardStatus === 'Rewarded')));
  }).sort((a, b) => a.name.localeCompare(b.name));
  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setNotice(`${label} copied.`); setError(''); }
    catch { setError('Could not copy automatically. Select the code or link and copy it manually.'); }
  }
  async function refresh() {
    setRefreshing(true); setError('');
    try { await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not refresh.'); }
    finally { setRefreshing(false); }
  }
  return <section className="mt-8 space-y-6 border-t border-stone-200 pt-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-xl font-bold text-stone-900">Agent Referral Codes</h2><p className="mt-2 max-w-2xl text-sm text-stone-600">Give each agent their own code and share link. See the customers they bring and keep a record of rewards you have given.</p></div>
      <button type="button" disabled={busy || refreshing} onClick={() => void refresh()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"><RefreshCw aria-hidden="true" className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />{refreshing ? 'Refreshing...' : 'Refresh'}</button>
    </div>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    <div className="grid gap-3 sm:grid-cols-3">
      {[{ label: 'Agent codes', count: agents.length, icon: Ticket }, { label: 'Referred customers', count: customers.length, icon: Users }, { label: 'Rewards to review', count: pendingCount, icon: Gift }].map(item => <div key={item.label} className="rounded-2xl border border-stone-200 bg-white p-5"><div className="flex items-center gap-2 text-sm font-semibold text-stone-600"><item.icon aria-hidden="true" className="h-4 w-4" />{item.label}</div><p className="mt-2 text-3xl font-bold text-stone-900">{loaded ? item.count : '—'}</p></div>)}
    </div>
    <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
      <h3 className="font-bold text-stone-900">Create an agent code</h3><p className="mt-1 text-sm text-stone-600">Use a name your team can recognise. Each code belongs to one agent.</p>
      <form onSubmit={e => { e.preventDefault(); void save({ action: 'create', name, contact, code }); }} className="mt-4 grid items-start gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold">Agent name<input required maxLength={100} placeholder="e.g. Ravi Kumar" value={name} onChange={e => setName(e.target.value)} className={inputClass} disabled={busy} /></label>
        <label className="grid gap-2 text-sm font-semibold">Phone or email (optional)<input maxLength={200} value={contact} onChange={e => setContact(e.target.value)} className={inputClass} disabled={busy} /></label>
        <label className="grid gap-2 text-sm font-semibold">Referral code<input required pattern="AG[A-Z0-9]{3,18}" placeholder="AGRAVI2026" maxLength={20} value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} className={`${inputClass} font-mono`} disabled={busy} /><span className="text-xs font-normal text-stone-600">Start with AG. Use 5 to 20 letters and numbers.</span></label>
        <div className="flex flex-wrap gap-2 md:pt-7"><button type="button" disabled={busy} onClick={() => setCode(`AG${name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'AGENT'}${Math.random().toString(36).slice(2, 7).toUpperCase()}`)} className="min-h-11 rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Suggest a code</button><button disabled={busy} className="min-h-11 rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving...' : 'Create code'}</button></div>
      </form>
    </div>
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]"><label className="grid gap-2 text-sm font-semibold">Search agents or customers<input type="search" placeholder="Name, code, phone or customer email" value={search} onChange={e => setSearch(e.target.value)} className={inputClass} /></label><label className="grid gap-2 text-sm font-semibold">Rewards<select value={filter} onChange={e => setFilter(e.target.value)} className={inputClass}><option value="ALL">All agents</option><option value="PENDING">Rewards to review</option><option value="REWARDED">Rewards recorded</option></select></label></div>
    <p className="text-sm text-stone-600">Rewards are recorded manually after you give them to the agent. This does not send money or give customers automatic credits.</p>
    {!loaded && !error && <p role="status">Loading agent referrals...</p>}
    {loaded && <p className="text-sm text-stone-600" aria-live="polite">{visibleAgents.length} of {agents.length} agents shown</p>}
    {loaded && !visibleAgents.length && <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-600">{agents.length ? 'No agents match your search or reward filter.' : 'Create your first agent code above, then share the link with your agent.'}{agents.length > 0 && <button type="button" onClick={() => { setSearch(''); setFilter('ALL'); }} className="ml-2 font-semibold text-brand-700 underline">Clear filters</button>}</div>}
    {visibleAgents.map(agent => {
      const referrals = customers.filter(c => c.code === agent.code).sort((a, b) => b.joinedAt.localeCompare(a.joinedAt));
      const pending = referrals.filter(c => c.rewardStatus !== 'Rewarded').length;
      const link = typeof window === 'undefined' ? '' : `${window.location.origin}/?ref=${encodeURIComponent(agent.code)}`;
      return <article key={agent.code} className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-bold text-stone-900">{agent.name}</h3><p className="mt-1 break-words text-sm text-stone-600">{agent.contact || 'No contact added'}</p></div><div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2"><span className="break-all font-mono font-bold text-blue-900">{agent.code}</span><button type="button" onClick={() => void copy(agent.code, 'Agent code')} aria-label={`Copy code for ${agent.name}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-blue-800 hover:bg-blue-100"><Copy aria-hidden="true" className="h-4 w-4" /></button></div></div>
          <div className="flex flex-wrap gap-2 text-sm"><span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-800">{referrals.length} customers</span><span className={`rounded-full border px-3 py-1 ${pending ? 'border-yellow-300 bg-yellow-50 text-yellow-900' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{pending} rewards to review</span><span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800">{referrals.length - pending} rewards recorded</span></div>
          <div className="flex flex-wrap items-end gap-2"><label className="grid min-w-0 flex-1 gap-2 text-sm font-semibold" htmlFor={`agent-link-${agent.code}`}>Agent share link<input id={`agent-link-${agent.code}`} readOnly value={link} onFocus={e => e.target.select()} className={inputClass} /></label><button type="button" onClick={() => void copy(link, 'Share link')} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white"><Copy aria-hidden="true" className="h-4 w-4" />Copy link</button></div>
        </div>
        <details className="border-t border-stone-200"><summary className="flex min-h-12 cursor-pointer items-center justify-between gap-2 px-5 py-4 text-sm font-semibold text-brand-700 sm:px-6">View referred customers ({referrals.length})<ChevronDown aria-hidden="true" className="h-4 w-4" /></summary><div className="space-y-4 px-5 pb-5 sm:px-6">
          {!referrals.length && <p className="text-sm text-stone-600">No customers have signed in with this agent code yet.</p>}
          {referrals.map(customer => <div key={customer.uid} className="space-y-3 rounded-xl border border-stone-200 p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-stone-900">{customer.name || 'Customer'}</p><p className="break-all text-stone-600">{customer.email}</p><p className="mt-1 text-xs text-stone-600">Referred on {new Date(customer.joinedAt).toLocaleString('en-IN')}</p></div><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${customer.rewardStatus === 'Rewarded' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-yellow-300 bg-yellow-50 text-yellow-900'}`}>{customer.rewardStatus === 'Rewarded' ? 'Reward recorded' : 'Reward to review'}</span></div>
            {customer.rewardStatus === 'Rewarded' ? <div className="rounded-lg bg-emerald-50 p-3 text-emerald-900"><p className="whitespace-pre-wrap break-words">{customer.rewardNotes}</p>{customer.rewardedAt && <p className="mt-1 text-xs">Recorded {new Date(customer.rewardedAt).toLocaleDateString('en-IN')}</p>}</div> : <form onSubmit={e => { e.preventDefault(); if (window.confirm(`Record this reward as given to ${agent.name} for ${customer.name || customer.email || 'this customer'}?`)) void save({ action: 'reward', uid: customer.uid, notes: notes[customer.uid] }); }} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><label className="grid gap-2 font-semibold">Reward given<textarea required maxLength={1000} rows={2} value={notes[customer.uid] || ''} onChange={e => setNotes({ ...notes, [customer.uid]: e.target.value })} placeholder="e.g. ₹500 paid to agent via UPI on 14 October" className={inputClass} disabled={busy} /></label><button disabled={busy || !notes[customer.uid]?.trim()} className="min-h-11 self-end rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white disabled:opacity-50">Record reward given</button></form>}
          </div>)}
        </div></details>
      </article>;
    })}
  </section>;
}
