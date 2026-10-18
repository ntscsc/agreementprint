'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { readApiResponse } from '@/lib/api-response';

export function DownloadBillButton({ orderId }: { orderId: string }) {
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
      <button type="button" disabled={!user || busy} onClick={() => void download()} className="inline-flex items-center justify-center gap-2 min-h-11 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50">
        <Download className="h-4 w-4" aria-hidden="true" />{busy ? 'Preparing bill...' : 'Download Bill (PDF)'}
      </button>
      {error && <p role="alert" className="max-w-sm text-xs text-rose-700">{error}</p>}
    </div>
  );
}
