'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
export default function PaymentTestPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const [config, setConfig] = useState<{ configured: boolean; live: boolean } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [state, setState] = useState('');
  const [reference, setReference] = useState('');
  useEffect(() => { fetch('/api/payment/phonepe/test-product').then(r => r.json()).then(setConfig).catch(() => setError('Could not load payment configuration.')); setReference(new URLSearchParams(window.location.search).get('merchantOrderId') || ''); }, []);
  async function action(action: 'start' | 'status') {
    if (!user) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/payment/phonepe/test-product', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ action, ...(action === 'status' && reference ? { merchantOrderId: reference } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setReference(data.merchantOrderId); setState(data.state);
      if (action === 'start' && data.redirectUrl && !data.paid) window.location.assign(data.redirectUrl);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to check payment.'); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-xl px-4 py-12"><section className="space-y-5 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
    <p className="text-sm font-semibold text-brand-700">PhonePe payment test</p><h1 className="text-2xl font-bold">Test Product</h1><p className="text-4xl font-bold text-stone-900">₹1</p>
    <p className="text-sm text-stone-600">A dummy product to check payment checkout and confirmation. No agreement or physical product will be delivered.</p>
    {config && <p className={`rounded-xl border p-3 text-sm font-semibold ${config.live ? 'border-yellow-300 bg-yellow-50 text-yellow-900' : 'border-blue-200 bg-blue-50 text-blue-800'}`}>{config.live ? 'Live mode: this will charge Rs.1 through PhonePe.' : 'Sandbox mode: this does not test a real live payment.'}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {state && <p role="status" className={`rounded-xl border p-3 font-semibold ${state === 'COMPLETED' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : ['FAILED', 'EXPIRED'].includes(state) ? 'border-red-200 bg-red-50 text-red-800' : 'border-yellow-300 bg-yellow-50 text-yellow-900'}`}>{state === 'COMPLETED' ? 'Payment confirmed: Rs.1 received.' : `Payment status: ${state}`}</p>}
    {reference && <p className="break-all text-xs text-stone-600">Payment reference: {reference}</p>}
    {loading ? <p>Checking sign-in...</p> : !user ? <button onClick={() => void signInWithGoogle().catch(e => setError(e.message))} className="min-h-11 rounded-xl bg-brand-700 px-5 py-3 font-semibold text-white">Sign in to test payment</button> : <div className="flex flex-wrap gap-3"><button disabled={busy || !config?.configured || state === 'COMPLETED'} onClick={() => void action('start')} className="min-h-11 rounded-xl bg-brand-700 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Please wait...' : 'Pay Rs.1 with PhonePe'}</button><button disabled={busy} onClick={() => void action('status')} className="min-h-11 rounded-xl border border-stone-300 px-5 py-3 font-semibold disabled:opacity-50">Check payment status</button></div>}
    {config && !config.configured && <p className="text-sm text-red-800">PhonePe credentials are not configured.</p>}
  </section></main>;
}
