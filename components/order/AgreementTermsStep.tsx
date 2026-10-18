'use client';

import React, { useEffect, useState } from 'react';
import { FileText, IndianRupee, Calendar, Truck, Stamp, CheckCircle2 } from 'lucide-react';
import { AgreementTerms } from '@/lib/types';
import { ExtraCopiesField } from './ExtraCopiesField';
import { DEFAULT_PRICING, PricingConfig, calculateOrderPrice } from '@/src/config/pricing';
import { getPricingConfig } from '@/lib/pricing-service';
import { detectCourierRegion } from '@/lib/pincode-utils';
import { amountInWords } from '@/lib/number-to-words';
import { CalendarDateInput } from './CalendarDateInput';

function AmountInWords({ id, amount }: { id: string; amount: number | undefined }) {
  const words = amount === 0 ? 'Zero Rupees' : amountInWords(amount);
  return <p id={id} aria-live="polite" aria-atomic="true" className="mt-1.5 min-h-5 text-xs font-medium leading-5 text-brand-800">{words ? `${words} only` : ''}</p>;
}

interface AgreementTermsStepProps {
  data: Partial<AgreementTerms>;
  onChange: (fields: Partial<AgreementTerms>) => void;
  errors: Record<string, string>;
  ownerAddress?: string;
  ownerPincode?: string;
  ownerName?: string;
  tenantAddress?: string;
  tenantPincode?: string;
  tenantName?: string;
  propertyType?: string;
}

