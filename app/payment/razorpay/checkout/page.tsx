'use client';

import Script from 'next/script';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { readApiResponse } from '@/lib/api-response';

interface RazorpayInstance { open: () => void; on: (event: 'payment.failed', callback: () => void) => void; }
interface RazorpayConstructor { new(options: Record<string, unknown>): RazorpayInstance; }

function Checkout() {
  const params = useSearchParams(), attempt = params.get('attempt') || '';
  const { user, loading, signIn } = useAuth();
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  async function request(action: string, fields = {}) {
    if (!user) throw new Error('Sign in with the account used for this order.');
    return readApiResponse(await fetch('/api/payment/razorpay/checkout', { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fields, attempt, action }) }));
  }
  async function verify(fields?: Record<string, unknown>) {
    setBusy(true); setError('');
    try {
      const result = await request(fields ? 'verify' : 'status', fields);
      if (result.paid) window.location.assign(result.returnUrl);
      else setMessage('Payment is not confirmed yet. Check again shortly or resume the same checkout.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not verify payment.'); }
    finally { setBusy(false); }
  }
  return <div className="mx-auto max-w-xl space-y-5 px-4 py-12">
    <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" onReady={() => setReady(true)} onError={() => setError('Could not load secure checkout. Refresh this page to retry.')} />
    <div className="space-y-5 rounded-2xl border border-stone-200 bg-white p-6">
      <h1 className="text-2xl font-bold">Secure payment with Razorpay</h1>
      <p className="text-sm text-stone-600">Complete payment or check an existing payment below. Your order is confirmed after payment verification.</p>
      {loading ? <p role="status">Checking your account…</p> : !user ? <button onClick={async () => { try { await signIn(); } catch { setError('Sign in was not completed. Please try again.'); } }} className="min-h-11 rounded-xl bg-brand-700 px-5 py-3 text-white">Sign in to continue</button> : <div className="flex flex-wrap gap-3">
        <button disabled={!ready || busy || !attempt} onClick={async () => {
          setBusy(true); setError(''); setMessage('');
          try {
            const options = await request('options');
            if (options.paid) { window.location.assign(options.returnUrl); return; }
            const Razorpay = (window as unknown as { Razorpay: RazorpayConstructor }).Razorpay;
            const checkout = new Razorpay({ key: options.key, order_id: options.razorpayOrderId, amount: options.amount, currency: options.currency, name: 'AgreementPrint', description: 'Agreement order', handler: (fields: Record<string, unknown>) => void verify(fields), modal: { ondismiss: () => { setBusy(false); setMessage('Checkout closed. You can resume or check your payment status.'); } } });
            checkout.on('payment.failed', () => {
              setBusy(false);
              setMessage('');
              setError('Payment was not completed. You can retry in the checkout window or close it and check payment status.');
            });
            checkout.open();
          } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not open checkout.'); setBusy(false); }
        }} className="min-h-11 rounded-xl bg-brand-700 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Processing…' : 'Continue to payment'}</button>
        <button disabled={busy || !attempt} onClick={() => void verify()} className="min-h-11 rounded-xl border border-stone-300 px-5 py-3 font-semibold disabled:opacity-50">Check payment status</button>
      </div>}
      {message && <p role="status" className="text-sm text-stone-700">{message}</p>}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    </div>
  </div>;
}

export default function RazorpayCheckoutPage() {
  return <Suspense fallback={<p role="status" className="p-6">Loading secure checkout…</p>}><Checkout /></Suspense>;
}
