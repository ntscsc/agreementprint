'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { readApiResponse } from '@/lib/api-response';

interface Review { id: string; name: string; rating: number; comment: string; publishedAt: string; }
export function CustomerReviews({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  return <CustomerReviewsBody key={`${user?.uid ?? 'guest'}-${compact}`} compact={compact} />;
}

function CustomerReviewsBody({ compact }: { compact: boolean }) {
  const { user, signIn, editContactDetails } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]), [loading, setLoading] = useState(true), [listError, setListError] = useState('');
  const [summary, setSummary] = useState({ count: 0, totalStars: 0, average: 0 });
  const ratingDescriptions = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
  const [rating, setRating] = useState(5), [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false), [ownLoading, setOwnLoading] = useState(() => Boolean(user) && !compact), [ownStatus, setOwnStatus] = useState(''), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    fetch('/api/customer-reviews', { cache: 'no-store' }).then(readApiResponse).then(result => { if (active) { setReviews(result.reviews); setSummary(result.summary); setListError(''); } }).catch(() => { if (active) setListError('Reviews could not be loaded. Please try again later.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  useEffect(() => {
    let active = true;
    if (!user || compact) return;
    (async () => {
      try {
        const result = await readApiResponse(await fetch('/api/customer-reviews?scope=mine', { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: 'no-store' }));
        if (active && result.review) { setRating(result.review.rating); setComment(result.review.comment); setOwnStatus(result.review.status); }
      } catch { if (active) setError('Could not load your previous feedback. Please refresh before submitting.'); }
      finally { if (active) setOwnLoading(false); }
    })();
    return () => { active = false; };
  }, [user, compact]);
  return <section className="space-y-6" aria-label="Customer reviews">
    {!loading && !listError && summary.count > 0 && <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5" aria-label={`Overall customer rating ${summary.average.toFixed(1)} out of 5 from ${summary.count} reviews`}>
      <span className="text-3xl font-bold text-stone-900">{summary.average.toFixed(1)}<span className="text-base font-medium text-stone-600"> / 5</span></span>
      <div><div className="flex gap-1 text-amber-600" aria-hidden="true">{[1, 2, 3, 4, 5].map(star => <span key={star} className="relative h-5 w-5"><Star className="absolute h-5 w-5 text-stone-300" /><span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${Math.min(1, Math.max(0, summary.average - star + 1)) * 100}%` }}><Star className="h-5 w-5 fill-current" /></span></span>)}</div><p className="mt-1 text-sm text-stone-700">{summary.count.toLocaleString('en-IN')} customer {summary.count === 1 ? 'review' : 'reviews'} · {summary.totalStars.toLocaleString('en-IN')} stars received</p></div>
    </div>}
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-bold text-stone-900">Customer reviews</h2><p className="mt-2 text-sm text-stone-600">Experiences shared by our customers.</p></div>{compact && <Link href="/reviews" className="inline-flex min-h-11 items-center rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white">Read customer reviews</Link>}</div>
    {loading ? <p role="status" className="text-sm text-stone-600">Loading reviews…</p> : listError ? <p role="alert" className="text-sm text-rose-700">{listError}</p> : reviews.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{reviews.slice(0, compact ? 6 : 50).map(review => <article key={review.id} className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5"><div className="flex items-center gap-1 text-amber-700" aria-label={`${review.rating} out of 5 stars`}>{[1, 2, 3, 4, 5].map(star => <Star key={star} aria-hidden="true" className={`h-4 w-4 ${star <= review.rating ? 'fill-current' : 'text-stone-300'}`} />)}</div><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-700">{review.comment}</p><p className="text-sm font-semibold text-stone-900">{review.name}</p><p className="text-sm text-stone-600">{new Date(review.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p></article>)}</div> : <p className="rounded-2xl border border-dashed border-brand-300 bg-brand-50 p-6 text-sm leading-relaxed text-brand-900">Be the first to share your experience. Your feedback helps other customers choose their agreement service.</p>}
    {!compact && <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6"><h2 className="text-xl font-bold">Share your experience</h2>{!user ? <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await signIn(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Please try signing in again.'); } finally { setBusy(false); } }} className="mt-4 min-h-11 rounded-xl bg-brand-700 px-4 py-2 font-semibold text-white">Sign in to leave feedback</button> : ownLoading ? <p className="mt-4 text-sm" role="status">Loading your feedback…</p> : <form className="mt-5 space-y-4" onSubmit={async event => {
      event.preventDefault(); if (busy) return; setBusy(true); setError(''); setMessage('');
      try {
        const response = await fetch('/api/customer-reviews', { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ rating, comment }) });
        if (response.status === 409) {
          const result = await response.clone().json().catch(() => null);
          if (result?.code === 'CUSTOMER_PROFILE_REQUIRED') {
            editContactDetails();
            setMessage('Your feedback is kept here. Save your contact details, then submit again.');
            return;
          }
        }
        await readApiResponse(response);
        setOwnStatus('Published'); setMessage('Thank you. Your review is now published.'); setRevision(value => value + 1);
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to submit feedback. Please try again.'); }
      finally { setBusy(false); }
    }}>
      {ownStatus && <p className="text-sm font-semibold text-stone-700">Your feedback: {['Published', 'Approved'].includes(ownStatus) ? 'Published' : 'Not published'}</p>}
      <fieldset disabled={busy} className="space-y-4"><legend className="mb-2 text-sm font-semibold">Your rating</legend><div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Rating">{[1, 2, 3, 4, 5].map(star => <label key={star} className="cursor-pointer"><input type="radio" name="review-rating" value={star} checked={rating === star} onChange={() => setRating(star)} className="peer sr-only" aria-label={`${star} stars`} /><span className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-stone-300 bg-white peer-checked:border-amber-600 peer-checked:bg-amber-100 peer-checked:ring-2 peer-checked:ring-amber-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-700"><Star aria-hidden="true" className={`h-6 w-6 ${star <= rating ? 'fill-amber-500 text-amber-600' : 'text-stone-400'}`} /></span></label>)}</div>
      <p className="text-sm font-semibold text-amber-900" aria-live="polite">{rating} - {ratingDescriptions[rating - 1]}</p>
      <label className="block text-sm font-semibold">Your review<textarea required minLength={10} maxLength={2000} rows={4} value={comment} onChange={event => setComment(event.target.value)} className="mt-2 w-full rounded-xl border border-stone-300 p-3 font-normal" /></label>
      <p className="text-sm text-stone-600">Please leave out phone numbers, addresses and agreement details.</p>
      <button disabled={busy} className="min-h-11 rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Submitting…' : ownStatus ? 'Update feedback' : 'Submit feedback'}</button></fieldset>
    </form>}{message && <p role="status" className="mt-4 text-sm text-emerald-800">{message}</p>}{error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}</div>}
    {compact && reviews.length > 6 && <Link href="/reviews" className="inline-block text-sm font-semibold text-brand-700 underline">See all reviews</Link>}
  </section>;
}
