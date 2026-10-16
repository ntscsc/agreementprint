'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { PartyPopper, X } from 'lucide-react';
import './celebration.css';

// Also suppress repeats when browser storage is unavailable.
const shownThisVisit = new Set<string>();
const progressThisVisit = new Map<string, number>();

function claimCelebration(key: string, progressKey?: string, progressValue?: number) {
  if (shownThisVisit.has(key)) return false;
  if (progressKey && progressValue !== undefined && (progressThisVisit.get(progressKey) ?? 0) >= progressValue) return false;
  try {
    if (localStorage.getItem(key)) return false;
    if (progressKey && progressValue !== undefined) {
      const previous = Number(localStorage.getItem(progressKey) ?? 0);
      if (Number.isFinite(previous) && previous >= progressValue) return false;
      localStorage.setItem(progressKey, String(progressValue));
    }
    localStorage.setItem(key, 'seen');
  } catch { /* A celebration must never interfere with checkout. */ }
  shownThisVisit.add(key);
  if (progressKey && progressValue !== undefined) progressThisVisit.set(progressKey, progressValue);
  return true;
}

export function Celebration({ eventKey, message, progressKey, progressValue }: { eventKey: string | null; message: string; progressKey?: string; progressValue?: number }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  useEffect(() => {
    let finish: number | undefined;
    // Claim after mount so React Strict Mode's initial cleanup cannot consume it.
    const start = window.setTimeout(() => {
      setActiveKey(null);
      if (!eventKey || !claimCelebration(eventKey, progressKey, progressValue)) return;
      setActiveKey(eventKey);
      finish = window.setTimeout(() => setActiveKey(null), 6000);
    }, 0);
    return () => { window.clearTimeout(start); if (finish) window.clearTimeout(finish); };
  }, [eventKey, progressKey, progressValue]);

  if (!eventKey || activeKey !== eventKey || typeof document === 'undefined') return null;
  return createPortal(<div className="celebration-layer no-print">
    <div className="celebration-confetti" aria-hidden="true">{Array.from({ length: 30 }, (_, index) => <i key={index} style={{
      left: `${(index * 37) % 100}%`, backgroundColor: ['#0b5e9e', '#328c51', '#38bdf8', '#86efac', '#fbbf24'][index % 5],
      '--drift': `${(index % 2 ? 1 : -1) * (35 + index % 7 * 18)}px`,
      animationDelay: `${index % 6 * 0.11}s`, animationDuration: `${2.6 + index % 5 * 0.22}s`,
    } as CSSProperties} />)}</div>
    <div className="celebration-toast"><PartyPopper aria-hidden="true" className="h-6 w-6 shrink-0" /><p role="status" className="min-w-0 flex-1">{message}</p><button type="button" aria-label="Dismiss celebration" onClick={() => setActiveKey(null)}><X aria-hidden="true" className="h-4 w-4" /></button></div>
  </div>, document.body);
}

export function paidOrderCelebrationKey(uid: string, orderId: string) {
  return `agreementprint:celebration:paid:${uid}:${orderId}`;
}
