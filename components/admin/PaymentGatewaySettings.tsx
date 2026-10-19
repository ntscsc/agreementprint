'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { readApiResponse } from '@/lib/api-response';

export function PaymentGatewaySettings() {
  const { user } = useAuth();
  const [active, setActive] = useState('PhonePe'), [selected, setSelected] = useState('PhonePe');
  const [configured, setConfigured] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    if (!user) return;
    (async () => {
      try {
        const result = await readApiResponse(await fetch('/api/admin/payment-gateway', { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: 'no-store' }));
        if (current) { setActive(result.activeGateway); setSelected(result.activeGateway); setConfigured(result.configured); setError(''); }
      } catch (reason) { if (current) setError(reason instanceof Error ? reason.message : 'Could not load payment settings.'); }
      finally { if (current) setLoading(false); }
    })();
    return () => { current = false; };
  }, [user, revision]);
  return <section className="space-y-5 rounded-2xl border border-stone-200 bg-white p-6">
    <h2 className="text-2xl font-bold text-stone-900">Payment gateway</h2>
    <p className="text-sm leading-relaxed text-stone-600">Choose the gateway for new payments. Existing checkouts and refunds continue with their original provider.</p>
    {loading ? <p role="status">Loading payment settings…</p> : <form className="space-y-4" onSubmit={async event => {
      event.preventDefault(); if (!user || busy) return; setBusy(true); setError(''); setMessage('');
      try {
        const result = await readApiResponse(await fetch('/api/admin/payment-gateway', { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ activeGateway: selected, previousGateway: active }) }));
        setActive(result.activeGateway); setMessage(`${result.activeGateway} is now active for new payments.`);
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save payment settings.'); }
      finally { setBusy(false); }
    }}>
      <p className="text-sm font-semibold">Current gateway: {active}</p>
      <label className="block text-sm font-semibold">Gateway<select value={selected} disabled={busy} onChange={event => setSelected(event.target.value)} className="mt-2 block min-h-11 w-full max-w-sm rounded-xl border border-stone-300 px-3 py-2">{['PhonePe', 'Razorpay'].map(gateway => <option key={gateway} value={gateway} disabled={!configured[gateway]}>{gateway}{configured[gateway] ? '' : ' — not configured'}</option>)}</select></label>
      <p className="text-sm text-stone-600">Server configuration: PhonePe {configured.PhonePe ? 'ready' : 'missing'}; Razorpay {configured.Razorpay ? 'ready' : 'missing'}. API secrets are managed in the hosting environment.</p>
      <button disabled={busy || selected === active || !configured[selected]} className="min-h-11 rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save gateway'}</button>
    </form>}
    {error && <div role="alert" className="text-sm text-rose-700">{error}<button type="button" disabled={busy || loading} onClick={() => { setLoading(true); setRevision(value => value + 1); }} className="ml-3 font-semibold underline">Reload settings</button></div>}
    {message && <p role="status" className="text-sm text-emerald-800">{message}</p>}
  </section>;
}
