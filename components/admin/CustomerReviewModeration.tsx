'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { readApiResponse } from '@/lib/api-response';

interface Review { id: string; name: string; rating: number; comment: string; publicConsent: boolean; status: string; updatedAt: string; }
export function CustomerReviewModeration() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError('');
    try {
      const result = await readApiResponse(await fetch('/api/customer-reviews?scope=admin', { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: 'no-store' }));
      setReviews(result.reviews);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load feedback.'); }
    finally { setLoading(false); }
  }, [user]);
  useEffect(() => { void load(); }, [load]);
  async function moderate(review: Review, action: 'publish' | 'hide') {
    if (!user || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await readApiResponse(await fetch('/api/customer-reviews', { method: 'PATCH', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: review.id, updatedAt: review.updatedAt, action }) }));
      setNotice(action === 'publish' ? 'Review published.' : 'Review hidden from public display.');
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update this review.'); }
    finally { setBusy(false); }
  }
  return <details className="rounded-2xl border border-stone-200 bg-white p-5"><summary className="cursor-pointer font-bold">Customer feedback &amp; reviews ({reviews.filter(review => ['Published', 'Approved'].includes(review.status)).length} published)</summary><div className="mt-4 space-y-4"><button type="button" disabled={busy || loading} onClick={() => void load()} className="min-h-11 text-sm font-semibold underline disabled:opacity-50">Refresh feedback</button><p className="text-sm text-stone-600">Latest 100 submissions. New reviews publish automatically; hide a review when needed.</p>{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}{notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}{loading ? <p role="status" className="text-sm">Loading feedback…</p> : !reviews.length ? <p className="text-sm text-stone-600">No customer feedback yet.</p> : reviews.map(review => <article key={review.id} className="space-y-3 rounded-xl border border-stone-200 p-4"><div className="flex flex-wrap justify-between gap-2"><h4 className="font-semibold">{review.name} · {review.rating}/5 stars</h4><span className="text-sm font-semibold text-stone-600">{review.status === 'Private' ? 'Private feedback' : review.status}</span></div><p className="whitespace-pre-wrap break-words text-sm text-stone-700">{review.comment}</p><p className="text-sm text-stone-600">Updated {new Date(review.updatedAt).toLocaleDateString('en-IN')}</p>{review.publicConsent ? <div className="flex flex-wrap gap-2">{!['Published', 'Approved'].includes(review.status) && <button type="button" disabled={busy} onClick={() => void moderate(review, 'publish')} className="min-h-11 rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Show Review</button>}{review.status !== 'Hidden' && <button type="button" disabled={busy} onClick={() => void moderate(review, 'hide')} className="min-h-11 rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Hide Review</button>}</div> : <p className="text-sm text-stone-600">Customer requested private feedback. Publication is disabled.</p>}</article>)}</div></details>;
}
