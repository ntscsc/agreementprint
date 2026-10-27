'use client';

import { useState } from 'react';
import { Download, LoaderCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { readApiResponse } from '@/lib/api-response';

export function DownloadBillButton({ orderId, iconOnly = false, compact = false }: { orderId: string; iconOnly?: boolean; compact?: boolean }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function download() {
    if (!user || busy) return;
    setBusy(true);
    setError('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/orders/bill', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      if (!response.ok) {
        const data = await readApiResponse(response);
        throw new Error(data.error || 'Unable to download your bill.');
      }
      if (!response.headers.get('Content-Type')?.includes('application/pdf')) throw new Error('Unable to download your bill. Please try again.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `AgreementPrint-Bill-${orderId.replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to download your bill. Please try again.');
    } finally { setBusy(false); }
  }
  return (
    <div className="space-y-2">
      <button type="button" aria-label={busy ? 'Preparing bill' : 'Download bill (PDF)'} title={busy ? 'Preparing bill...' : 'Download bill (PDF)'} disabled={!user || busy} onClick={() => void download()} className={`inline-flex items-center justify-center gap-1.5 ${compact ? 'h-9' : 'min-h-11'} border font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${iconOnly || compact ? `${iconOnly ? 'h-11 w-11' : 'px-3 text-xs'} rounded-lg border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus-visible:outline-emerald-600` : 'rounded-xl border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 focus-visible:outline-brand-600'}`}>
        {busy ? <LoaderCircle className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} animate-spin`} aria-hidden="true" /> : <Download className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true" />}{!iconOnly && (busy ? compact ? 'Preparing...' : 'Preparing bill...' : compact ? 'Bill' : 'Download Bill (PDF)')}
      </button>
      {error && <p role="alert" className="max-w-sm text-xs text-rose-700">{error}</p>}
    </div>
  );
}
