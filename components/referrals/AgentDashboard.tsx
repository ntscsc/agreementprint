'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Check, RefreshCw, Users, CreditCard, Wallet, CircleCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { readApiResponse } from '@/lib/api-response';
import { WorkflowProgress } from '@/components/ui/WorkflowProgress';
import type { agentDashboardTotals } from '@/lib/agent-dashboard';

interface DashboardData {
  agents: { code: string; name: string; active: boolean }[];
  code?: string;
  agent?: { name: string; active: boolean; rewardAmount: number; customerDiscountAmount: number };
  summary?: ReturnType<typeof agentDashboardTotals>;
  referrals: { id: string; name: string; joinedAt: string; stage: string; rewardAmount?: number; rewardPaidAmount?: number; orderReference?: string; rewardedAt?: string }[];
  page?: number; total?: number; hasNext?: boolean;
}
const money = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;
const button = 'inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-sky-200 bg-white px-3 text-xs font-semibold text-sky-800 transition-colors hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600 disabled:cursor-wait disabled:opacity-50';
const stages = ['All', 'Signed up', 'First order paid', 'Commission due', 'Commission paid'];

export function AgentDashboard() {
  const { user } = useAuth();
  return <AgentDashboardBody key={user?.uid || 'guest'} />;
}

function AgentDashboardBody() {
  const { user, loading: authLoading, signIn } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [code, setCode] = useState(''), [stage, setStage] = useState('All'), [page, setPage] = useState(1);
  const [copied, setCopied] = useState(false);
  const sequence = useRef(0);
  const invalidate = useCallback(() => { ++sequence.current; }, []);
  const load = useCallback(async () => {
    if (!user) return;
    const current = ++sequence.current;
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ stage, page: String(page), ...(code ? { code } : {}) });
      const result = await readApiResponse(await fetch(`/api/agents/dashboard?${params}`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: 'no-store', signal: AbortSignal.timeout(30000) }));
      if (current === sequence.current) setData(result as DashboardData);
    } catch (reason) { if (current === sequence.current) setError(reason instanceof Error ? reason.message : 'Unable to load your agent dashboard.'); }
    finally { if (current === sequence.current) setLoading(false); }
  }, [user, code, stage, page]);
  useEffect(() => {
    const start = setTimeout(() => void load(), 0);
    const refresh = setInterval(() => void load(), 60000);
    return () => { clearTimeout(start); clearInterval(refresh); invalidate(); };
  }, [load, invalidate]);
  const shareLink = data?.code && typeof window !== 'undefined' ? `${window.location.origin}/order?coupon=${encodeURIComponent(data.code)}` : '';
  if (authLoading) return <p role="status">Checking your account...</p>;
  if (!user) return <section className="mx-auto max-w-md space-y-3 rounded-2xl border border-sky-200 bg-white p-6"><h1 className="text-xl font-bold">Agent dashboard</h1><p className="text-sm text-slate-600">Sign in with the email your administrator linked to your agent account.</p><button type="button" className={button} onClick={() => void signIn().catch(reason => setError(reason instanceof Error ? reason.message : 'Sign-in failed.'))}>Sign in</button>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}</section>;
  return <div className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-900">Agent dashboard</h1><p className="mt-1 text-sm text-slate-500">Your referrals, commission and payment history.</p></div><button type="button" onClick={() => void load()} disabled={loading} className={button}><RefreshCw aria-hidden="true" className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />{loading ? 'Refreshing...' : 'Refresh'}</button></header>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {!data && loading && <p role="status" className="text-sm text-slate-500">Loading your agent account...</p>}
    {data && !data.agents.length && <section className="space-y-2 rounded-xl border border-sky-200 bg-sky-50 p-5"><h2 className="font-semibold text-sky-900">Your login is not linked to an agent yet</h2><p className="text-sm text-sky-900">Ask your administrator to add <strong className="break-all">{user.email}</strong> as your agent login email, then refresh this page.</p></section>}
    {data?.agent && data.summary && <>
      {data.agents.length > 1 && <label className="block text-xs font-semibold text-slate-600">Agent account<select disabled={loading} value={code || data.code} onChange={event => { setCode(event.target.value); setPage(1); setStage('All'); setCopied(false); }} className="mt-1 min-h-10 rounded-lg border border-sky-200 bg-white px-3 text-sm">{data.agents.map(agent => <option key={agent.code} value={agent.code}>{agent.name} / {agent.code}</option>)}</select></label>}
      <section className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-sky-950">{data.agent.name}</h2><span className="font-mono text-xs text-sky-800">{data.code}</span></div>{data.agent.active ? <><p className="text-xs text-sky-900">You earn {money(data.agent.rewardAmount)} after each new customer’s first qualifying paid agreement. They save {money(data.agent.customerDiscountAmount)} on that first order.</p><div className="flex gap-2"><input aria-label="Your referral link" readOnly value={shareLink} onFocus={event => event.target.select()} className="min-w-0 flex-1 rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs" /><button type="button" className={button} onClick={async () => { try { await navigator.clipboard.writeText(shareLink); setCopied(true); } catch { setError('Select your referral link and copy it manually.'); } }}>{copied ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy link'}</button></div></> : <p className="text-xs text-sky-900">This agent code is inactive for new referrals. Your existing referral and payment history remains available.</p>}</section>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[
        ['Customers signed up', data.summary.signedUp], ['First orders paid', data.summary.firstOrderPaid],
        ['Commission due', money(data.summary.dueAmount)], ['Commission paid', money(data.summary.paidAmount)],
      ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-stone-200 bg-white p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-900">{value}</p>{label === 'Commission due' && <p className="mt-1 text-[11px] text-slate-500">Across {data.summary!.dueCount} referrals</p>}</div>)}</div>
      <p className="text-xs leading-5 text-slate-500">Signing up records a referral. Commission is earned after a qualifying first payment and paid separately by your administrator. This page refreshes every minute.</p>
      <WorkflowProgress current={-1} label="How agent commission works" steps={[{ label: 'Signed up', icon: Users }, { label: 'First order paid', icon: CreditCard }, { label: 'Commission due', icon: Wallet }, { label: 'Commission paid', icon: CircleCheck }]} />
      <section className="overflow-hidden rounded-xl border border-stone-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 p-3"><h2 className="text-sm font-semibold">Referral activity</h2><select aria-label="Filter referral stage" value={stage} disabled={loading} onChange={event => { setStage(event.target.value); setPage(1); }} className="min-h-9 rounded-lg border border-stone-200 bg-white px-2 text-xs">{stages.map(label => <option key={label}>{label}</option>)}</select></div><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{['Customer', 'Signed up', 'Stage', 'Order', 'Commission'].map(label => <th key={label} scope="col" className="px-3 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-stone-100">{data.referrals.map(row => <tr key={row.id}><td className="max-w-44 break-words px-3 py-3 font-medium">{row.name}</td><td className="px-3 py-3 text-slate-500">{row.joinedAt ? new Date(row.joinedAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Not recorded'}</td><td className="px-3 py-3"><span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 ${row.stage === 'Commission paid' ? 'bg-emerald-50 text-emerald-800' : row.stage === 'Commission due' ? 'bg-amber-50 text-amber-900' : 'bg-sky-50 text-sky-800'}`}>{row.stage}</span></td><td className="px-3 py-3 font-mono text-slate-500">{row.orderReference || '—'}</td><td className="px-3 py-3">{row.stage === 'Commission paid' ? row.rewardPaidAmount === undefined ? 'Amount not recorded' : money(row.rewardPaidAmount) : row.stage === 'Commission due' ? money(row.rewardAmount || 0) : row.stage === 'First order paid' ? 'No commission due' : 'Not earned yet'}{row.rewardedAt && <p className="mt-1 text-[10px] text-slate-500">Paid {new Date(row.rewardedAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>}</td></tr>)}</tbody></table></div>{!data.referrals.length && <p className="p-5 text-sm text-slate-500">No referrals in this view.</p>}<div className="flex items-center justify-between border-t border-stone-100 p-3"><button type="button" disabled={loading || page === 1} className={button} onClick={() => setPage(value => value - 1)}>Previous</button><span className="text-xs text-slate-500">Page {data.page} / {data.total} referrals</span><button type="button" disabled={loading || !data.hasNext} className={button} onClick={() => setPage(value => value + 1)}>Next</button></div></section>
      {data.summary.unknownPayments > 0 && <p className="text-xs text-amber-800">{data.summary.unknownPayments} older payments have no recorded amount and are excluded from the paid total.</p>}
    </>}
  </div>;
}
