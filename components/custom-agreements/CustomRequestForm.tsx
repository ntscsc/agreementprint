'use client';
import { EXTRA_COPY_PRICE, MAX_EXTRA_COPIES } from '@/src/config/pricing';
import { fileSize } from '@/lib/custom-workflow';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { readApiResponse } from '@/lib/api-response';
import { CustomInput, SAMPLE_TYPES, validateCustomInput, validateSample, validDate } from '@/lib/custom-agreement';

const field = 'mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600';
const blank: CustomInput = { agreementType: 'Custom document', purpose: '', language: 'English', instructions: '', preferredDate: '', name: '', phone: '', email: '', extraCopies: 0, stampPaperDenomination: 100, contactConsent: false, includeNotary: false };
type FieldKey = keyof CustomInput | 'samples';
type FieldErrors = Partial<Record<FieldKey, string>>;
const fieldLabels: Partial<Record<FieldKey, string>> = { purpose: 'Purpose', instructions: 'Changes or instructions', name: 'Name', phone: 'Mobile number', email: 'Email', samples: 'Sample documents', contactConsent: 'Permission to contact and share samples', preferredDate: 'Preferred date', extraCopies: 'Extra copies' };
function getFieldErrors(data: CustomInput, files: File[]): FieldErrors {
  const errors: FieldErrors = {};
  if (data.purpose.trim().length < 5) errors.purpose = 'Enter a purpose with at least 5 characters.';
  if (data.instructions.trim().length < 10) errors.instructions = 'Describe the changes you need using at least 10 characters.';
  if (data.name.trim().length < 2) errors.name = 'Enter your name (at least 2 characters).';
  if (!/^[6-9]\d{9}$/.test(data.phone.trim())) errors.phone = 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9.';
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) errors.email = 'Enter a valid email address, or leave it blank.';
  if (data.preferredDate && !validDate(data.preferredDate)) errors.preferredDate = 'Choose a valid preferred date.';
  if (!data.contactConsent) errors.contactConsent = 'Please agree to contact about this request and confirm permission to share the samples.';
  if (!files.length || files.length > 3) errors.samples = 'Choose 1 to 3 sample documents.';
  else for (const file of files) {
    try { validateSample({ name: file.name, size: file.size, contentType: SAMPLE_TYPES[file.name.split('.').pop()!.toLowerCase()] ?? file.type }); }
    catch (error) { errors.samples = `${file.name}: ${(error as Error).message}`; break; }
  }
  return errors;
}
function FieldError({ name, errors }: { name: FieldKey; errors: FieldErrors }) {
  return errors[name] ? <span id={`custom-error-${name}`} className="mt-1 block text-xs font-normal leading-relaxed text-rose-800">{errors[name]}</span> : null;
}
export function CustomRequestForm() {
  const { user, loading, signIn, customerProfile } = useAuth();
  const [enteredData, setData] = useState(blank), [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(''), [error, setError] = useState(''), [success, setSuccess] = useState('');
  const pending = useRef<{ requestId: string; ownerUid: string; uploaded: Set<string> } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const validationProps = (name: FieldKey) => ({ name, 'aria-label': `${fieldLabels[name] || name}${['purpose', 'instructions', 'name', 'phone', 'samples'].includes(name) ? ' *' : ['email', 'preferredDate'].includes(name) ? ' (optional)' : ''}`, 'aria-invalid': fieldErrors[name] ? true : undefined, 'aria-describedby': fieldErrors[name] ? `custom-error-${name}` : undefined });
  const fieldStyle = (name: FieldKey) => fieldErrors[name] ? field.replace('border-stone-300', 'border-rose-500') : field;
  const focusField = (name: FieldKey) => {
    const element = formRef.current?.querySelector<HTMLElement>(`[name="${name}"]`);
    const section = element?.closest('details'); if (section) section.open = true;
    requestAnimationFrame(() => { element?.focus(); element?.scrollIntoView({ block: 'center', behavior: 'smooth' }); });
  };
  const sampleInput = useRef<HTMLInputElement>(null);
  const [editedFields, setEditedFields] = useState<Partial<Record<keyof CustomInput, boolean>>>({});
  const data: CustomInput = {
    ...enteredData,
    name: editedFields.name ? enteredData.name : enteredData.name || customerProfile?.name || '',
    phone: editedFields.phone ? enteredData.phone : enteredData.phone || customerProfile?.phone || '',
    email: editedFields.email ? enteredData.email : enteredData.email || user?.email || '',
  };
  const update = (key: keyof CustomInput, value: string | boolean | number) => { setEditedFields(previous => ({ ...previous, [key]: true })); setData((old) => ({ ...old, [key]: value })); pending.current = null; setFieldErrors(previous => previous[key] ? { ...previous, [key]: getFieldErrors({ ...data, [key]: value }, files)[key] } : previous); };
  const removeSample = (index: number) => {
    const remaining = files.filter((_, i) => i !== index);
    setFiles(remaining); setFieldErrors(previous => previous.samples ? { ...previous, samples: getFieldErrors(data, remaining).samples } : previous);
    if (sampleInput.current) sampleInput.current.value = '';
    pending.current = null;
    setError('');
  };
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('');
    const errors = getFieldErrors(data, files);
    for (const element of Array.from(formRef.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select') || [])) {
      if (element.name && !element.validity.valid && !errors[element.name as FieldKey]) errors[element.name as FieldKey] = element.validationMessage;
    }
    setFieldErrors(errors);
    const first = Object.keys(errors)[0] as FieldKey | undefined;
    if (first) { focusField(first); return; }
    setBusy(true);
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
      setProgress('Preparing your private uploads...');
      const result = await send({ action: 'create', requestId: current.requestId, details, files: descriptors });
      if (result.status !== 'Uploading' && result.status !== 'Submitted') throw new Error('This request has already moved to another stage. View My Requests for its current status.');
      if (result.status === 'Uploading') {
        for (let i = 0; i < files.length; i++) {
          const sample = result.files[`sample-${i + 1}`];
          if (current.uploaded.has(sample.id)) continue;
          setProgress(`Uploading sample ${i + 1} of ${files.length}...`);
          const upload = await fetch(`/api/custom-agreements/upload?requestId=${encodeURIComponent(current.requestId)}&sampleId=${encodeURIComponent(sample.id)}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': sample.contentType },
            body: files[i],
          });
          await readApiResponse(upload);
          current.uploaded.add(sample.id);
        }
        setProgress('Checking your samples before submission...');
        const completed = await send({ action: 'finalize', requestId: current.requestId });
        if (completed.status !== 'Submitted') throw new Error('This request has already moved to another stage. View My Requests for its current status.');
      }
      setSuccess(result.publicReference || current.requestId); pending.current = null;
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); setProgress(''); }
  }
  if (success) return <div className="rounded-2xl border border-green-200 bg-green-50 p-6 space-y-3" role="status"><h2 className="text-xl font-bold">Request submitted</h2><p className="break-all">Your reference: <strong>{success}</strong></p><p>Our team will review your sample and contact you about the scope, quote and completion date. No payment has been collected.</p><Link className="inline-block font-semibold text-brand-700 underline" href="/my-requests">View My Requests</Link></div>;
  return <form ref={formRef} noValidate onSubmit={submit} className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-6">
    <fieldset disabled={busy || loading} className="space-y-5 disabled:opacity-70">
      <legend className="sr-only">Custom agreement request</legend>
      <section aria-labelledby="custom-requirements-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3"><h2 id="custom-requirements-heading" className="font-bold text-stone-900">What do you need?</h2><span className="text-xs text-stone-500">* Required</span></div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]"><label className="block text-sm font-semibold">Purpose *<input required minLength={5} maxLength={1000} className={fieldStyle('purpose')} {...validationProps('purpose')} value={data.purpose} onChange={e => update('purpose', e.target.value)} placeholder="e.g. An affidavit for an address change" /><FieldError name="purpose" errors={fieldErrors} /></label><label className="block text-sm font-semibold">Language<select className={field} value={data.language} onChange={e => update('language', e.target.value)}>{['English', 'Tamil'].map(value => <option key={value}>{value}</option>)}</select></label></div>
        <label className="block text-sm font-semibold">Changes or instructions *<textarea required minLength={10} maxLength={5000} rows={3} className={fieldStyle('instructions')} {...validationProps('instructions')} value={data.instructions} onChange={e => update('instructions', e.target.value)} placeholder="Tell us what to add, remove or change in your sample." /><FieldError name="instructions" errors={fieldErrors} /></label>
      </section>
      <section aria-labelledby="custom-samples-heading" className="space-y-2">
        <label id="custom-samples-heading" htmlFor="custom-samples" className="block text-sm font-semibold">Sample documents *</label>
        <input ref={sampleInput} id="custom-samples" {...validationProps('samples')} type="file" required={files.length === 0} multiple accept=".pdf,.docx,.jpg,.jpeg,.png" aria-describedby={`samples-help${fieldErrors.samples ? ' custom-error-samples' : ''}`} className="block min-h-11 w-full min-w-0 rounded-xl border border-stone-300 bg-stone-50 p-2 text-sm text-stone-700 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-stone-200 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-stone-900 hover:file:bg-stone-300" onChange={event => {
          const selected = Array.from(event.target.files ?? []);
          if (!selected.length) return;
          setFiles(selected); pending.current = null; setError(''); setFieldErrors(previous => ({ ...previous, samples: getFieldErrors(data, selected).samples }));
        }} />
        <FieldError name="samples" errors={fieldErrors} />
        <p id="samples-help" className="text-xs leading-relaxed text-stone-500">1-3 PDF, DOCX or image files, up to 10 MB each. Remove sensitive ID or bank details you do not need to share.</p>
        {files.length > 0 && <ul className="space-y-1 text-sm" aria-live="polite" aria-label="Selected attachments">{files.map((file, index) => <li key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-1"><span className="min-w-0 break-all">{file.name} <span className="text-xs text-stone-500">{fileSize(file.size)}</span></span><button type="button" onClick={() => removeSample(index)} aria-label={`Remove ${file.name}`} className="min-h-10 shrink-0 rounded-md px-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">Remove</button></li>)}</ul>}
      </section>
      <details className="rounded-xl border border-stone-200 bg-stone-50">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-stone-800">Printing &amp; preferences <span className="mt-1 block text-xs font-normal text-stone-500">₹{data.stampPaperDenomination || 100} stamp / {1 + (data.extraCopies || 0)} {(data.extraCopies || 0) === 0 ? 'copy' : 'copies'} / {data.includeNotary ? 'With notary' : 'No notary'}{data.preferredDate ? ` / Preferred: ${data.preferredDate}` : ''}</span></summary>
        <div className="grid gap-3 border-t border-stone-200 p-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">Stamp paper<select className={field} value={data.stampPaperDenomination ?? 100} onChange={event => update('stampPaperDenomination', Number(event.target.value))}><option value={100}>₹100</option><option value={200}>₹200</option></select></label>
          <label className="block text-sm font-semibold">Extra copies<input type="number" min={0} max={MAX_EXTRA_COPIES} step={1} {...validationProps('extraCopies')} value={data.extraCopies ?? 0} className={fieldStyle('extraCopies')} onChange={event => { const count = event.target.value === '' ? 0 : Number(event.target.value); if (Number.isSafeInteger(count) && count >= 0 && count <= MAX_EXTRA_COPIES) update('extraCopies', count); }} /><FieldError name="extraCopies" errors={fieldErrors} /><span className="mt-1 block text-xs font-normal text-stone-500">One original included; ₹{EXTRA_COPY_PRICE} per extra stamped copy.</span></label>
          <label className="block text-sm font-semibold">Notary signature<select className={field} value={data.includeNotary ? 'yes' : 'no'} onChange={event => update('includeNotary', event.target.value === 'yes')}><option value="no">Not required</option><option value="yes">Include in quote</option></select></label>
          <label className="block text-sm font-semibold">Preferred date (optional)<input type="date" className={fieldStyle('preferredDate')} {...validationProps('preferredDate')} value={data.preferredDate} onChange={event => update('preferredDate', event.target.value)} /><FieldError name="preferredDate" errors={fieldErrors} /><span className="mt-1 block text-xs font-normal text-stone-500">We will confirm availability after review.</span></label>
        </div>
      </details>
      <section aria-labelledby="custom-contact-heading" className="space-y-3 border-t border-stone-200 pt-4">
        <h2 id="custom-contact-heading" className="font-bold text-stone-900">Your details</h2>
        <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold">Name *<input required minLength={2} maxLength={100} autoComplete="name" className={fieldStyle('name')} {...validationProps('name')} value={data.name} onChange={event => update('name', event.target.value)} /><FieldError name="name" errors={fieldErrors} /></label><label className="block text-sm font-semibold">Mobile number *<input required type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} autoComplete="tel-national" className={fieldStyle('phone')} {...validationProps('phone')} value={data.phone} onChange={event => update('phone', event.target.value)} placeholder="10-digit mobile number" /><FieldError name="phone" errors={fieldErrors} /></label><label className="block text-sm font-semibold sm:col-span-2">Email (optional)<input type="email" maxLength={254} autoComplete="email" className={fieldStyle('email')} {...validationProps('email')} value={data.email} onChange={event => update('email', event.target.value)} /><FieldError name="email" errors={fieldErrors} /></label></div>
        <label className="flex items-start gap-2 text-xs leading-relaxed text-stone-600"><input required type="checkbox" {...validationProps('contactConsent')} checked={data.contactConsent} onChange={event => update('contactConsent', event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700" /><span>You may contact me about this request. I have permission to share these samples. No marketing consent. <Link href="/privacy-policy" className="text-brand-700 underline">Privacy policy</Link><FieldError name="contactConsent" errors={fieldErrors} /></span></label>
      </section>
    </fieldset>
    {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {progress && <p role="status" className="mt-4 text-sm text-brand-800">{progress}</p>}
    <div className="mt-5 flex flex-col gap-3 border-t border-stone-200 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-stone-500">No payment now. We will confirm the quote before work starts.</p><button disabled={busy || loading} className="min-h-11 shrink-0 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50">{busy ? 'Submitting...' : user ? 'Submit request' : 'Sign in & submit'}</button></div>
  </form>;
}
