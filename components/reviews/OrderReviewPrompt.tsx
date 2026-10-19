'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const shownThisVisit = new Set<string>();

export function OrderReviewPrompt({ orderId }: { orderId: string }) {
  const { user } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const uid = user?.uid;

  useEffect(() => {
    if (!uid || !orderId) return;
    const element = dialog.current;
    const key = `agreementprint:review-prompt:${uid}:${orderId}`;
    let timer: ReturnType<typeof setTimeout>;
    function showPrompt() {
      if (shownThisVisit.has(key)) return;
      try { if (localStorage.getItem(key)) return; } catch { /* Use the in-memory fallback. */ }
      // Let contact details and other active dialogs finish first.
      if (document.querySelector('dialog[open]') || document.visibilityState === 'hidden') {
        timer = setTimeout(showPrompt, 1000);
        return;
      }
      if (!element) return;
      element.showModal();
      shownThisVisit.add(key);
      try { localStorage.setItem(key, 'shown'); } catch { /* Feedback remains optional without storage. */ }
    }
    timer = setTimeout(showPrompt, 6500);
    return () => { clearTimeout(timer); element?.close(); };
  }, [uid, orderId]);

  return <dialog ref={dialog} aria-labelledby="order-review-title" aria-describedby="order-review-description" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-stone-200 bg-white p-6 text-stone-900 shadow-xl backdrop:bg-stone-950/60">
    <Star aria-hidden="true" className="h-8 w-8 text-amber-600" />
    <h2 id="order-review-title" className="mt-4 text-xl font-bold">How was your ordering experience?</h2>
    <p id="order-review-description" className="mt-3 text-sm leading-relaxed text-stone-600">Thank you for placing your order. Share your experience using AgreementPrint to help us improve.</p>
    <div className="mt-6 flex flex-wrap gap-3">
      <Link href="/reviews" onClick={() => dialog.current?.close()} className="inline-flex min-h-11 items-center rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-800">Write a review</Link>
      <button type="button" onClick={() => dialog.current?.close()} className="min-h-11 rounded-xl border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50">Maybe later</button>
    </div>
  </dialog>;
}
