'use client';

import { requestReviewedCheckout } from '@/lib/checkout-client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, Clock3, RefreshCw } from 'lucide-react';
import type { User } from 'firebase/auth';
import { useAuth } from '@/lib/auth-context';

type PaymentResult = 'checking' | 'paid' | 'pending' | 'failed' | 'error';

async function requestPaymentStatus(user: User, orderId: string, merchantOrderId: string) {
  const idToken = await user.getIdToken();
  const response = await fetch('/api/payment/phonepe/status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ orderId, merchantOrderId: merchantOrderId || undefined }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not verify payment.');
  return data as { paid: boolean; state?: string; expireAt?: number; initiatedAt?: number };
}

function getPhonePeReconciliationOffsets(expireAt?: number, initiatedAt?: number) {
  const offsets = [22_000];
  for (let offset = 25_000; offset <= 52_000; offset += 3_000) offsets.push(offset);
  for (let offset = 58_000; offset <= 112_000; offset += 6_000) offsets.push(offset);
  for (let offset = 122_000; offset <= 172_000; offset += 10_000) offsets.push(offset);
  for (let offset = 202_000; offset <= 232_000; offset += 30_000) offsets.push(offset);

  const expiryOffset = expireAt && initiatedAt
    ? expireAt - initiatedAt
    : 1_200_000;
  for (let offset = 292_000; offset <= expiryOffset; offset += 60_000) offsets.push(offset);
  return offsets;
}

function PhonePeReturnContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId') ?? '';
  const merchantOrderId = searchParams.get('merchantOrderId') ?? '';
  const paymentStartedAtParam = Number(searchParams.get('paymentStartedAt'));
  const { user, loading } = useAuth();
  const [result, setResult] = useState<PaymentResult>('checking');
  const [message, setMessage] = useState('Verifying your payment.');
  const [startingCheckout, setStartingCheckout] = useState(false);

  async function checkPayment() {
    if (!user || !orderId) return;
    setResult('checking');
    try {
      const data = await requestPaymentStatus(user, orderId, merchantOrderId);
      if (data.paid) {
        setResult('paid');
        setMessage('Payment received. Your order is now under verification.');
      } else {
        setResult('pending');
        setMessage('Your payment has not been confirmed yet. You can check again shortly.');
      }
    } catch (error) {
      setResult('error');
      setMessage(error instanceof Error ? error.message : 'Unable to check payment status.');
    }
  }

  async function restartCheckout() {
    if (!user || !orderId) return;
    setStartingCheckout(true);
    try {
      const idToken = await user.getIdToken();
      const response = await requestReviewedCheckout({ orderId }, idToken);
      const data = await response.json();
      if (response.ok && data.paid) {
        setResult('paid');
        setMessage('Payment received. Your order is now under verification.');
        setStartingCheckout(false);
        return;
      }
      if (!response.ok || !data.available || !data.redirectUrl) {
        throw new Error(data.error || 'Unable to restart secure checkout.');
      }
      window.location.assign(data.redirectUrl);
    } catch (error) {
      setResult('error');
      setMessage(error instanceof Error ? error.message : 'Unable to restart secure checkout.');
      setStartingCheckout(false);
    }
  }

  useEffect(() => {
    if (loading || !user || !orderId) return;
    const authenticatedUser = user;
    let isCurrent = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const requestedInitiatedAt = Number.isSafeInteger(paymentStartedAtParam) && paymentStartedAtParam > 0
      ? paymentStartedAtParam
      : Date.now();

    async function reconcilePayment() {
      if (!isCurrent) return;
      try {
        const data = await requestPaymentStatus(authenticatedUser, orderId, merchantOrderId);
        if (!isCurrent) return;
        const initiatedAt = data.initiatedAt ?? requestedInitiatedAt;
        if (data.paid) {
          setResult('paid');
          setMessage('Payment received. Your order is now under verification.');
          return;
        }
        if (data.state === 'FAILED' || data.state === 'EXPIRED') {
          setResult('failed');
          setMessage('This payment failed. You can safely try checkout again.');
          return;
        }

        setResult('pending');
        setMessage('Your payment has not been confirmed yet. We are checking its status.');
        const elapsed = Date.now() - initiatedAt;
        const nextOffset = getPhonePeReconciliationOffsets(data.expireAt, initiatedAt)
          .find((offset) => offset > elapsed);
        if (nextOffset !== undefined) {
          timer = setTimeout(reconcilePayment, Math.max(0, nextOffset - elapsed));
        }
      } catch (error) {
        if (!isCurrent) return;
        setResult('error');
        setMessage(error instanceof Error ? error.message : 'Unable to check payment status.');
        const elapsed = Date.now() - requestedInitiatedAt;
        const nextOffset = getPhonePeReconciliationOffsets(undefined, requestedInitiatedAt)
          .find((offset) => offset > elapsed);
        if (nextOffset !== undefined) {
          timer = setTimeout(reconcilePayment, Math.max(0, nextOffset - elapsed));
        }
      }
    }

    const firstCheckDelay = Math.max(0, requestedInitiatedAt + 22_000 - Date.now());
    timer = setTimeout(reconcilePayment, firstCheckDelay);
    return () => {
      isCurrent = false;
      if (timer) clearTimeout(timer);
    };
  }, [loading, user, orderId, merchantOrderId, paymentStartedAtParam]);

  const displayResult = loading ? 'checking' : !user || !orderId ? 'error' : result;
  const displayMessage = !loading && !user
    ? 'Sign in with the account used to place this order to verify payment.'
    : !loading && !orderId
      ? 'The order reference is missing from this payment return.'
      : message;
  const Icon = displayResult === 'paid' ? CheckCircle2 : displayResult === 'pending' || displayResult === 'checking' ? Clock3 : AlertCircle;
  const iconColor = displayResult === 'paid' ? 'text-emerald-700 bg-emerald-100' : displayResult === 'error' || displayResult === 'failed' ? 'text-rose-700 bg-rose-100' : 'text-amber-700 bg-amber-100';

  return (
    <main className="max-w-xl mx-auto px-4 py-16 text-center">
      <div className="border border-stone-200 bg-white p-8 sm:p-10 rounded-2xl shadow-sm space-y-5">
        <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center ${iconColor}`}>
          <Icon className={`w-7 h-7 ${result === 'checking' ? 'animate-pulse' : ''}`} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-stone-900">{displayResult === 'paid' ? 'Payment Confirmed' : displayResult === 'failed' ? 'Payment Failed' : displayResult === 'checking' ? 'Checking Payment' : 'Payment Status'}</h1>
          <p className="text-sm text-stone-600">{displayMessage}</p>
          {orderId && <p className="text-xs text-stone-500 font-mono">Order reference: {orderId}</p>}
        </div>
        {displayResult === 'pending' || displayResult === 'failed' || displayResult === 'error' ? (
          <div className="flex flex-wrap justify-center gap-3">
            {(displayResult === 'pending' || displayResult === 'failed') && (
              <button type="button" onClick={() => void restartCheckout()} disabled={!user || startingCheckout} className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-stone-950 rounded-lg text-sm font-semibold disabled:opacity-50">
                <RefreshCw className="w-4 h-4" />
                {startingCheckout ? 'Opening secure checkout...' : 'Retry payment'}
              </button>
            )}
            <button type="button" onClick={() => void checkPayment()} disabled={!user || startingCheckout} className="inline-flex items-center gap-2 px-4 py-2.5 bg-stone-900 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
              <RefreshCw className="w-4 h-4" />
              Check payment again
            </button>
          </div>
        ) : null}
        <div>
          <Link href="/my-orders" className="text-sm font-semibold text-amber-800 underline underline-offset-2">Go to My Orders</Link>
        </div>
      </div>
    </main>
  );
}

export default function PhonePeReturnPage() {
  return (
    <Suspense fallback={<main className="max-w-xl mx-auto px-4 py-16 text-center text-sm text-stone-600">Loading payment status...</main>}>
      <PhonePeReturnContent />
    </Suspense>
  );
}
