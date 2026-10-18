'use client';

import { useEffect, useState } from 'react';
import { Users, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { readApiResponse } from '@/lib/api-response';
import type { VisitorCounts } from '@/lib/visitor-metrics';
import { isValidCalendarDate } from '@/lib/calendar-date';

export function VisitorStatsPanel({ counts, loading, error, refresh }: { counts: VisitorCounts | null; loading: boolean; error: string; refresh: () => void }) {
  const date = (value: string) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
  return <section aria-labelledby="visitor-stats-title" className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex items-center justify-between gap-3"><h2 id="visitor-stats-title" className="flex items-center gap-2 text-lg font-bold text-stone-900"><Users aria-hidden="true" className="h-5 w-5 text-brand-700"/>Website visitors</h2><button type="button" disabled={loading} onClick={refresh} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 disabled:opacity-50"><RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/>Refresh visitors</button></div>
    <p className="mt-2 text-sm text-stone-600">Unique browsers, counted once per period. Admin pages and development traffic are excluded. All dates use India time.</p>
    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3" aria-busy={loading}>
      {([{label:'Today',key:'today',detail:counts ? date(`${counts.day}T12:00:00+05:30`) : 'India time'}, {label:'This month',key:'month',detail:counts ? new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',month:'long',year:'numeric'}).format(new Date(`${counts.monthKey}-01T12:00:00+05:30`)) : 'Calendar month'}, {label:'Total visitors',key:'total',detail:'Since tracking began'}] as const).map(item=><div key={item.key} className="rounded-xl border border-brand-100 bg-brand-50 p-4"><p className="text-sm font-semibold text-stone-600">{item.label}</p><p className="mt-2 text-3xl font-black text-brand-800">{loading ? '…' : counts ? counts[item.key].toLocaleString('en-IN') : '—'}</p><p className="mt-2 text-xs text-stone-500">{item.detail}</p></div>)}
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    {!loading && counts && <p className="mt-3 text-xs text-stone-500">{counts.startedAt ? `Tracking began ${date(counts.startedAt)}.` : 'Tracking starts when the first public visitor is recorded after deployment.'} These are browser counts, not verified people; cleared storage, other devices and undetected bots can affect totals.</p>}
  </section>;
}

export function AdminVisitorStats() {
  const { user } = useAuth();
  const [refresh, setRefresh] = useState(0);
  const [state,setState] = useState<{counts:VisitorCounts|null;loading:boolean;error:string}>({counts:null,loading:true,error:''});
  useEffect(()=>{
    if (!user) return;
    let active=true;
    const abort = new AbortController();
    async function load() {
      await Promise.resolve();
      if (!active) return;
      setState({counts:null,loading:true,error:''});
      try {
        const token=await user!.getIdToken();
        const response=await fetch('/api/admin/visitors',{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:abort.signal});
        const data=await readApiResponse(response);
        if (!['today','month','total'].every(key=>Number.isSafeInteger(data[key])&&data[key]>=0) || !isValidCalendarDate(data.day) || data.monthKey!==data.day.slice(0,7) || !(data.startedAt===null || (typeof data.startedAt==='string' && Number.isFinite(Date.parse(data.startedAt))))) throw new Error('Visitor counts are unavailable. Please refresh.');
        const counts:VisitorCounts={today:data.today,month:data.month,total:data.total,day:data.day,monthKey:data.monthKey,startedAt:data.startedAt};
        if(active) setState({counts,loading:false,error:''});
      } catch(error) {
        if(active) setState({counts:null,loading:false,error:error instanceof Error ? error.message : 'Unable to load visitor counts.'});
      }
    }
    void load();
    return ()=>{active=false;abort.abort();};
  },[user,refresh]);
  return <VisitorStatsPanel {...state} refresh={()=>setRefresh(value=>value+1)}/>;
}
