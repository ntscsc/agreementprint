'use client';

import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { readApiResponse } from '@/lib/api-response';
import { validateCustomerProfile, type CustomerProfile } from '@/lib/customer-profile';

export function CustomerProfilePrompt({ user, onSaved, onSignOut, onClose }: { user: User; onSaved: (profile: CustomerProfile) => void; onSignOut: () => Promise<void>; onClose?: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(user.displayName || '');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [retry, setRetry] = useState(0), [complete, setComplete] = useState(false);
  useEffect(() => {
    if (!complete) dialog.current?.showModal();
    else dialog.current?.close();
  }, [complete]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    (async () => {
      try {
        const result = await readApiResponse(await fetch('/api/customer-profile', { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: 'no-store' }));
        if (!active) return;
        if (result.profile) {
          const profile = validateCustomerProfile(result.profile);
          if (onClose) { setName(profile.name); setPhone(profile.phone); }
          else { onSaved(profile); setComplete(true); }
        }
      } catch { if (active) setError('Could not load your contact details. Retry or enter them below to continue.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [user, onSaved, retry, onClose]);
  return <dialog ref={dialog} aria-labelledby={onClose ? 'edit-customer-profile-title' : 'customer-profile-title'} onCancel={event => { event.preventDefault(); if (!busy) onClose?.(); }} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-stone-200 bg-white p-6 text-stone-900 shadow-xl backdrop:bg-stone-950/60">
    <h2 id={onClose ? 'edit-customer-profile-title' : 'customer-profile-title'} className="text-xl font-bold">{onClose ? 'Edit contact details' : 'Your contact details'}</h2>
    {loading ? <p role="status" className="mt-5 text-sm">Loading your profile…</p> : <form className="mt-5 space-y-4" onSubmit={async event => {
      event.preventDefault(); if (busy) return; setBusy(true); setError('');
      try {
        const profile = validateCustomerProfile({ name, phone });
        const result = await readApiResponse(await fetch('/api/customer-profile', { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(profile) }));
        onSaved(validateCustomerProfile(result.profile)); setComplete(true); onClose?.();
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save your contact details. Please try again.'); }
      finally { setBusy(false); }
    }}>
      <label className="block text-sm font-semibold">Full name (required)<input autoFocus required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={event => setName(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 px-3 py-2 font-normal" /></label>
      <label className="block text-sm font-semibold">Mobile number (required)<input required type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[6-9][0-9]{9}" maxLength={10} placeholder="10-digit Indian mobile number" value={phone} onChange={event => setPhone(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 px-3 py-2 font-normal" /></label>
      {error && <div role="alert" className="text-sm text-rose-700">{error}<button type="button" onClick={() => setRetry(value => value + 1)} className="ml-2 font-semibold underline">Retry loading</button></div>}
      <button disabled={busy} className="min-h-11 w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Saving…' : onClose ? 'Save Changes' : 'Save & Continue'}</button>
    </form>}
    <button type="button" disabled={busy} onClick={() => onClose ? onClose() : void onSignOut()} className="mt-4 min-h-11 text-sm font-semibold text-stone-600 underline">{onClose ? 'Cancel' : 'Sign out'}</button>
  </dialog>;
}
