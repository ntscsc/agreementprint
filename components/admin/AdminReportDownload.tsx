'use client';

import { useState } from 'react';
import { FileSpreadsheet, LoaderCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { readApiResponse } from '@/lib/api-response';

export function AdminReportDownload() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function download() {
    if (!user || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/reports', { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: 'no-store' });
      if (!response.ok) { await readApiResponse(response); throw new Error('Unable to download reports.'); }
      if (!response.headers.get('Content-Type')?.includes('spreadsheetml.sheet')) throw new Error('The report download was unavailable. Please try again.');
      const url = URL.createObjectURL(await response.blob()), link = document.createElement('a');
      link.href = url;
      link.download = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || 'AgreementPrint-Admin-Reports.xlsx';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to download reports. Please try again.'); }
    finally { setBusy(false); }
  }
  return <section className="rounded-2xl border border-stone-200 bg-white p-5" aria-label="Download business reports"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-bold text-stone-900">Business reports</h2><p className="mt-1 text-sm text-stone-600">All saved records in one Excel workbook, with separate report sheets and customer details.</p></div><button type="button" disabled={!user || busy} onClick={() => void download()} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" /> : <FileSpreadsheet aria-hidden="true" className="h-5 w-5" />}{busy ? 'Preparing workbook…' : 'Download All Reports (.xlsx)'}</button></div>{error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}</section>;
}
