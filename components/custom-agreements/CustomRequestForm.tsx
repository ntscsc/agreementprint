'use client';
import { ExtraCopiesField } from '@/components/order/ExtraCopiesField';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { readApiResponse } from '@/lib/api-response';
import { CustomInput, SAMPLE_TYPES, validateCustomInput, validateSample } from '@/lib/custom-agreement';

const field = 'mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600';
const blank: CustomInput = { agreementType: 'Custom document', purpose: '', language: 'English', instructions: '', preferredDate: '', name: '', phone: '', email: '', extraCopies: 0, stampPaperDenomination: 100, contactConsent: false, includeNotary: false };
export function CustomRequestForm() {
  const { user, loading, signIn, customerProfile } = useAuth();
  const [enteredData, setData] = useState(blank), [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(''), [error, setError] = useState(''), [success, setSuccess] = useState('');
  const pending = useRef<{ requestId: string; ownerUid: string; uploaded: Set<string> } | null>(null);
  const sampleInput = useRef<HTMLInputElement>(null);
  const [editedFields, setEditedFields] = useState<Partial<Record<keyof CustomInput, boolean>>>({});
  const data: CustomInput = {
    ...enteredData,
    name: editedFields.name ? enteredData.name : enteredData.name || customerProfile?.name || '',
    phone: editedFields.phone ? enteredData.phone : enteredData.phone || customerProfile?.phone || '',
    email: editedFields.email ? enteredData.email : enteredData.email || user?.email || '',
  };
  const update = (key: keyof CustomInput, value: string | boolean | number) => { setEditedFields(previous => ({ ...previous, [key]: true })); setData((old) => ({ ...old, [key]: value })); pending.current = null; };
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
      const currentUser = user ?? await signIn();
      if (!currentUser) throw new Error('Sign in to submit your request.');
      const token = await currentUser.getIdToken();
      async function send(body: unknown) {
        const response = await fetch('/api/custom-agreements', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
        return readApiResponse(response);
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
          await readApiResponse(upload);
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
      <legend className="text-lg font-bold mb-4">1. Requirements</legend><p className="text-sm text-stone-600">Fields marked * are required.</p>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Preferred language<select className={field} value={data.language} onChange={(e) => update('language', e.target.value)}>{['English', 'Tamil', 'Both', 'Other'].map((v) => <option key={v}>{v}</option>)}</select></label><label className="block text-sm font-semibold">Preferred completion date (optional)<input type="date" className={field} value={data.preferredDate} onChange={(e) => update('preferredDate', e.target.value)} /></label></div>
      <fieldset className="rounded-xl border border-stone-200 p-4">
        <legend className="px-1 text-sm font-semibold text-stone-900">Do you need a notary signature?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {[{ value: false, label: 'No, document only' }, { value: true, label: 'Yes, add notary signature' }].map((choice) => (
            <label key={String(choice.value)} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold focus-within:ring-2 focus-within:ring-amber-500 ${Boolean(data.includeNotary) === choice.value ? 'border-amber-600 bg-amber-50 text-amber-900' : 'border-stone-300 bg-white text-stone-700'}`}>
              <input type="radio" name="custom-notary" checked={Boolean(data.includeNotary) === choice.value} onChange={() => update('includeNotary', choice.value)} className="h-4 w-4 shrink-0 accent-amber-600" />
              {choice.label}
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-stone-600">If you choose notary service, our team will include it in your quote.</p>
      </fieldset>
      <label className="block text-sm font-semibold">Purpose *<textarea required minLength={5} maxLength={1000} rows={2} className={field} value={data.purpose} onChange={(e) => update('purpose', e.target.value)} placeholder="What do you need this document for?" /></label>
      <label className="block text-sm font-semibold">Customisation instructions *<textarea required minLength={10} maxLength={5000} rows={5} className={field} value={data.instructions} onChange={(e) => update('instructions', e.target.value)} placeholder="Describe what to add, remove or change. Mention any details you want us to clarify." /></label>
      <section aria-labelledby="custom-samples-heading" className="rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50/50 p-4 sm:p-5"><h2 id="custom-samples-heading" className="mb-3 text-lg font-bold">2. Sample documents</h2>
        <label htmlFor="custom-samples" className="block text-sm font-semibold">Sample templates or photos *</label>
        <p id="samples-help" className="my-2 text-sm text-stone-600">Choose up to three PDF, DOCX, JPG or PNG files, up to 10 MB each. Remove unnecessary Aadhaar, bank and other sensitive details before uploading.</p>
        <input ref={sampleInput} id="custom-samples" type="file" required={files.length === 0} multiple accept=".pdf,.docx,.jpg,.jpeg,.png" aria-describedby="samples-help" className="block w-full min-w-0 rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-3 text-sm text-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-amber-600 file:px-5 file:py-3 file:text-sm file:font-bold file:text-white hover:file:bg-amber-700" onChange={(e) => {
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
      </section>
      <section aria-labelledby="custom-print-heading" className="space-y-4"><h2 id="custom-print-heading" className="text-lg font-bold">3. Printing options</h2>
      <label className="block text-sm font-semibold">Stamp paper<select className={field} value={data.stampPaperDenomination ?? 100} onChange={event => update('stampPaperDenomination', Number(event.target.value))}><option value={100}>₹100 stamp paper</option><option value={200}>₹200 stamp paper</option></select></label>
      <ExtraCopiesField value={data.extraCopies} stamp={data.stampPaperDenomination} onChange={count => update('extraCopies', count)} />
      <p className="text-sm text-stone-600">Extra copies will be added to the reviewed quote at ₹150 each.</p>
      </section><section aria-labelledby="custom-contact-heading" className="space-y-4 border-t border-stone-200 pt-5"><h2 id="custom-contact-heading" className="text-lg font-bold">4. Contact details</h2>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Name *<input required minLength={2} maxLength={100} autoComplete="name" className={field} value={data.name} onChange={(e) => update('name', e.target.value)} /></label><label className="block text-sm font-semibold">Mobile number *<input required type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} autoComplete="tel-national" className={field} value={data.phone} onChange={(e) => update('phone', e.target.value)} placeholder="10-digit Indian mobile number" /></label></div>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Email (optional)<input type="email" maxLength={254} autoComplete="email" className={field} value={data.email} onChange={(e) => update('email', e.target.value)} /></label></div>
      <label className="flex items-start gap-3 text-sm leading-6"><input required type="checkbox" checked={data.contactConsent} onChange={(e) => update('contactConsent', e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-amber-600" /><span>I agree to be contacted about this request and have permission to share these samples. This is not consent to marketing. <Link href="/privacy-policy" className="text-brand-700 underline">Privacy policy</Link></span></label>
      </section>
    </fieldset>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {progress && <p role="status" className="text-sm text-brand-800">{progress}</p>}
    <p className="text-sm text-stone-600">Custom agreement drafting is subject to review. We will confirm the price and delivery time before starting work.</p>
    <button disabled={busy || loading} className="w-full rounded-xl bg-amber-600 px-5 py-3 font-semibold text-white hover:bg-amber-700 disabled:opacity-50">{busy ? 'Submitting…' : user ? 'Submit Request for Review' : 'Sign in & Submit'}</button>
  </form>;
}
