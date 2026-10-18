'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { isVisitorId, isVisitorPage, visitorCalendarKeys } from '@/lib/visitor-metrics';

const pending = new Set<string>();

export function VisitorTracker() {
  const pathname = usePathname();
  const { loading, isAdmin } = useAuth();
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (loading || isAdmin || !pathname || !isVisitorPage(pathname) || navigator.doNotTrack === '1') return;
    let key: string;
    let visitorId: string;
    try {
      key = `agreementprint.visit.${visitorCalendarKeys().day}`;
      if (localStorage.getItem('agreementprint.lastVisit') === key || pending.has(key)) return;
      const savedId = localStorage.getItem('agreementprint.visitorId');
      visitorId = isVisitorId(savedId) ? savedId : crypto.randomUUID();
      localStorage.setItem('agreementprint.visitorId', visitorId);
    } catch { return; }
    pending.add(key);
    void fetch('/api/visitors', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId, path: pathname }), keepalive: true,
    }).then(response => {
      if (response.ok) {
        try { localStorage.setItem('agreementprint.lastVisit', key); } catch { /* Tracking must not affect browsing. */ }
      }
    }).catch(() => { /* A failed counter request must not affect the website. */ }).finally(() => pending.delete(key));
  }, [pathname, loading, isAdmin]);
  return null;
}
