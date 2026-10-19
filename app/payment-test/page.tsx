'use client';

import { readApiResponse } from '@/lib/api-response';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
export default function PaymentTestPage() {
  const { user } = useAuth();
  return <PaymentTestGateways key={user?.uid ?? 'guest'} />;
}
type Gateway = 'PhonePe' | 'Razorpay';
function PaymentTestGateways() {
  const [gateway, setGateway] = useState<Gateway>('PhonePe');
  useEffect(() => { if (new URLSearchParams(window.location.search).get('gateway') === 'Razorpay') setGateway('Razorpay'); }, []);
  function selectGateway(selected: Gateway) {
    const url = new URL(window.location.href);
    url.searchParams.set('gateway', selected);
    url.searchParams.delete('merchantOrderId');
    window.history.replaceState(null, '', url);
    setGateway(selected);
  }
  return <PaymentTestBody key={gateway} gateway={gateway} onGatewayChange={selectGateway} />;
}
function PaymentTestBody({ gateway, onGatewayChange }: { gateway: Gateway; onGatewayChange: (gateway: Gateway) => void }) {
  const { user, loading, signInWithGoogle } = useAuth();
  const [config, setConfig] = useState<{ configured: boolean; live: boolean } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [state, setState] = useState('');
  const [reference, setReference] = useState('');
  const [paymentLive, setPaymentLive] = useState<boolean | null>(null);
  const endpoint = `/api/payment/${gateway === 'Razorpay' ? 'razorpay' : 'phonepe'}/test-product`;
  useEffect(() => {
    let active = true;
    fetch(endpoint, { cache: 'no-store' }).then(readApiResponse).then(data => { if (active) setConfig({ configured: data.configured === true, live: data.live === true }); }).catch(() => { if (active) setError('Could not load payment configuration.'); });
    const params = new URLSearchParams(window.location.search);
    if ((params.get('gateway') || 'PhonePe') === gateway) setReference(params.get('merchantOrderId') || '');
    return () => { active = false; };
  }, [endpoint, gateway]);
  async function action(action: 'start' | 'status') {
    if (!user) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ action, ...(action === 'status' && reference ? { merchantOrderId: reference } : {}) }) });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error);
      setReference(data.merchantOrderId); setState(data.state);
      if (typeof data.live === 'boolean') setPaymentLive(data.live);
      if (action === 'start' && data.redirectUrl && !data.paid) window.location.assign(data.redirectUrl);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to check payment.'); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-xl px-4 py-12"><section className="space-y-5 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
    <p className="text-sm font-semibold text-brand-700">Payment gateway test</p><h1 className="text-2xl font-bold">Test Product</h1><label className="block text-sm font-semibold">Payment gateway<select value={gateway} disabled={busy} onChange={event => onGatewayChange(event.target.value as Gateway)} className="mt-2 block min-h-11 w-full rounded-xl border border-stone-300 px-3 py-2"><option value="PhonePe">PhonePe</option><option value="Razorpay">Razorpay</option></select></label><p className="text-4xl font-bold text-stone-900">₹1</p>
    <p className="text-sm text-stone-600">A dummy product to check payment checkout and confirmation. No agreement or physical product will be delivered.</p>
    {config && <p className={`rounded-xl border p-3 text-sm font-semibold ${config.live ? 'border-yellow-300 bg-yellow-50 text-yellow-900' : 'border-blue-200 bg-blue-50 text-blue-800'}`}>{config.live ? `Live mode: this will charge Rs.1 through ${gateway}.` : 'Sandbox mode: this does not test a real live payment.'}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {state && <p role="status" className={`rounded-xl border p-3 font-semibold ${state === 'COMPLETED' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : ['FAILED', 'EXPIRED'].includes(state) ? 'border-red-200 bg-red-50 text-red-800' : 'border-yellow-300 bg-yellow-50 text-yellow-900'}`}>{state === 'COMPLETED' ? (paymentLive ?? config?.live ? 'Payment confirmed: Rs.1 received.' : 'Test payment confirmed. No real money was charged.') : `Payment status: ${state}`}</p>}
    {reference && <p className="break-all text-xs text-stone-600">Payment reference: {reference}</p>}
    {loading ? <p>Checking sign-in...</p> : !user ? <button onClick={() => void signInWithGoogle().catch(e => setError(e.message))} className="min-h-11 rounded-xl bg-brand-700 px-5 py-3 font-semibold text-white">Sign in to test payment</button> : <div className="flex flex-wrap gap-3"><button disabled={busy || !config?.configured || state === 'COMPLETED'} onClick={() => void action('start')} className="min-h-11 rounded-xl bg-brand-700 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Please wait...' : config?.live ? `Pay Rs.1 with ${gateway}` : `Test Rs.1 with ${gateway}`}</button><button disabled={busy} onClick={() => void action('status')} className="min-h-11 rounded-xl border border-stone-300 px-5 py-3 font-semibold disabled:opacity-50">Check payment status</button></div>}
    {config && !config.configured && <p className="text-sm text-red-800">{gateway} credentials are not configured.</p>}
  </section></main>;
}
