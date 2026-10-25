'use client';

import { useEffect, useState } from 'react';
import { Copy, Check } from 'lucide-react';

const referenceCache = new Map<string, Promise<string>>();

export function OrderReference({ reference }: { reference: string }) {
  const [resolved, setResolved] = useState<{ reference: string; value?: string; failed?: boolean } | null>(null);
  const [clipboard, setClipboard] = useState<{ reference: string; status: 'copied' | 'failed' } | null>(null);
  const publicReference = /^AP-\d{6}$/.test(reference) ? reference : resolved?.reference === reference ? resolved.value || '' : '';
  const copied = clipboard?.reference === reference && clipboard.status === 'copied';
  const error = (resolved?.reference === reference && resolved.failed) || (clipboard?.reference === reference && clipboard.status === 'failed');
  useEffect(() => {
    let active = true;
    if (/^AP-\d{6}$/.test(reference)) return;
    if (!referenceCache.has(reference)) referenceCache.set(reference, (async () => {
      const { auth } = await import('@/lib/firebase');
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Sign in to view reference');
      const response = await fetch('/api/orders/reference', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: reference }) });
      if (!response.ok) throw new Error('Unable to load reference');
      return (await response.json()).reference as string;
    })());
    referenceCache.get(reference)!.then(value => { if (active) setResolved({ reference, value }); }).catch(() => { referenceCache.delete(reference); if (active) setResolved({ reference, failed: true }); });
    return () => { active = false; };
  }, [reference]);

  return <span className="inline-flex max-w-full flex-wrap items-center gap-2 align-middle">
    <span className="whitespace-nowrap font-mono text-sm font-semibold text-stone-900">{publicReference || 'Loading reference...'}</span>
    <button type="button" disabled={!publicReference} aria-label={`Copy order reference ${publicReference}`} title="Copy reference" onClick={async event => {
      event.preventDefault(); event.stopPropagation();
      try { await navigator.clipboard.writeText(publicReference); setClipboard({ reference, status: 'copied' }); setTimeout(() => setClipboard(previous => previous?.reference === reference ? null : previous), 2000); }
      catch { setClipboard({ reference, status: 'failed' }); }
    }} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
    <span role="status" className="text-sm text-stone-700">{copied ? 'Copied' : error ? publicReference ? `Copy manually: ${publicReference}` : 'Reference unavailable - refresh to retry' : ''}</span>
  </span>;
}