export const AgreementTermsStep: React.FC<AgreementTermsStepProps> = ({
  data,
  onChange,
  errors,
  ownerAddress,
  ownerPincode,
  ownerName,
  tenantAddress,
  tenantPincode,
  tenantName,
  propertyType,
}) => {
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>(DEFAULT_PRICING);

  const [pricingState, setPricingState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let isMounted = true;
    getPricingConfig()
      .then((cfg) => {
        if (isMounted) { setPricingConfig(cfg); setPricingState('ready'); }
      })
      .catch(() => { if (isMounted) setPricingState('error'); });
    return () => {
      isMounted = false;
    };
  }, []);

  const isLease = data.agreementType === 'Lease';
  const stampPaper = data.stampPaperDenomination === 200 ? 200 : 100;
  const selectedDeliveryAddress = data.deliveryRecipient === 'Owner'
    ? ownerAddress
    : data.deliveryRecipient === 'Tenant'
      ? tenantAddress
      : undefined;
  const selectedPincode = data.deliveryRecipient === 'Owner' ? ownerPincode : data.deliveryRecipient === 'Tenant' ? tenantPincode : undefined;
  const detectedDeliveryLocation = selectedPincode && /^6\d{5}$/.test(selectedPincode) ? detectCourierRegion({ pincode: selectedPincode }) : null;
  const location = detectedDeliveryLocation ?? data.deliveryLocation ?? 'Within Chennai';
  const hasNotary = Boolean(data.includeNotary);

  useEffect(() => {
    if (
      detectedDeliveryLocation &&
      detectedDeliveryLocation !== data.deliveryLocation
    ) {
      onChange({ deliveryLocation: detectedDeliveryLocation });
    }
  }, [data.deliveryLocation, detectedDeliveryLocation, onChange]);

  const priceBreakdown = calculateOrderPrice(pricingConfig, stampPaper, location, hasNotary, data.extraCopies);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="border-b border-stone-200 pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-900">Step 4: Tenancy Agreement Terms & Stamping</h2>
            <p className="text-xs text-stone-500">
              Provide financial terms and choose your stamp paper denomination, delivery zone, and notary preference.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="terms-agreementType" className="block text-sm font-bold text-stone-700">Agreement type</label>
        <select id="terms-agreementType" value={data.agreementType || 'Rental'} onChange={event => {
          const agreementType = event.target.value as 'Rental' | 'Lease';
          onChange({ agreementType, language: 'English', monthlyRent: agreementType === 'Lease' ? 0 : undefined, rentIncreasePct: agreementType === 'Lease' ? 0 : 5, noticePeriodDays: agreementType === 'Lease' ? 90 : 30 });
        }} className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm">
          <option value="Rental">Rental Agreement - monthly rent</option>
          <option value="Lease">Residential Lease Agreement - refundable advance</option>
        </select>
        {isLease && <p className="text-sm text-stone-600">English lease for a house or flat. No separate monthly rent; interest on the refundable advance is treated as rent. Both ₹100 and ₹200 stamp options use the existing package prices. Review all clauses before payment.</p>}
        {errors.agreementType && <p role="alert" className="text-xs text-rose-700">{errors.agreementType}</p>}
      </div>

      <div className="space-y-2">
        <label htmlFor="terms-language" className="block text-sm font-bold text-stone-700">Agreement language / ஒப்பந்த மொழி</label>
        <select id="terms-language" disabled={isLease} value={data.language || 'English'} onChange={event => onChange({ language: event.target.value as 'English' | 'Tamil', ...(event.target.value === 'Tamil' && propertyType !== 'Commercial Shop' ? { paintingDeduction: data.paintingDeduction ?? 5000 } : {}) })} aria-describedby="terms-language-help" className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm">
          <option value="English">English</option>
          <option value="Tamil">தமிழ் (Tamil)</option>
        </select>
        <p id="terms-language-help" className="text-xs leading-relaxed text-stone-600">{propertyType === 'Commercial Shop' ? 'Tamil uses the shop rental agreement and the business name entered in Step 3. ' : ''}Names and addresses appear exactly as entered. Enter them in Tamil if you want Tamil text; they are not automatically translated.</p>
        {errors.language && <p role="alert" className="text-xs text-rose-700">{errors.language}</p>}
        {data.language === 'Tamil' && propertyType !== 'Commercial Shop' && <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3"><label htmlFor="terms-paintingDeduction" className="block text-sm font-bold text-stone-700">Painting deduction on vacating (₹)</label><input id="terms-paintingDeduction" type="number" min="0" max="1000000000" step="0.01" required value={data.paintingDeduction ?? ''} onChange={event => onChange({ paintingDeduction: event.target.value === '' ? undefined : Number(event.target.value) })} className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" aria-describedby="painting-deduction-help" /><p id="painting-deduction-help" className="text-xs leading-relaxed text-stone-600">Deducted from the deposit on vacating; enter 0 for none. All amounts, tenure, due date and notice period follow your form values. Review the draft before payment.</p>{errors.paintingDeduction && <p role="alert" className="text-xs text-rose-700">{errors.paintingDeduction}</p>}</div>}
        {data.language === 'Tamil' && propertyType === 'Commercial Shop' && <p className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800">Selected template: கடை வாடகை ஒப்பந்தப் பத்திரம் (Tamil shop rental agreement). Rent, deposit, duration and notice period follow your form values.</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 items-start gap-x-5 gap-y-5">
        {/* Monthly Rent */}
        {!isLease && <div>
          <label htmlFor="terms-monthlyRent" className="block text-xs font-bold text-stone-700 mb-1">
            Monthly Rent (₹) *
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-2.5 text-stone-400 text-sm font-semibold">₹</span>
            <input
              id="terms-monthlyRent"
              type="number"
              inputMode="numeric"
              min="500"
              required
              value={data.monthlyRent ?? ''}
              onChange={(e) =>
                onChange({ monthlyRent: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="e.g. 15000"
              aria-invalid={!!errors.monthlyRent}
              aria-describedby={`terms-monthlyRent-words${errors.monthlyRent ? ' terms-monthlyRent-error' : ''}`}
              className={`w-full pl-8 pr-3.5 py-2.5 rounded-xl border text-sm text-stone-900 focus:outline-none focus:ring-2 ${
                errors.monthlyRent
                  ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-400'
                  : 'border-stone-300 bg-white focus:ring-amber-500'
              }`}
            />
          </div>
          <AmountInWords id="terms-monthlyRent-words" amount={data.monthlyRent} />
          {errors.monthlyRent && (
            <p id="terms-monthlyRent-error" className="text-xs text-rose-600 mt-1">
              {errors.monthlyRent}
            </p>
          )}
        </div>}
        {/* Security Deposit */}
        <div>
          <label htmlFor="terms-securityDeposit" className="block text-xs font-bold text-stone-700 mb-1">
            {isLease ? 'Refundable Lease Advance' : 'Security Advance / Deposit'} (₹) *
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-2.5 text-stone-400 text-sm font-semibold">₹</span>
            <input
              id="terms-securityDeposit"
              type="number"
              inputMode="numeric"
              min="0"
              required
              value={data.securityDeposit ?? ''}
              onChange={(e) =>
                onChange({ securityDeposit: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="e.g. 100000"
              aria-invalid={!!errors.securityDeposit}
              aria-describedby={`terms-securityDeposit-words${errors.securityDeposit ? ' terms-securityDeposit-error' : ''}`}
              className={`w-full pl-8 pr-3.5 py-2.5 rounded-xl border text-sm text-stone-900 focus:outline-none focus:ring-2 ${
                errors.securityDeposit
                  ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-400'
                  : 'border-stone-300 bg-white focus:ring-amber-500'
              }`}
            />
          </div>
          <AmountInWords id="terms-securityDeposit-words" amount={data.securityDeposit} />
          {errors.securityDeposit && (
            <p id="terms-securityDeposit-error" className="text-xs text-rose-600 mt-1">
              {errors.securityDeposit}
            </p>
          )}
        </div>

        {/* Maintenance Charges */}
        <div>
          <label htmlFor="terms-maintenance" className="block text-xs font-bold text-stone-700 mb-1">
            Monthly Maintenance Charges (₹)
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-2.5 text-stone-400 text-sm font-semibold">₹</span>
            <input
              id="terms-maintenance"
              type="number"
              inputMode="numeric"
              min="0"
              value={data.maintenanceCharges ?? 0}
              onChange={(e) =>
                onChange({ maintenanceCharges: e.target.value ? Number(e.target.value) : 0 })
              }
              placeholder="0 if included in rent"
              aria-describedby="terms-maintenance-words"
              className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <AmountInWords id="terms-maintenance-words" amount={data.maintenanceCharges ?? 0} />
        </div>

        {/* Agreement Start Date */}
        <div>
          <label htmlFor="terms-startDate" className="block text-xs font-bold text-stone-700 mb-1">
            Agreement Commencement Date *
          </label>
          <CalendarDateInput id="terms-startDate" value={data.startDate || ''} onChange={startDate => onChange({ startDate })} error={errors.startDate} />
        </div>

        {/* Notice Period */}
        <div>
          <label htmlFor="terms-noticePeriod" className="block text-xs font-bold text-stone-700 mb-1">
            Notice Period (Days) *
          </label>
          <select
            id="terms-noticePeriod"
            required
            value={data.noticePeriodDays || 30}
            onChange={(e) => onChange({ noticePeriodDays: Number(e.target.value) })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value={30}>30 Days (1 Month Notice)</option>
            <option value={60}>60 Days (2 Months Notice)</option>
            <option value={90}>90 Days (3 Months Notice)</option>
          </select>
        </div>

        {/* Rent Payment Due Day */}
        {!isLease && <div>
          <label htmlFor="terms-dueDay" className="block text-xs font-bold text-stone-700 mb-1">
            Monthly Rent Due Day *
          </label>
          <select
            id="terms-dueDay"
            value={data.paymentDueDay || 5}
            onChange={(e) => onChange({ paymentDueDay: Number(e.target.value) })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value={1}>On or before 1st of every month</option>
            <option value={5}>On or before 5th of every month (Standard)</option>
            <option value={7}>On or before 7th of every month</option>
            <option value={10}>On or before 10th of every month</option>
            <option value={15}>On or before 15th of every month</option>
          </select>
        </div>}
        {/* Annual Rent Escalation % */}
        {!isLease && <div className="sm:col-span-2">
          <label htmlFor="terms-escalation" className="block text-xs font-bold text-stone-700 mb-1">
            Annual Rent Increase Clause (%) *
          </label>
          <select
            id="terms-escalation"
            required
            value={data.rentIncreasePct ?? 5}
            onChange={(e) => onChange({ rentIncreasePct: Number(e.target.value) })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value={0}>0% (Fixed Rent upon renewal)</option>
            <option value={5}>5% standard annual increase</option>
            <option value={10}>10% standard annual increase</option>
            <option value={15}>15% annual increase</option>
          </select>
        </div>}
        <div><label htmlFor="terms-tenure" className="block text-xs font-bold text-stone-700 mb-1">Agreement duration (months) *</label><input id="terms-tenure" type="number" min="1" max="120" required value={data.tenureMonths ?? ''} onChange={event => onChange({ tenureMonths: event.target.value === '' ? undefined : Number(event.target.value) })} className="min-h-11 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />{errors.tenureMonths && <p role="alert" className="text-xs text-rose-700">{errors.tenureMonths}</p>}</div>
        {/* ================= PACKAGE AND DELIVERY OPTIONS ================= */}
        <div className="sm:col-span-2 pt-4 border-t border-stone-200">
          <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/70 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-200/60 px-2.5 py-0.5 rounded-full">
                  Official Stamping & Delivery Selection
                </span>
                <h3 className="font-bold text-stone-900 text-sm mt-1">
                  Choose Delivery Address, Stamp Paper, Courier Region & Notary Signature
                </h3>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100/90 px-3 py-1.5 rounded-xl shrink-0 border border-emerald-300 shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Total: ₹{priceBreakdown.totalPayable}/-</span>
                <span className="text-[10px] font-normal text-emerald-700">(All inclusive)</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 items-start gap-x-5 gap-y-5">
              {/* Dropdown 1: Delivery Recipient */}
              <div>
                <label htmlFor="terms-deliveryRecipient" className="block text-xs font-bold text-stone-800 mb-1">
                  1. Deliver To *
                </label>
                <select
                  id="terms-deliveryRecipient"
                  value={data.deliveryRecipient || ''}
                  onChange={(e) => {
                    const deliveryRecipient = e.target.value as 'Owner' | 'Tenant';
                    const pincode = deliveryRecipient === 'Owner' ? ownerPincode : tenantPincode;
                    const deliveryLocation = pincode && /^6\d{5}$/.test(pincode) ? detectCourierRegion({ pincode }) : null;
                    onChange({
                      deliveryRecipient,
                      ...(deliveryLocation ? { deliveryLocation } : {}),
                    });
                  }}
                  aria-invalid={!!errors.deliveryRecipient}
                  aria-describedby={errors.deliveryRecipient ? 'terms-deliveryRecipient-error' : undefined}
                  className={`w-full min-h-11 px-3 py-2.5 rounded-xl border bg-white text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer ${
                    errors.deliveryRecipient ? 'border-rose-400' : 'border-stone-300'
                  }`}
                >
                  <option value="">Select recipient</option>
                  <option value="Owner">Property owner{ownerName ? ` — ${ownerName}` : ''}</option>
                  <option value="Tenant">Tenant{tenantName ? ` — ${tenantName}` : ''}</option>
                </select>
                {selectedDeliveryAddress && (
                  <p className="text-[11px] text-stone-600 mt-1 truncate" title={selectedDeliveryAddress}>
                    {selectedDeliveryAddress}{selectedPincode ? ` - ${selectedPincode}` : ''}
                  </p>
                )}
                {errors.deliveryRecipient && (
                  <p id="terms-deliveryRecipient-error" className="text-xs text-rose-600 mt-1">
                    {errors.deliveryRecipient}
                  </p>
                )}
              </div>

              {/* Dropdown 2: Stamp Paper Denomination */}
              <div>
                <label htmlFor="terms-stampPaper" className="block text-xs font-bold text-stone-800 mb-1">
                  2. Stamp Paper *
                </label>
                <select
                  id="terms-stampPaper"
                  value={stampPaper}
                  onChange={(e) =>
                    onChange({ stampPaperDenomination: Number(e.target.value) as 100 | 200 })
                  }
                  className="w-full min-h-11 px-3 py-2.5 rounded-xl border border-stone-300 bg-white text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  <option value={100}>In ₹100 Stamp Paper</option>
                  <option value={200}>In ₹200 Stamp Paper</option>
                </select>
              </div>

              {/* Dropdown 3: Delivery Location */}
              <div>
                <label htmlFor="terms-deliveryLocation" className="block text-xs font-bold text-stone-800 mb-1">
                  3. Courier Region
                </label>
                <div
                  id="terms-deliveryLocation"
                  aria-live="polite"
                  className="w-full min-h-11 px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-100 text-xs font-semibold text-stone-700"
                >
                  {selectedDeliveryAddress && !detectedDeliveryLocation
                    ? 'PIN required'
                    : detectedDeliveryLocation || 'Select delivery recipient'}
                </div>
              </div>

              {/* Dropdown 4: Notary Signature */}
              <div>
                <label htmlFor="terms-notary" className="flex min-h-11 items-center gap-2.5 cursor-pointer text-xs font-semibold text-stone-800">
                  <input
                    id="terms-notary"
                    type="checkbox"
                    checked={hasNotary}
                    onChange={(e) => onChange({ includeNotary: e.target.checked })}
                    aria-describedby="terms-notary-description"
                    className="h-4 w-4 shrink-0 rounded border-stone-300 accent-amber-600 focus:ring-2 focus:ring-amber-500"
                  />
                  <span>4. Include Notary Signature (+₹{pricingConfig.notaryExtraFee})</span>
                </label>
                <p id="terms-notary-description" className="text-[11px] text-stone-500 mt-1">
                  {hasNotary ? 'Advocate notary attestation and seal added.' : 'Optional advocate notary attestation.'}
                </p>
              </div>
            </div>

            <ExtraCopiesField value={data.extraCopies} stamp={stampPaper} onChange={extraCopies => onChange({ extraCopies })} />
            {/* Price Transparency Live Summary */}
            <div className="bg-white rounded-xl p-3 border border-amber-200/90 text-xs flex flex-wrap items-center justify-between gap-2 shadow-2xs">
              <div className="text-stone-700">
                Package: <strong>In ₹{stampPaper} stamp paper</strong> ({location})
                {hasNotary ? (
                  <span className="text-amber-800 font-semibold"> + With notary signature</span>
                ) : (
                  <span className="text-stone-500"> (No notary)</span>
                )}
              </div>
              <div className="font-mono text-stone-900 font-bold text-sm">
                Total: <span className="text-emerald-700">₹{priceBreakdown.totalPayable}/-</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
