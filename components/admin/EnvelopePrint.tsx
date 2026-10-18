'use client';

import { useEffect, useRef, useState } from 'react';
import { envelopeHtml, fitEnvelopeAddresses } from '@/lib/envelope-layout';
import { Printer } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { readApiResponse } from '@/lib/api-response';
import type { Order } from '@/lib/types';

interface Address { name: string; address: string; phone: string; }
const empty: Address = { name: '', address: '', phone: '' };
const sizes = { DL: { label: 'DL — 220 × 110 mm', width: 220, height: 110 }, C5: { label: 'C5 — 229 × 162 mm', width: 229, height: 162 }, C4: { label: 'C4 — 324 × 229 mm', width: 324, height: 229 } };
const input = 'mt-2 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-normal text-stone-900';

export function EnvelopePrint({ order }: { order?: Order }) {
  const { user } = useAuth();
  const recipient = order?.agreementTerms.deliveryRecipient === 'Owner' ? order.ownerDetails : order?.agreementTerms.deliveryRecipient === 'Tenant' ? order.tenantDetails : null;
  const [to, setTo] = useState<Address>(() => recipient ? { name: recipient.fullName, address: [recipient.address, recipient.pincode && !recipient.address.includes(recipient.pincode) ? recipient.pincode : ''].filter(Boolean).join('\n'), phone: recipient.phone } : empty);
  const [from, setFrom] = useState<Address>(empty), [size, setSize] = useState<keyof typeof sizes>('DL');
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [printing, setPrinting] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);
  const previewContainer = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(600);
  const [expanded, setExpanded] = useState(false);
  const frame = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => {
    let active = true;
    if (!user) return;
    setLoading(true); setError('');
    (async () => {
      try {
        const result = await readApiResponse(await fetch('/api/admin/envelope-sender', { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: 'no-store' }));
        if (active) setFrom(result.sender);
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load sender details.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [user, reload]);
  useEffect(() => () => { frame.current?.remove(); }, []);

  useEffect(() => {
    if (!previewContainer.current) return;
    const observer = new ResizeObserver(entries => { if (entries[0]?.contentRect.width) setPreviewWidth(entries[0].contentRect.width); });
    observer.observe(previewContainer.current);
    return () => observer.disconnect();
  }, [loading, expanded]);

  async function saveSender() {
    if (!user || saving) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const result = await readApiResponse(await fetch('/api/admin/envelope-sender', { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(from) }));
      setFrom(result.sender); setMessage('Default FROM address saved.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save sender details.'); }
    finally { setSaving(false); }
  }
  function printEnvelope() {
    setError(''); setMessage('');
    if (!to.name.trim() || !to.address.trim() || !from.name.trim() || !from.address.trim()) { setError('Enter the TO and FROM names and complete addresses before printing.'); return; }
    if (order && (order.payment.status !== 'Paid' || order.status === 'Cancelled' || order.replacedByOrderId)) { setError('Print envelopes from an active paid order.'); return; }
    setPrinting(true);
    frame.current?.remove();
    const iframe = document.createElement('iframe');
    frame.current = iframe;
    iframe.title = 'Envelope print layout';
    iframe.style.cssText = 'position:fixed;width:1px;height:1px;left:-10000px;top:0;border:0;';
    const dimensions = sizes[size];
    iframe.onload = async () => {
      try {
        const printWindow = iframe.contentWindow;
        if (!printWindow) throw new Error();
        await printWindow.document.fonts.ready;
        await Promise.all(Array.from(printWindow.document.images).map(image => image.decode()));
        if (!fitEnvelopeAddresses(printWindow.document)) {
          setPrinting(false); setError('The address is too long for this envelope. Shorten it or choose a larger envelope size.'); iframe.remove(); return;
        }
        printWindow.onafterprint = () => { iframe.remove(); setPrinting(false); };
        printWindow.focus(); printWindow.print(); setPrinting(false);
      } catch { setPrinting(false); setError('Unable to open printing. Please try again.'); iframe.remove(); }
    };
    iframe.srcdoc = envelopeHtml({ to, from, ...dimensions, assetBase: window.location.origin });
    document.body.appendChild(iframe);
  }
  return <details onToggle={event => setExpanded(event.currentTarget.open)} className="rounded-2xl border border-stone-200 bg-white p-4"><summary className="cursor-pointer text-sm font-bold text-stone-900">{order ? 'Print Envelope' : 'Envelope printing & default FROM address'}</summary><div className="mt-4 space-y-4">
    {loading ? <p role="status" className="text-sm">Loading sender details…</p> : <>
      <div className="grid gap-5 sm:grid-cols-2">{([{ label: 'TO', data: to, change: setTo }, { label: 'FROM', data: from, change: setFrom }] as const).map(({ label, data, change }) => <fieldset key={label} className="space-y-3"><legend className="mb-2 font-bold">{label}:</legend><label className="block text-sm font-semibold">Name<input maxLength={100} value={data.name} onChange={event => change(previous => ({ ...previous, name: event.target.value }))} className={input} /></label><label className="block text-sm font-semibold">Complete address, including PIN<textarea maxLength={1000} rows={4} value={data.address} onChange={event => change(previous => ({ ...previous, address: event.target.value }))} className={input} /></label><label className="block text-sm font-semibold">Phone (optional)<input type="tel" maxLength={30} value={data.phone} onChange={event => change(previous => ({ ...previous, phone: event.target.value }))} className={input} /></label></fieldset>)}</div>
      {order && <p className="text-sm text-stone-600">TO is prefilled from the selected delivery recipient. Changes here apply only to this envelope.</p>}
      <label className="block text-sm font-semibold">Envelope size<select value={size} onChange={event => setSize(event.target.value as keyof typeof sizes)} className={input}>{Object.entries(sizes).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
      <div ref={previewContainer} className="overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm" style={{ aspectRatio: `${sizes[size].width} / ${sizes[size].height}` }} aria-label="Envelope design preview">
        <iframe title="Branded envelope preview" srcDoc={envelopeHtml({ to, from, ...sizes[size] })} tabIndex={-1} onLoad={async event => {
          const document = event.currentTarget.contentDocument;
          if (document) { await document.fonts.ready; fitEnvelopeAddresses(document); }
        }} className="pointer-events-none origin-top-left border-0" style={{ width: sizes[size].width * 96 / 25.4, height: sizes[size].height * 96 / 25.4, transform: `scale(${previewWidth / (sizes[size].width * 96 / 25.4)})` }} />
      </div>
      <p className="text-sm text-stone-600">Select the matching envelope size in your printer settings and print at 100% scale.</p>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={saving || printing} onClick={printEnvelope} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Printer className="h-4 w-4" />{printing ? 'Opening print…' : 'Print Envelope'}</button><button type="button" disabled={saving} onClick={() => void saveSender()} className="min-h-11 rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">{saving ? 'Saving…' : 'Save FROM as default'}</button></div>
    </>}{message && <p role="status" className="text-sm text-emerald-800">{message}</p>}{error && <div role="alert" className="text-sm text-rose-700">{error}<button type="button" onClick={() => setReload(value => value + 1)} className="ml-2 font-semibold underline">Reload sender</button></div>}
  </div></details>;
}
