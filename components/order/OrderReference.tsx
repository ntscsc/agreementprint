'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export function OrderReference({ reference }: { reference: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const short = reference.length > 20 ? `${reference.slice(0, 8)}…${reference.slice(-6)}` : reference;
  return <span className="inline-flex max-w-full flex-wrap items-center gap-2 align-middle">
    <span title={reference} className="whitespace-nowrap font-mono text-sm font-semibold text-stone-900">{short}</span>
    <button type="button" aria-label={`Copy full order reference ${reference}`} title="Copy full reference" onClick={async event => {
      event.preventDefault(); event.stopPropagation();
      try { await navigator.clipboard.writeText(reference); setCopied(true); setError(false); setTimeout(() => setCopied(false), 2000); }
      catch { setError(true); }
    }} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
    <span role="status" className="text-sm text-stone-700">{copied ? 'Copied' : error ? `Copy manually: ${reference}` : ''}</span>
  </span>;
}
