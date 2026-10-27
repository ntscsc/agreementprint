'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export function ListFilters({ children, activeCount = 0, onClear }: { children: ReactNode; activeCount?: number; onClear: () => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) ref.current.open = false; };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  const done = () => { if (ref.current) { ref.current.open = false; ref.current.querySelector('summary')?.focus(); } };
  return <details ref={ref} className="relative shrink-0" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); done(); } }}>
    <summary aria-label="Filters" title="Filter by date or status" className={`inline-flex min-h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden ${activeCount ? 'border-blue-300 bg-blue-50 text-blue-900' : 'border-stone-300 bg-white text-stone-700'}`}>
      <span aria-hidden="true" className="h-4 w-4 shrink-0" style={{ backgroundColor: 'currentColor', mask: 'url(/icons/tabler/filter.svg) center / contain no-repeat', WebkitMask: 'url(/icons/tabler/filter.svg) center / contain no-repeat' }} />
      <span className="sr-only">Filters</span>{activeCount > 0 && <span aria-label={`${activeCount} active filters`} className="rounded-full bg-blue-800 px-1.5 py-0.5 text-xs text-white">{activeCount}</span>}
    </summary>
    <div className="absolute right-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] space-y-4 rounded-xl border border-stone-200 bg-white p-4 shadow-xl sm:w-96">
      <p className="text-sm font-bold text-stone-900">Filter results</p>
      {children}
      <div className="flex items-center justify-between border-t border-stone-200 pt-3"><button type="button" onClick={onClear} className="min-h-11 px-2 text-sm font-semibold text-stone-600 hover:underline">Clear filters</button><button type="button" onClick={done} className="min-h-11 rounded-lg bg-blue-800 px-4 text-sm font-semibold text-white">Done</button></div>
    </div>
  </details>;
}

export function DateFilterFields({ from, to, setFrom, setTo, fromLabel = 'From date', toLabel = 'To date' }: { from: string; to: string; setFrom: (value: string) => void; setTo: (value: string) => void; fromLabel?: string; toLabel?: string }) {
  const input = 'mt-1 min-h-11 w-full min-w-0 rounded-lg border border-stone-300 bg-white px-2 text-sm';
  return <div className="grid grid-cols-2 gap-3"><label className="min-w-0 text-sm font-semibold text-stone-700">{fromLabel}<input type="date" value={from} max={to || undefined} onChange={event => setFrom(event.target.value)} className={input} /></label><label className="min-w-0 text-sm font-semibold text-stone-700">{toLabel}<input type="date" value={to} min={from || undefined} onChange={event => setTo(event.target.value)} className={input} /></label></div>;
}
const indiaDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
export function useListDates() {
  const [from, setFrom] = useState(''), [to, setTo] = useState('');
  return { from, to, setFrom, setTo, activeCount: Number(!!from) + Number(!!to), clear: () => { setFrom(''); setTo(''); }, matches: (value?: string) => {
    if (!from && !to) return true;
    if (!value || !Number.isFinite(Date.parse(value))) return false;
    const day = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : indiaDay.format(new Date(value));
    return (!from || day >= from) && (!to || day <= to);
  } };
}
