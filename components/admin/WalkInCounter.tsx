"use client";
import { useEffect, useRef, useState } from 'react';
import { Plus, Search, ArrowLeft, ArrowRight, Printer, CheckCircle2, Download, Store } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { readApiResponse } from '@/lib/api-response';
import { formatPropertyAddress } from '@/lib/agreement-formatter';
import { validatePerson, validateProperty } from '@/lib/agreement-validation';
import type { AgreementTerms, PersonDetails, PropertyDetails } from '@/lib/types';
import { validateCounterAgreement, type CounterOrder, type CounterPaymentMethod } from '@/lib/counter-order';
import { OwnerStep } from '@/components/order/OwnerStep';
import { TenantStep } from '@/components/order/TenantStep';
import { PropertyStep } from '@/components/order/PropertyStep';
import { RentalAgreementDocument } from '@/components/agreement/RentalAgreementDocument';

const person = (): PersonDetails => ({ fullName: '', relativeName: '', age: '', address: '', phone: '', pincode: '' });
const termsDefault = (): AgreementTerms => ({ agreementType: 'Rental', language: 'English', monthlyRent: 0, securityDeposit: 0, maintenanceCharges: 0, paintingDeduction: 0, startDate: '', tenureMonths: 11, noticePeriodDays: 30, rentIncreasePct: 0, paymentDueDay: 5, stampPaperDenomination: 100, includeNotary: false, extraCopies: 0, deliveryRecipient: 'Owner', deliveryLocation: 'Within Chennai' });
const input = 'mt-2 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900';
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 disabled:opacity-50';
const primary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-800 px-5 py-3 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50';
export function WalkInCounter() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<CounterOrder[]>([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [search, setSearch] = useState('');
  const [editing, setEditing] = useState(false), [step, setStep] = useState(0), [current, setCurrent] = useState<CounterOrder | null>(null), [printing, setPrinting] = useState<CounterOrder | null>(null);
  const [owner, setOwner] = useState(person), [tenant, setTenant] = useState(person);
  const [property, setProperty] = useState<PropertyDetails>({ fullAddress: '', city: 'Chennai', pincode: '', propertyType: 'House', furnishing: 'Unfurnished' });
  const [terms, setTerms] = useState(termsDefault), [amount, setAmount] = useState(''), [method, setMethod] = useState<CounterPaymentMethod>('Unpaid'), [reference, setReference] = useState('');
  const orderId = useRef(''), saveKey = useRef('');
  useEffect(() => {
    let active = true;
    if (!user) return;
    (async () => { try {
      const result = await readApiResponse(await fetch('/api/admin/counter-orders', { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: 'no-store' }));
      if (active) setOrders(result.orders);
    } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Could not load counter orders.'); }
    finally { if (active) setLoading(false); } })();
    return () => { active = false; };
  }, [user]);
  useEffect(() => {
    if (!editing) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [editing]);
  const changed = () => { saveKey.current = crypto.randomUUID().replaceAll('-', ''); setError(''); };
  const update = (fields: Partial<AgreementTerms>) => { changed(); setTerms(previous => ({ ...previous, ...fields })); };
  function open(order?: CounterOrder) {
    setCurrent(order || null); orderId.current = order?.orderId || `COUNTER_${crypto.randomUUID().replaceAll('-', '')}`;
    saveKey.current = crypto.randomUUID().replaceAll('-', '');
    setOwner(order?.ownerDetails || person()); setTenant(order?.tenantDetails || person());
    setProperty(order?.propertyDetails || { fullAddress: '', city: 'Chennai', pincode: '', propertyType: 'House', furnishing: 'Unfurnished' });
    setTerms(order?.agreementTerms || termsDefault()); setAmount(order ? String(order.counterAmount) : '');
    setMethod(order?.counterPaymentMethod || 'Unpaid'); setReference(order?.counterPaymentReference || '');
    setStep(order ? 3 : 0); setEditing(true); setError(''); setMessage('');
  }
  async function send(body: Record<string, unknown>, bill = false) {
    if (!user) throw new Error('Sign in again to use the counter.');
    const response = await fetch('/api/admin/counter-orders', { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (bill && response.ok) {
      const url = URL.createObjectURL(await response.blob()), link = document.createElement('a');
      link.href = url; link.download = `Bill-${body.publicReference || 'counter'}.pdf`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); return null;
    }
    return readApiResponse(response);
  }
  function remember(order: CounterOrder) { setOrders(previous => [order, ...previous.filter(item => item.orderId !== order.orderId)]); }
  async function action(order: CounterOrder, action: 'print' | 'collect' | 'bill') {
    const allowUnpaid = action === 'print' && order.payment.status !== 'Paid';
    if (allowUnpaid && !window.confirm('This order is unpaid. Print it without collecting payment?')) return;
    setBusy(true); setError('');
    try {
      const result = await send({ action, orderId: order.orderId, updatedAt: order.updatedAt, allowUnpaid, publicReference: order.publicReference }, action === 'bill');
      if (result) { remember(result.order); if (action === 'print') setPrinting(result.order); else setMessage('Order marked collected.'); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to update this order.'); }
    finally { setBusy(false); }
  }
  function next() {
    try {
      if (step === 0) { validatePerson(owner, 'Owner'); validatePerson(tenant, 'Tenant'); }
      if (step === 1) validateProperty(property);
      if (step === 2) validateCounterAgreement({ ownerDetails: owner, tenantDetails: tenant, propertyDetails: property, agreementTerms: terms });
      setError(''); setStep(step + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Check the entered details.'); }
  }
  async function save() {
    setBusy(true); setError('');
    try {
      const result = await send({ action: 'save', orderId: orderId.current, saveKey: saveKey.current, updatedAt: current?.updatedAt, ownerDetails: owner, tenantDetails: tenant, propertyDetails: property, agreementTerms: terms, counterAmount: Number(amount), counterPaymentMethod: method, counterPaymentReference: reference });
      remember(result!.order); setEditing(false); setMessage(`${result!.order.publicReference} saved. You can now prepare the print copy.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save this order.'); }
    finally { setBusy(false); }
  }
  if (printing) return <RentalAgreementDocument blankStampSpace data={printing} title={`Counter agreement - ${printing.publicReference}`} onBack={() => setPrinting(null)} />;
  const visible = orders.filter(order => [order.publicReference, order.ownerDetails.fullName, order.tenantDetails.fullName, order.customerPhone].some(value => value?.toLowerCase().includes(search.toLowerCase())));
  return <section className="space-y-6" aria-label="Walk-in counter">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-blue-800">In-store service</p><h2 className="mt-1 text-2xl font-bold text-stone-900">Walk-in Counter</h2><p className="mt-2 text-sm text-stone-600">Prepare agreements, record counter payments and print for collection.</p></div>{!editing && <button type="button" onClick={() => open()} className={primary}><Plus className="h-4 w-4" />New walk-in order</button>}</header>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{message}</p>}
    {editing ? <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><p className="font-bold">{current?.publicReference || 'New walk-in order'}</p><button type="button" disabled={busy} onClick={() => { if (window.confirm('Leave this form? Unsaved changes will be lost.')) { setEditing(false); setError(''); } }} className="text-sm font-semibold text-stone-600 underline">Back to counter</button></div>
      <ol className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Order steps">{['People', 'Property', 'Agreement', 'Counter payment'].map((label, i) => <li key={label}><button type="button" disabled={busy || i > step} aria-current={i === step ? 'step' : undefined} onClick={() => { setStep(i); setError(''); }} className={`min-h-11 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold ${i === step ? 'bg-blue-800 text-white' : 'bg-stone-100 text-stone-600'}`}>{i + 1}. {label}</button></li>)}</ol>
      <form onSubmit={event => { event.preventDefault(); if (step < 3) next(); else void save(); }}><fieldset disabled={busy} className="space-y-6">
        {step === 0 && <><OwnerStep data={owner} errors={{}} onChange={fields => { changed(); setOwner(previous => ({ ...previous, ...fields })); }} /><TenantStep data={tenant} errors={{}} onChange={fields => { changed(); setTenant(previous => ({ ...previous, ...fields })); }} /></>}
        {step === 1 && <PropertyStep data={property} errors={{}} onChange={fields => { changed(); setProperty(previous => ({ ...previous, ...fields })); }} />}
        {step === 2 && <><h3 className="text-lg font-bold">Agreement terms</h3><div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-semibold">Agreement type<select className={input} value={terms.agreementType} onChange={event => update(event.target.value === 'Lease' ? { agreementType: 'Lease', language: 'English', monthlyRent: 0, rentIncreasePct: 0 } : { agreementType: 'Rental' })}><option>Rental</option><option>Lease</option></select></label>
          <label className="text-sm font-semibold">Language<select className={input} disabled={terms.agreementType === 'Lease'} value={terms.language} onChange={event => update({ language: event.target.value as AgreementTerms['language'] })}><option>English</option><option>Tamil</option></select></label>
          {([['monthlyRent', 'Monthly rent (Rs.)'], ['securityDeposit', terms.agreementType === 'Lease' ? 'Lease advance (Rs.)' : 'Deposit (Rs.)'], ['maintenanceCharges', 'Maintenance (Rs.)'], ['tenureMonths', 'Duration (months)'], ['noticePeriodDays', 'Notice period (days)'], ['rentIncreasePct', 'Annual increase (%)'], ['paymentDueDay', 'Rent due day'], ...(property.propertyType !== 'Commercial Shop' && terms.agreementType !== 'Lease' ? [['paintingDeduction', 'Painting deduction (Rs., 0 for none)']] : [])] as [keyof AgreementTerms, string][]).map(([key, label]) => <label key={key} className="text-sm font-semibold">{label}<input type="number" required min={['tenureMonths', 'paymentDueDay'].includes(key) ? 1 : 0} max={key === 'paymentDueDay' ? 31 : key === 'tenureMonths' ? 120 : key === 'noticePeriodDays' ? 365 : key === 'rentIncreasePct' ? 100 : 1000000000} step={['tenureMonths', 'noticePeriodDays', 'paymentDueDay'].includes(key) ? 1 : '0.01'} disabled={terms.agreementType === 'Lease' && ['monthlyRent', 'rentIncreasePct'].includes(key)} value={terms[key] === undefined ? '' : String(terms[key])} onChange={event => update({ [key]: event.target.value === '' ? undefined : Number(event.target.value) })} className={input} /></label>)}
          <label className="text-sm font-semibold">Start date<input type="date" required className={input} value={terms.startDate} onChange={event => update({ startDate: event.target.value })} /></label>
          <label className="text-sm font-semibold">Stamp paper<select className={input} value={terms.stampPaperDenomination} onChange={event => update({ stampPaperDenomination: Number(event.target.value) as 100 | 200 })}><option value={100}>Rs.100</option><option value={200}>Rs.200</option></select></label>
          <label className="text-sm font-semibold">Extra copies<input type="number" min={0} max={100} step={1} required className={input} value={terms.extraCopies} onChange={event => update({ extraCopies: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
          <label className="text-sm font-semibold">Notary<select className={input} value={terms.includeNotary ? 'yes' : 'no'} onChange={event => update({ includeNotary: event.target.value === 'yes' })}><option value="no">Not required</option><option value="yes">Include notary</option></select></label>
        </div><p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">Counter collection. No delivery charge or online payment checkout is added. Enter the agreed counter charge in the next step.</p></>}
        {step === 3 && <><div className="rounded-xl bg-stone-50 p-4"><h3 className="font-bold">Review &amp; counter payment</h3><p className="mt-2 text-sm text-stone-700">{owner.fullName} &amp; {tenant.fullName}</p><p className="mt-1 break-words text-sm text-stone-600">{formatPropertyAddress(property.fullAddress, property.city, property.pincode)}</p><p className="mt-1 text-sm text-stone-600">{terms.language} {terms.agreementType} agreement / Rs.{terms.stampPaperDenomination} stamp / {1 + (terms.extraCopies || 0)} copies</p></div>
          <div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold">Agreed counter charge (Rs.)<input type="number" min={1} max={1000000} step={1} required disabled={current?.payment.status === 'Paid'} className={input} value={amount} onChange={event => { changed(); setAmount(event.target.value); }} /></label><label className="text-sm font-semibold">Payment received by<select disabled={current?.payment.status === 'Paid'} className={input} value={method} onChange={event => { changed(); setMethod(event.target.value as CounterPaymentMethod); }}><option>Unpaid</option><option>Cash</option><option>UPI</option><option>Card</option></select></label></div>
          <label className="block text-sm font-semibold">Payment reference {['UPI', 'Card'].includes(method) ? '(required)' : '(optional)'}<input maxLength={150} required={['UPI', 'Card'].includes(method)} disabled={current?.payment.status === 'Paid'} className={input} value={reference} onChange={event => { changed(); setReference(event.target.value); }} /></label>
          <p className="text-sm text-stone-600">{method === 'Unpaid' ? 'Save as unpaid. Printing will ask for confirmation; collection requires payment.' : 'Choose a paid method only after you have received the money at the counter.'}</p>
        </>}
        <div className="flex items-center justify-between gap-3 border-t border-stone-200 pt-5">{step > 0 ? <button type="button" onClick={() => setStep(step - 1)} className={button}><ArrowLeft className="h-4 w-4" />Back</button> : <span />}<button type="submit" className={primary}>{busy ? 'Saving...' : step === 3 ? 'Save counter order' : 'Continue'}{step < 3 && <ArrowRight className="h-4 w-4" />}</button></div>
      </fieldset></form>
    </div> : <>
      <label className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4"><Search aria-hidden="true" className="h-4 w-4 text-stone-500" /><span className="sr-only">Search counter orders</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search reference, name or phone" className="min-h-12 w-full bg-transparent text-sm outline-none" /></label>
      <p className="text-xs text-stone-600">Most recent 200 counter orders. Counter payments are separate from online orders and referral rewards.</p>
      {loading ? <p role="status">Loading counter orders...</p> : !visible.length ? <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center"><Store className="mx-auto h-8 w-8 text-blue-800" /><h3 className="mt-4 font-bold">{search ? 'No matching counter orders' : 'Ready for your first walk-in customer'}</h3><p className="mt-2 text-sm text-stone-600">{search ? 'Try another name, phone or reference.' : 'Start a new order, enter the details and prepare a print copy.'}</p></div> : <div className="space-y-4">{visible.map(order => <article key={order.orderId} className="rounded-2xl border border-stone-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-mono text-lg font-bold">{order.publicReference}</h3><p className="mt-1 text-sm font-semibold">{order.ownerDetails.fullName} &amp; {order.tenantDetails.fullName}</p><p className="mt-1 text-sm text-stone-600">{order.agreementTerms.language} / {order.agreementTerms.agreementType} / Rs.{order.counterAmount.toLocaleString('en-IN')}</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900">{order.collectedAt ? 'Collected' : order.preparationStartedAt ? 'Print prepared' : 'Ready to prepare'}</span><span className={`rounded-full px-3 py-1 text-xs font-semibold ${order.payment.status === 'Paid' ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>{order.payment.status === 'Paid' ? `Paid - ${order.counterPaymentMethod}` : 'Unpaid'}</span></div></div><div className="mt-5 flex flex-wrap gap-2">{!order.collectedAt && <button type="button" disabled={busy} onClick={() => open(order)} className={button}>{order.payment.status === 'Paid' ? 'Edit details' : 'Edit / Record payment'}</button>}<button type="button" disabled={busy} onClick={() => void action(order, 'print')} className={primary}><Printer className="h-4 w-4" />{order.collectedAt ? 'Reprint' : 'Preview & Print'}</button>{order.payment.status === 'Paid' && <button type="button" disabled={busy} onClick={() => void action(order, 'bill')} className={button}><Download className="h-4 w-4" />Bill (PDF)</button>}{!order.collectedAt && order.preparationStartedAt && order.payment.status === 'Paid' && <button type="button" disabled={busy} onClick={() => { if (window.confirm('Confirm the customer has collected this agreement?')) void action(order, 'collect'); }} className={button}><CheckCircle2 className="h-4 w-4" />Mark collected</button>}</div></article>)}</div>}
    </>}
  </section>;
}
