'use client';

import React, { useEffect, useState } from 'react';
import { FileText, IndianRupee, Calendar, Truck, Stamp, CheckCircle2 } from 'lucide-react';
import { AgreementTerms } from '@/lib/types';
import { DEFAULT_PRICING, PricingConfig, calculateOrderPrice } from '@/src/config/pricing';
import { getPricingConfig } from '@/lib/pricing-service';
import { detectCourierRegion } from '@/lib/pincode-utils';

interface AgreementTermsStepProps {
  data: Partial<AgreementTerms>;
  onChange: (fields: Partial<AgreementTerms>) => void;
  errors: Record<string, string>;
  ownerAddress?: string;
  ownerName?: string;
  tenantAddress?: string;
  tenantName?: string;
}

export const AgreementTermsStep: React.FC<AgreementTermsStepProps> = ({
  data,
  onChange,
  errors,
  ownerAddress,
  ownerName,
  tenantAddress,
  tenantName,
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

  const stampPaper = data.stampPaperDenomination === 200 ? 200 : 100;
  const selectedDeliveryAddress = data.deliveryRecipient === 'Owner'
    ? ownerAddress
    : data.deliveryRecipient === 'Tenant'
      ? tenantAddress
      : undefined;
  const detectedDeliveryLocation = detectCourierRegion({ address: selectedDeliveryAddress });
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

  const priceBreakdown = calculateOrderPrice(pricingConfig, stampPaper, location, hasNotary);

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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Monthly Rent */}
        <div>
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
              aria-describedby={errors.monthlyRent ? 'terms-monthlyRent-error' : undefined}
              className={`w-full pl-8 pr-3.5 py-2.5 rounded-xl border text-sm text-stone-900 focus:outline-none focus:ring-2 ${
                errors.monthlyRent
                  ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-400'
                  : 'border-stone-300 bg-white focus:ring-amber-500'
              }`}
            />
          </div>
          {errors.monthlyRent && (
            <p id="terms-monthlyRent-error" className="text-xs text-rose-600 mt-1">
              {errors.monthlyRent}
            </p>
          )}
        </div>

        {/* Security Deposit */}
        <div>
          <label htmlFor="terms-securityDeposit" className="block text-xs font-bold text-stone-700 mb-1">
            Security Advance / Deposit (₹) *
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
              aria-describedby={errors.securityDeposit ? 'terms-securityDeposit-error' : undefined}
              className={`w-full pl-8 pr-3.5 py-2.5 rounded-xl border text-sm text-stone-900 focus:outline-none focus:ring-2 ${
                errors.securityDeposit
                  ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-400'
                  : 'border-stone-300 bg-white focus:ring-amber-500'
              }`}
            />
          </div>
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
              className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Agreement Start Date */}
        <div>
          <label htmlFor="terms-startDate" className="block text-xs font-bold text-stone-700 mb-1">
            Agreement Commencement Date *
          </label>
          <input
            id="terms-startDate"
            type="date"
            required
            value={data.startDate || ''}
            onChange={(e) => onChange({ startDate: e.target.value })}
            aria-invalid={!!errors.startDate}
            aria-describedby={errors.startDate ? 'terms-startDate-error' : undefined}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-stone-900 focus:outline-none focus:ring-2 ${
              errors.startDate
                ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-400'
                : 'border-stone-300 bg-white focus:ring-amber-500'
            }`}
          />
          {errors.startDate && (
            <p id="terms-startDate-error" className="text-xs text-rose-600 mt-1">
              {errors.startDate}
            </p>
          )}
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
        <div>
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
        </div>

        {/* Annual Rent Escalation % */}
        <div className="sm:col-span-2">
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
        </div>

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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
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
                    const address = deliveryRecipient === 'Owner' ? ownerAddress : tenantAddress;
                    const deliveryLocation = detectCourierRegion({ address });
                    onChange({
                      deliveryRecipient,
                      ...(deliveryLocation ? { deliveryLocation } : {}),
                    });
                  }}
                  aria-invalid={!!errors.deliveryRecipient}
                  aria-describedby={errors.deliveryRecipient ? 'terms-deliveryRecipient-error' : undefined}
                  className={`w-full px-3 py-2.5 rounded-xl border bg-white text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer ${
                    errors.deliveryRecipient ? 'border-rose-400' : 'border-stone-300'
                  }`}
                >
                  <option value="">Select recipient</option>
                  <option value="Owner">Property owner{ownerName ? ` — ${ownerName}` : ''}</option>
                  <option value="Tenant">Tenant{tenantName ? ` — ${tenantName}` : ''}</option>
                </select>
                {selectedDeliveryAddress && (
                  <p className="text-[11px] text-stone-600 mt-1 truncate" title={selectedDeliveryAddress}>
                    {selectedDeliveryAddress}
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
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  <option value={100}>In Rs.100 Stamp Paper</option>
                  <option value={200}>In Rs.200 Stamp Paper</option>
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
                  className="w-full min-h-10 px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-100 text-xs font-semibold text-stone-700"
                >
                  {selectedDeliveryAddress && !detectedDeliveryLocation
                    ? 'PIN required'
                    : detectedDeliveryLocation || 'Select delivery recipient'}
                </div>
              </div>

              {/* Dropdown 4: Notary Signature */}
              <div>
                <label htmlFor="terms-notary" className="flex min-h-10 items-center gap-2.5 cursor-pointer text-xs font-semibold text-stone-800">
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

            {/* Price Transparency Live Summary */}
            <div className="bg-white rounded-xl p-3 border border-amber-200/90 text-xs flex flex-wrap items-center justify-between gap-2 shadow-2xs">
              <div className="text-stone-700">
                Package: <strong>In Rs.{stampPaper} stamp paper</strong> ({location})
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
