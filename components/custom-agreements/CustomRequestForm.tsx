'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { CustomInput, SAMPLE_TYPES, validateCustomInput, validateSample } from '@/lib/custom-agreement';

const field = 'mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600';
const blank: CustomInput = { agreementType: '', purpose: '', language: 'English', instructions: '', preferredDate: '', name: '', phone: '', email: '', contactMethod: 'Call', contactConsent: false };
export function CustomRequestForm() {
  const { user, loading, signInWithGoogle } = useAuth();
  const [data, setData] = useState(blank), [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(''), [error, setError] = useState(''), [success, setSuccess] = useState('');
  const pending = useRef<{ requestId: string; ownerUid: string; uploaded: Set<string> } | null>(null);
  const sampleInput = useRef<HTMLInputElement>(null);
  const update = (key: keyof CustomInput, value: string | boolean) => { setData((old) => ({ ...old, [key]: value })); pending.current = null; };
  const removeSample = (index: number) => {
    setFiles((selected) => selected.filter((_, i) => i !== index));
    if (sampleInput.current) sampleInput.current.value = '';
    pending.current = null;
    setError('');
  };
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const details = validateCustomInput(data);
      if (!files.length || files.length > 3) throw new Error('Choose one to three sample files.');
      const descriptors = files.map((file) => validateSample({ name: file.name, size: file.size, contentType: SAMPLE_TYPES[file.name.split('.').pop()!.toLowerCase()] ?? file.type }));
      const currentUser = user ?? await signInWithGoogle();
      if (!currentUser) throw new Error('Sign in to submit your request.');
      const token = await currentUser.getIdToken();
      async function send(body: unknown) {
        const response = await fetch('/api/custom-agreements', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
        const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not submit request.'); return result;
      }
      if (!pending.current || pending.current.ownerUid !== currentUser.uid) pending.current = { requestId: `CUSTOM_${crypto.randomUUID()}`, ownerUid: currentUser.uid, uploaded: new Set() };
      const current = pending.current;
      setProgress('Preparing your private uploads…');
      const result = await send({ action: 'create', requestId: current.requestId, details, files: descriptors });
      if (result.status !== 'Uploading' && result.status !== 'Submitted') throw new Error('This request has already moved to another stage. View My Requests for its current status.');
      if (result.status === 'Uploading') {
        for (let i = 0; i < files.length; i++) {
          const sample = result.files[`sample-${i + 1}`];
          if (current.uploaded.has(sample.id)) continue;
          setProgress(`Uploading sample ${i + 1} of ${files.length}…`);
          const upload = await fetch(`/api/custom-agreements/upload?requestId=${encodeURIComponent(current.requestId)}&sampleId=${encodeURIComponent(sample.id)}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': sample.contentType },
            body: files[i],
          });
          if (!upload.ok) {
            const failure = await upload.json();
            throw new Error(failure.error || 'Could not upload your sample. Please retry.');
          }
          current.uploaded.add(sample.id);
        }
        setProgress('Checking your samples before submission…');
        const completed = await send({ action: 'finalize', requestId: current.requestId });
        if (completed.status !== 'Submitted') throw new Error('This request has already moved to another stage. View My Requests for its current status.');
      }
      setSuccess(current.requestId); pending.current = null;
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); setProgress(''); }
  }
  if (success) return <div className="rounded-2xl border border-green-200 bg-green-50 p-6 space-y-3" role="status"><h2 className="text-xl font-bold">Request submitted</h2><p className="break-all">Your reference: <strong>{success}</strong></p><p>Our team will review your sample and contact you about the scope, quote and completion date. No payment has been collected.</p><Link className="inline-block font-semibold text-brand-700 underline" href="/my-requests">View My Requests</Link></div>;
  return <form onSubmit={submit} className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-8 space-y-6">
    <fieldset disabled={busy || loading} className="space-y-5 disabled:opacity-70">
      <legend className="text-lg font-bold mb-4">Tell us what you need</legend>
      <label className="block text-sm font-semibold">Agreement type<input required maxLength={100} className={field} value={data.agreementType} onChange={(e) => update('agreementType', e.target.value)} placeholder="For example, lease or service agreement" /></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Preferred language<select className={field} value={data.language} onChange={(e) => update('language', e.target.value)}>{['English', 'Tamil', 'Both', 'Other'].map((v) => <option key={v}>{v}</option>)}</select></label><label className="block text-sm font-semibold">Preferred completion date (optional)<input type="date" className={field} value={data.preferredDate} onChange={(e) => update('preferredDate', e.target.value)} /></label></div>
      <label className="block text-sm font-semibold">Purpose<textarea required minLength={5} maxLength={1000} rows={2} className={field} value={data.purpose} onChange={(e) => update('purpose', e.target.value)} placeholder="How will this agreement be used?" /></label>
      <label className="block text-sm font-semibold">Customisation instructions<textarea required minLength={10} maxLength={5000} rows={5} className={field} value={data.instructions} onChange={(e) => update('instructions', e.target.value)} placeholder="Describe what to add, remove or change. Mention any details you want us to clarify." /></label>
      <div>
        <label htmlFor="custom-samples" className="block text-sm font-semibold">Sample templates or photos</label>
        <p id="samples-help" className="my-2 text-sm text-stone-600">Choose up to three PDF, DOCX, JPG or PNG files, up to 10 MB each. Remove unnecessary Aadhaar, bank and other sensitive details before uploading.</p>
        <input ref={sampleInput} id="custom-samples" type="file" required={files.length === 0} multiple accept=".pdf,.docx,.jpg,.jpeg,.png" aria-describedby="samples-help" className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-4 file:py-2 file:font-semibold file:text-brand-800" onChange={(e) => {
          const selected = Array.from(e.target.files ?? []);
          if (!selected.length) return;
          setFiles(selected);
          pending.current = null;
          setError('');
        }} />
        <ul className="mt-3 space-y-2 text-sm" aria-live="polite" aria-label="Selected attachments">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
              <span className="min-w-0 break-all">{file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
              <button type="button" onClick={() => removeSample(index)} aria-label={`Remove ${file.name}`} className="shrink-0 rounded-md px-2 py-1 font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-700">Remove</button>
            </li>
          ))}
        </ul>
      </div>
      <h2 className="text-lg font-bold pt-3">How can we contact you?</h2>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Name<input required minLength={2} maxLength={100} autoComplete="name" className={field} value={data.name} onChange={(e) => update('name', e.target.value)} /></label><label className="block text-sm font-semibold">Mobile number<input required type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} autoComplete="tel-national" className={field} value={data.phone} onChange={(e) => update('phone', e.target.value)} placeholder="10-digit Indian mobile number" /></label></div>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Email (optional)<input type="email" required={data.contactMethod === 'Email'} maxLength={254} autoComplete="email" className={field} value={data.email} onChange={(e) => update('email', e.target.value)} /></label><label className="block text-sm font-semibold">Preferred contact method<select className={field} value={data.contactMethod} onChange={(e) => update('contactMethod', e.target.value)}>{['Call', 'WhatsApp', 'Email'].map((v) => <option key={v}>{v}</option>)}</select></label></div>
      <label className="flex items-start gap-3 text-sm leading-6"><input required type="checkbox" checked={data.contactConsent} onChange={(e) => update('contactConsent', e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-amber-600" /><span>I agree to be contacted about this request and have permission to share these samples. This is not consent to marketing. <Link href="/privacy-policy" className="text-brand-700 underline">Privacy policy</Link></span></label>
    </fieldset>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {progress && <p role="status" className="text-sm text-brand-800">{progress}</p>}
    <p className="text-sm text-stone-600">Custom agreement drafting is subject to review. We will confirm the price and delivery time before starting work.</p>
    <button disabled={busy || loading} className="w-full rounded-xl bg-amber-600 px-5 py-3 font-semibold text-white hover:bg-amber-700 disabled:opacity-50">{busy ? 'Submitting…' : user ? 'Submit Request for Review' : 'Sign in with Google & Submit'}</button>
  </form>;
}
