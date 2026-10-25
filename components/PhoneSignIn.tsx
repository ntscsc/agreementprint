"use client";
import { useEffect, useRef, useState } from 'react';
import { getAdditionalUserInfo, RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { indianLoginPhone, phoneAuthError } from '@/lib/phone-auth';

export function PhoneSignIn({ onComplete, onBusy }: { onComplete: (user: User, newAccount: boolean) => void; onBusy: (busy: boolean) => void }) {
  const [phone, setPhone] = useState(''), [code, setCode] = useState(''), [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [sentTo, setSentTo] = useState(''), [nextSendAt, setNextSendAt] = useState(0), [seconds, setSeconds] = useState(0);
  const captchaNode = useRef<HTMLDivElement>(null), verifier = useRef<RecaptchaVerifier | null>(null), mounted = useRef(true), locked = useRef(false);
  const completeRef = useRef(onComplete), busyRef = useRef(onBusy);
  useEffect(() => { completeRef.current = onComplete; busyRef.current = onBusy; });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; clearCaptcha(); busyRef.current(false); }; }, []);
  useEffect(() => { const tick = () => setSeconds(Math.max(0, Math.ceil((nextSendAt - Date.now()) / 1000))); tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer); }, [nextSendAt]);
  const field = 'mt-2 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-base text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-700';
  function clearCaptcha() {
    const current = verifier.current;
    verifier.current = null;
    try { current?.clear(); } finally { captchaNode.current?.replaceChildren(); }
  }
  async function sendCode() {
    if (locked.current || Date.now() < nextSendAt) return;
    locked.current = true; setBusy(true); busyRef.current(true); setError('');
    try {
      const number = indianLoginPhone(phone);
      clearCaptcha();
      if (!captchaNode.current || !mounted.current) return;
      verifier.current = new RecaptchaVerifier(auth, captchaNode.current, { size: 'invisible' });
      const result = await signInWithPhoneNumber(auth, number, verifier.current);
      if (mounted.current) { setConfirmation(result); setSentTo(number); setCode(''); setNextSendAt(Date.now() + 60000); }
    } catch (e) { if (mounted.current) { setError(phoneAuthError(e)); setNextSendAt(Date.now() + 60000); } }
    finally { clearCaptcha(); locked.current = false; if (mounted.current) { setBusy(false); busyRef.current(false); } }
  }
  return <form className="mt-5 space-y-4" onSubmit={async event => {
    event.preventDefault();
    if (!confirmation) { await sendCode(); return; }
    if (locked.current) return;
    locked.current = true; setBusy(true); busyRef.current(true); setError('');
    try { const result = await confirmation.confirm(code); if (mounted.current) completeRef.current(result.user, getAdditionalUserInfo(result)?.isNewUser === true); }
    catch (e) { if (mounted.current) setError(phoneAuthError(e)); }
    finally { clearCaptcha(); locked.current = false; if (mounted.current) { setBusy(false); busyRef.current(false); } }
  }}>
    <fieldset disabled={busy} className="space-y-4">
      {!confirmation ? <><label className="block text-sm font-semibold">Mobile number<div className="mt-2 flex items-center rounded-xl border border-stone-300 bg-white"><span className="border-r border-stone-200 px-3 text-sm text-stone-600">+91</span><input required type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[6-9][0-9]{9}" maxLength={10} value={phone} onChange={event => setPhone(event.target.value.replace(/[^0-9]/g, '').slice(0, 10))} placeholder="10-digit mobile number" className="min-h-12 w-full min-w-0 rounded-r-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-700" /></div></label><p className="text-xs leading-5 text-stone-600">We will send a verification code by SMS. Standard SMS rates may apply.</p></> : <><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-stone-600">Code sent to {sentTo}</p><button type="button" onClick={() => { setConfirmation(null); setCode(''); setError(''); clearCaptcha(); }} className="text-sm font-semibold text-blue-800 underline">Change number</button></div><label className="block text-sm font-semibold">6-digit verification code<input autoFocus required type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))} className={field} /></label></>}
      <div ref={captchaNode} className="max-w-full overflow-x-auto" />
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
      <button type="submit" disabled={!confirmation && seconds > 0} className="min-h-12 w-full rounded-xl bg-blue-800 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Please wait...' : confirmation ? 'Verify & sign in' : seconds > 0 ? `Try again in ${seconds}s` : 'Send verification code'}</button>
      {confirmation && <button type="button" disabled={seconds > 0} onClick={() => void sendCode()} className="min-h-11 w-full text-sm font-semibold text-blue-800 underline disabled:text-stone-500 disabled:no-underline">{seconds > 0 ? `Resend code in ${seconds}s` : 'Resend code'}</button>}
    </fieldset>
    <p className="text-xs leading-5 text-stone-500">Already have orders? Use your original sign-in method to access them.</p>
  </form>;
}
