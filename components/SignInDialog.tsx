"use client";
import { useEffect, useRef, useState } from 'react';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, type User } from 'firebase/auth';
import { Eye, EyeOff, Mail, X } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { emailAuthError } from '@/lib/auth-errors';

export function SignInDialog({ onGoogle, onComplete, onCancel }: { onGoogle: () => Promise<User | null>; onComplete: (user: User, newAccount: boolean) => void; onCancel: () => void }) {
  const ref = useRef<HTMLDivElement>(null), emailRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button, input')?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  function switchMode(next: typeof mode) { setMode(next); setError(''); setNotice(''); setPassword(''); setConfirm(''); setVisible(false); emailRef.current?.focus(); }
  const field = 'mt-2 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-base text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-700';
  return <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4"><div ref={ref} role="dialog" aria-modal="true" aria-labelledby="signin-title" onKeyDown={event => {
    if (event.key === 'Escape' && !busy) { event.preventDefault(); onCancel(); }
    if (event.key === 'Tab') {
      const items = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]');
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }} className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 text-stone-900 shadow-2xl">
    <div className="flex items-start justify-between gap-4"><div><h2 id="signin-title" className="text-2xl font-bold">{mode === 'signup' ? 'Create your account' : mode === 'reset' ? 'Reset your password' : 'Welcome to AgreementPrint'}</h2><p className="mt-2 text-sm leading-6 text-stone-600">{mode === 'reset' ? 'Enter your email to request a password reset link.' : 'Use email and password, or continue with Google.'}</p></div><button type="button" disabled={busy} aria-label="Close sign in" onClick={onCancel} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100"><X aria-hidden="true" className="h-5 w-5" /></button></div>
    {mode !== 'reset' && <><button type="button" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { const user = await onGoogle(); if (user) onComplete(user, false); } catch (e) { setError(e instanceof Error ? e.message : 'Google sign-in could not be completed.'); } finally { setBusy(false); } }} className="google-signin-button"><span className="google-signin-logo"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg></span><span>Continue with Google</span></button><div className="my-5 flex items-center gap-3 text-xs text-stone-500"><span className="h-px flex-1 bg-stone-200" />or use email<span className="h-px flex-1 bg-stone-200" /></div></>}
    <form onSubmit={async event => {
      event.preventDefault(); if (busy) return; setError(''); setNotice('');
      if (mode === 'signup' && password !== confirm) { setError('The passwords do not match.'); return; }
      setBusy(true);
      try {
        if (mode === 'reset') { await sendPasswordResetEmail(auth, email.trim()); setNotice('If an account can use password sign-in, a reset link will arrive by email. Check your inbox and spam folder.'); }
        else { const result = mode === 'signup' ? await createUserWithEmailAndPassword(auth, email.trim(), password) : await signInWithEmailAndPassword(auth, email.trim(), password); onComplete(result.user, mode === 'signup'); }
      } catch (e) { if (mode === 'reset' && (e as { code?: string }).code === 'auth/user-not-found') setNotice('If an account can use password sign-in, a reset link will arrive by email. Check your inbox and spam folder.'); else setError(emailAuthError(e)); }
      finally { setBusy(false); }
    }} className="space-y-4">
      <fieldset disabled={busy} className="space-y-4"><label className="block text-sm font-semibold">Email address<input ref={emailRef} autoFocus required type="email" maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className={field} placeholder="you@example.com" /></label>
      {mode !== 'reset' && <><label className="block text-sm font-semibold">Password<div className="relative"><input required type={visible ? 'text' : 'password'} minLength={mode === 'signup' ? 8 : 1} maxLength={4096} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} className={`${field} pr-14`} /><button type="button" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)} className="absolute bottom-1 right-1 flex min-h-11 min-w-11 items-center justify-center text-stone-600">{visible ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}</button></div></label>
      {mode === 'signup' && <><p className="text-xs leading-5 text-stone-600">Use at least 8 characters. A mix of letters, numbers and symbols is best.</p><label className="block text-sm font-semibold">Confirm password<input required type={visible ? 'text' : 'password'} minLength={8} maxLength={4096} autoComplete="new-password" className={field} value={confirm} onChange={event => setConfirm(event.target.value)} /></label></>}
      {mode === 'signin' && <button type="button" onClick={() => switchMode('reset')} className="text-sm font-semibold text-blue-800 underline">Forgot password?</button>}</>}
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}{notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
      <button type="submit" className="min-h-12 w-full rounded-xl bg-blue-800 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><Mail aria-hidden="true" className="mr-2 inline h-4 w-4" />{busy ? 'Please wait...' : mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in with email'}</button></fieldset>
    </form>
    <div className="mt-5 text-center text-sm text-stone-600">{mode === 'signin' ? <>New here? <button disabled={busy} type="button" onClick={() => switchMode('signup')} className="font-semibold text-blue-800 underline">Create an account</button></> : <button disabled={busy} type="button" onClick={() => switchMode('signin')} className="font-semibold text-blue-800 underline">Back to sign in</button>}</div>
  </div></div>;
}
