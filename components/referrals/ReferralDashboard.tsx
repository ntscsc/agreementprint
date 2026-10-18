'use client';

import { readApiResponse } from '@/lib/api-response';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Gift, LogIn, Share2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface ReferralData {
  code: string;
  balance: number;
  rewardAmount: number;
  couponDiscount: number;
  referrals: Array<{
    status: string;
    rewardAmount: number;
    createdAt: string;
  }>;
  ledger: Array<{
    type: string;
    amount: number;
    orderId: string;
    createdAt: string;
  }>;
}

export function ReferralDashboard() {
  const { user } = useAuth();
  return <ReferralDashboardBody key={user?.uid ?? 'guest'} />;
}

function ReferralDashboardBody() {
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      setError(null);
      setLoading(true);
      const response = await fetch('/api/referrals/me', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(result.error || 'Could not load your referral details.');
      setData(result as ReferralData);
    } catch (loadError) {
      console.error('Referral dashboard load failed:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Could not load your referral details.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  async function copyReferralLink() {
    if (!data) return;
    const link = `${window.location.origin}/order?coupon=${encodeURIComponent(data.code)}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch (copyError) {
      console.error('Could not copy referral link:', copyError);
      setError('Could not copy automatically. Select and copy the referral link instead.');
    }
  }

  if (authLoading) {
    return <p className="py-16 text-center text-sm text-stone-500">Checking your account…</p>;
  }

  if (!user) {
    return (
      <section className="mx-auto max-w-md rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <LogIn className="mx-auto h-8 w-8 text-amber-600" />
        <h1 className="mt-4 text-2xl font-black text-stone-900">Refer a friend</h1>
        <p className="mt-2 text-sm text-stone-600">Sign in to get your personal coupon code and view your credit balance.</p>
        <button
          type="button"
          onClick={() => void signInWithGoogle().catch((signInError) => {
            console.error('Referral page sign-in failed:', signInError);
            setError('Could not sign in. Please try again.');
          })}
          className="mt-6 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-stone-950"
        >
          Sign in with Google
        </button>
        {error && <p className="mt-3 text-sm text-rose-700" role="alert">{error}</p>}
      </section>
    );
  }

  return (
    <div className="space-y-7">
      <header className="text-center">
        <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-900">
          Customer rewards
        </span>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-stone-900">Refer a friend, earn credits</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-stone-600">
          Share your code. When a new customer uses it on their first paid order, you earn ₹
          {data?.rewardAmount.toLocaleString('en-IN') ?? '—'} in AgreementPrint credit.
          {data && data.couponDiscount > 0 && <> Your friend also gets ₹{data.couponDiscount.toLocaleString('en-IN')} off that first order.</>}
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">
          {error}
        </div>
      )}

      {loading && !data ? (
        <p className="py-10 text-center text-sm text-stone-500">Loading your referral details…</p>
      ) : data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2" aria-label="Referral benefits">
            <div className="rounded-2xl border border-stone-200 bg-white p-5"><h2 className="text-sm font-semibold text-stone-600">You earn</h2><p className="mt-2 text-2xl font-bold text-stone-900">₹{data.rewardAmount.toLocaleString('en-IN')} credit</p><p className="mt-2 text-sm text-stone-600">After your friend pays for their first order. Use the credit on a future order.</p></div>
            <div className="rounded-2xl border border-stone-200 bg-white p-5"><h2 className="text-sm font-semibold text-stone-600">Your friend saves</h2><p className="mt-2 text-2xl font-bold text-stone-900">₹{data.couponDiscount.toLocaleString('en-IN')}</p><p className="mt-2 text-sm text-stone-600">Taken off their first order when using your coupon, up to the order total.</p></div>
          </section>
          <section className="rounded-2xl bg-stone-900 p-6 text-white"><h2 className="text-sm font-semibold text-stone-300">Available credits for orders</h2><p className="mt-2 text-3xl font-bold">Rs.{data.balance.toLocaleString('en-IN')}</p><p className="mt-2 text-sm text-stone-300">Referral rewards can be used for orders. Order cancellation refunds return to the original payment method.</p></section>
          <section>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Your coupon code</p>
              <p className="mt-2 font-mono text-3xl font-black tracking-[0.15em] text-stone-900">{data.code}</p>
              <label className="mt-4 block text-xs font-semibold text-stone-700">Your share link<input readOnly value={typeof window === 'undefined' ? '' : `${window.location.origin}/order?coupon=${encodeURIComponent(data.code)}`} onFocus={event => event.target.select()} className="mt-2 min-h-11 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-normal" /></label>
              <button
                type="button"
                onClick={() => void copyReferralLink()}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-stone-950 hover:bg-amber-400"
              >
                {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                {copied ? 'Referral link copied' : 'Copy share link'}
                {!copied && <Copy className="h-4 w-4" />}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-bold text-stone-900">Referral activity</h2>
            </div>
            {data.referrals.length === 0 ? (
              <p className="mt-4 text-sm text-stone-600">No referrals yet. Share your code to get started.</p>
            ) : (
              <ul className="mt-4 divide-y divide-stone-100">
                {data.referrals.map((referral, index) => (
                  <li key={`${referral.createdAt}-${index}`} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium text-stone-800">Referral #{data.referrals.length - index}</span>
                    <span className={referral.status === 'Rewarded' ? 'font-semibold text-emerald-700' : 'text-stone-600'}>
                      {referral.status}
                      {referral.rewardAmount > 0 && ` · ₹${referral.rewardAmount.toLocaleString('en-IN')} earned`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-lg font-bold text-stone-900">Credit history</h2>
            {data.ledger.length === 0 ? (
              <p className="mt-4 text-sm text-stone-600">Your credits and redemptions will appear here.</p>
            ) : (
              <ul className="mt-4 divide-y divide-stone-100">
                {data.ledger.map((entry, index) => (
                  <li key={`${entry.orderId}-${entry.type}-${index}`} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span className="capitalize text-stone-700">{entry.type === 'refund_completed' ? 'Refund confirmed' : entry.type === 'redeem' ? 'Used on order' : entry.type.replaceAll('_', ' ')}</span>
                    <span className={`font-mono font-semibold ${['reward', 'release', 'replacement_credit', 'refund_release', 'cancellation_credit', 'cancellation_reward_return'].includes(entry.type) ? 'text-emerald-700' : 'text-stone-800'}`}>
                      {['refund_completed', 'redeem'].includes(entry.type) ? '' : ['reward', 'release', 'replacement_credit', 'refund_release', 'cancellation_credit', 'cancellation_reward_return'].includes(entry.type) ? '+' : '−'}₹{Number(entry.amount).toLocaleString('en-IN')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <button type="button" onClick={() => void loadData()} className="mx-auto block text-sm font-semibold text-amber-800 hover:text-amber-950">
            Refresh referral details
          </button>
        </>
      ) : null}
    </div>
  );
}
