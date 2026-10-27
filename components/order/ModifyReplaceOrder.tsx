'use client';

import { openPaymentCheckout } from '@/lib/open-payment-checkout';
import { ExtraCopiesField } from './ExtraCopiesField';
import { OrderReference } from './OrderReference';
import { useState } from 'react';
import type { Order, AgreementTerms } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { readApiResponse } from '@/lib/api-response';
import { OwnerStep } from './OwnerStep';
import { TenantStep } from './TenantStep';
import { PropertyStep } from './PropertyStep';

export function ModifyReplaceOrder({ order, onSaved, onCancel, correctionMode = false }: { order: Order; onSaved: (order: Order, original?: Order) => void; onCancel: () => void; correctionMode?: boolean }) {
  const { user } = useAuth();
  const [owner, setOwner] = useState(order.ownerDetails);
  const [tenant, setTenant] = useState(order.tenantDetails);
  const [property, setProperty] = useState(order.propertyDetails);
  const [terms, setTerms] = useState(order.agreementTerms);
  const [requestKey] = useState(() => crypto.randomUUID().replaceAll('-', ''));
  const [quote, setQuote] = useState<{ subtotal: number; discount: number; total: number; alreadyPaid: number; due: number; surplus: number; excessCash: number; excessCredits: number } | null>(null);
  const [reviewRequired, setReviewRequired] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const input = 'mt-1 block min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm';
  const change = (fields: Partial<AgreementTerms>) => { setQuote(null); setTerms(previous => ({ ...previous, ...fields })); };
  return <form className="order-edit-form space-y-6 rounded-2xl border border-stone-200 bg-white p-5" onSubmit={async event => {
    event.preventDefault(); if (!user || busy) return;
    setBusy(true); setError('');
    try {
      if (correctionMode) {
        const response = await fetch('/api/orders/corrections', { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'resubmit', submissionKey: requestKey, orderId: order.orderId, updatedAt: order.updatedAt, ownerDetails: owner, tenantDetails: tenant, propertyDetails: property, agreementTerms: terms }) });
        const result = await readApiResponse(response); onSaved(result.order as Order); return;
      }
      const response = await fetch('/api/orders/replace', { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: quote ? 'submit' : 'preview', acceptAdminReview: reviewRequired, requestKey, reviewedTotal: quote?.total, orderId: order.orderId, updatedAt: order.updatedAt, ownerDetails: owner, tenantDetails: tenant, propertyDetails: property, agreementTerms: terms }) });
      const result = await readApiResponse(response);
      if (result.redirectUrl) { await openPaymentCheckout(result.redirectUrl); return; }
      if (result.edited) { onSaved(result.order as Order); return; }
      if (result.completed) { onSaved(result.order as Order, result.original as Order); return; }
      if (result.reviewRequired && !result.quote) { setSubmitted(true); return; }
      setQuote(result.quote); setReviewRequired(result.reviewRequired === true);
    } catch (reason) { setQuote(null); setError(reason instanceof Error ? reason.message : 'Unable to save changes.'); }
    finally { setBusy(false); }
  }}>
    <h2 className="text-xl font-bold">{correctionMode ? 'Correct & Resubmit' : 'Modify / Replace Order'}</h2>
    <OrderReference reference={order.orderId} /><p className="text-sm text-stone-600">{correctionMode ? `Correct the requested details and return this same order for verification. Your order ID and confirmed payment stay unchanged.` : `Changes with no price difference update this same order for verification and preserve your payment. Higher-value packages create a replacement; lower-value packages require cancellation before drafting and a new order.`}</p>
    {correctionMode && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-900">Required corrections from admin</p><p className="mt-2 whitespace-pre-wrap text-sm text-amber-900">{order.correctionMessage}</p></div>}
    <fieldset disabled={busy || submitted} className="space-y-6">
      <OwnerStep data={owner} onChange={fields => { setQuote(null); setOwner(previous => ({ ...previous, ...fields })); }} errors={{}} />
      <TenantStep data={tenant} onChange={fields => { setQuote(null); setTenant(previous => ({ ...previous, ...fields })); }} errors={{}} />
      <PropertyStep data={property} onChange={fields => { setQuote(null); setProperty(previous => ({ ...previous, ...fields })); }} errors={{}} />
      <h3 className="text-lg font-bold">Agreement terms</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>Agreement type<select className={input} value={terms.agreementType || 'Rental'} onChange={event => change(event.target.value === 'Lease' ? { agreementType: 'Lease', language: 'English', monthlyRent: 0, rentIncreasePct: 0 } : { agreementType: 'Rental' })}><option>Rental</option><option>Lease</option></select></label>
        <label>Language<select className={input} value={terms.language || 'English'} disabled={terms.agreementType === 'Lease'} onChange={event => change({ language: event.target.value as AgreementTerms['language'] })}><option>English</option><option>Tamil</option></select></label>
        {([
          ['monthlyRent', 'Monthly rent', 0, 1000000000], ['securityDeposit', terms.agreementType === 'Lease' ? 'Lease advance' : 'Security deposit', 0, 1000000000],
          ['maintenanceCharges', 'Monthly maintenance', 0, 1000000000], ['tenureMonths', 'Duration in months', 1, 120],
          ['noticePeriodDays', 'Notice period in days', 0, 365], ['rentIncreasePct', 'Annual rent increase (%)', 0, 100], ['paymentDueDay', 'Rent due day', 1, 31],
          ['paintingDeduction', 'Painting deduction (0 for none)', 0, 1000000000],
        ] as [keyof AgreementTerms, string, number, number][]).map(([key, label, min, max]) => <label key={key}>{label}<input required={key !== 'paymentDueDay'} className={input} type="number" min={min} max={max} step={['tenureMonths', 'noticePeriodDays', 'paymentDueDay'].includes(key) ? 1 : '0.01'} value={terms[key] === undefined ? '' : String(terms[key])} disabled={terms.agreementType === 'Lease' && ['monthlyRent', 'rentIncreasePct'].includes(key)} onChange={event => change({ [key]: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>)}
        <label>Start date<input required className={input} type="date" value={terms.startDate} onChange={event => change({ startDate: event.target.value })} /></label>
        <label>Delivery recipient<select className={input} value={terms.deliveryRecipient || ''} required onChange={event => change({ deliveryRecipient: event.target.value as AgreementTerms['deliveryRecipient'] })}><option value="">Choose recipient</option><option>Owner</option><option>Tenant</option></select></label>
      </div>
      <h3 className="text-lg font-bold">Package options{correctionMode ? ' (locked)' : ''}</h3>
      <fieldset disabled={correctionMode}>
      <div className="grid gap-4 sm:grid-cols-3"><label>Stamp denomination<select className={input} value={terms.stampPaperDenomination ?? 100} onChange={event => change({ stampPaperDenomination: Number(event.target.value) as 100 | 200 })}><option value={100}>₹100 stamp paper</option><option value={200}>₹200 stamp paper</option></select></label><label>Notary<select className={input} value={terms.includeNotary ? 'yes' : 'no'} onChange={event => change({ includeNotary: event.target.value === 'yes' })}><option value="no">Without notary</option><option value="yes">Include notary</option></select></label><label>Delivery region<select className={input} value={terms.deliveryLocation || ''} required onChange={event => change({ deliveryLocation: event.target.value as AgreementTerms['deliveryLocation'] })}><option value="">Choose region</option><option>Within Chennai</option><option>Within Tamil Nadu</option></select></label></div>
        <ExtraCopiesField value={terms.extraCopies} stamp={terms.stampPaperDenomination} onChange={extraCopies => change({ extraCopies })} />
    </fieldset>
      {correctionMode && <p className="text-sm text-stone-600">Stamp denomination, notary, delivery region and copy quantity are locked. Use Modify / Replace Order from My Orders for package changes.</p>}
      <p className="text-sm text-stone-500">The delivery region must match the selected recipient&apos;s address.{!correctionMode && ' Any existing coupon discount is carried forward, capped at the revised package price.'}</p>
      {quote && <div className="space-y-4 rounded-xl border border-brand-200 bg-brand-50 p-5"><h3 className="font-bold">Review your changes</h3><dl className="grid gap-3 sm:grid-cols-2">{[['Package total', quote.subtotal], ['Existing coupon discount', quote.discount], ['Revised total', quote.total], ['Already paid (including credits)', quote.alreadyPaid], ['Additional payment', quote.due]].map(([label, amount]) => <div key={label}><dt className="text-sm text-stone-600">{label}</dt><dd className="font-bold">₹{Number(amount).toLocaleString('en-IN')}</dd></div>)}</dl>
        {reviewRequired ? <p className="text-sm">Preparation has begun. Your proposed changes will be sent to admin review. No payment or replacement is processed until the team reviews your request.</p> : <p className="text-sm">{quote.due > 0 ? 'Only the additional payment will be collected through PhonePe.' : 'No price change. Save changes to this same order and return it for verification. Your order ID and payment stay unchanged.'}</p>}
      </div>}
      {error && <div role="alert" className="space-y-2 text-rose-700"><p>{error}</p><a href="/my-orders" className="text-sm font-semibold underline">{correctionMode ? 'Return to My Orders to reopen the latest correction request' : 'Return to My Orders to resume or check a pending replacement'}</a></div>}
      <div className="flex flex-wrap gap-3"><button className="rounded-xl bg-brand-700 px-5 py-3 font-semibold text-white" type="submit">{busy ? 'Please wait...' : correctionMode ? 'Correct & Resubmit' : !quote ? 'Review Revised Total' : reviewRequired ? 'Send Changes for Admin Review' : quote.due > 0 ? `Confirm & Pay ₹${quote.due.toLocaleString('en-IN')}` : 'Save Changes'}</button><button type="button" onClick={onCancel} className="rounded-xl border px-5 py-3">Cancel</button></div>
    </fieldset>
    {submitted && <div role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-900">Your proposed changes have been sent for admin review. The original order remains unchanged.<button type="button" onClick={onCancel} className="ml-3 font-semibold underline">Back to My Orders</button></div>}
  </form>;
}
