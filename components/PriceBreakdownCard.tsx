'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Truck, FileText, CheckCircle2, Award } from 'lucide-react';
import { DEFAULT_PRICING, PricingConfig, calculateOrderPrice } from '@/src/config/pricing';
import { getPricingConfig } from '@/lib/pricing-service';

interface PriceBreakdownCardProps {
  onStartOrder?: () => void;
  showCta?: boolean;
}

export const PriceBreakdownCard: React.FC<PriceBreakdownCardProps> = ({
  onStartOrder,
  showCta = true,
}) => {
  const [pricing, setPricing] = useState<PricingConfig>(DEFAULT_PRICING);
  const [pricingReady, setPricingReady] = useState(false);
  const [pricingError, setPricingError] = useState(false);
  const [stampPaper, setStampPaper] = useState<100 | 200>(100);
  const [location, setLocation] = useState<'Within Chennai' | 'Within Tamil Nadu'>('Within Chennai');
  const [includeNotary, setIncludeNotary] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    getPricingConfig()
      .then((cfg) => {
        if (isMounted) { setPricing(cfg); setPricingReady(true); }
      })
      .catch(() => { if (isMounted) setPricingError(true); });
    return () => {
      isMounted = false;
    };
  }, []);

  const breakdown = calculateOrderPrice(pricing, stampPaper, location, includeNotary);
  const stampFaceValue = stampPaper;
  const estimatedCourier = location === 'Within Chennai' ? 50 : 100;
  const draftingFee = Math.max(0, breakdown.basePackagePrice - stampFaceValue - estimatedCourier);

  if (!pricingReady) return (
    <div className="rounded-3xl border border-stone-200 bg-white p-6 text-sm text-stone-700" role={pricingError ? 'alert' : 'status'}>
      {pricingError ? 'Pricing is unavailable. Please refresh or try again later.' : 'Loading current pricing?'}
    </div>
  );

  return (
    <div className="bg-white border border-stone-200/90 rounded-3xl shadow-sm overflow-hidden">
      {/* Header Badge */}
      <div className="bg-stone-900 text-stone-100 px-6 py-5 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-black text-white">Rental Agreement Drafting & Stamping</h3>
        </div>
        <div className="text-right">
          <span className="text-xl sm:text-2xl font-black text-brand-600">₹{breakdown.totalPayable}/-</span>
          <span className="block text-xs text-stone-400">All inclusive with courier</span>
        </div>
      </div>

      {/* Interactive package options */}
      <div className="p-6 bg-brand-50/40 border-b border-brand-100/80">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
            Select Your Package Options
          </h4>
          <span className="shrink-0 text-xs text-brand-800 font-semibold bg-brand-100 px-2.5 py-1 rounded-full">
            Live Pricing
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Dropbox 1: Stamp Paper Denomination */}
          <div className="min-w-0">
            <label htmlFor="card-stampPaper" className="block text-sm font-bold text-stone-700 mb-2">
              1. Stamp Paper
            </label>
            <select
              id="card-stampPaper"
              value={stampPaper}
              onChange={(e) => setStampPaper(Number(e.target.value) as 100 | 200)}
              className="h-12 w-full min-w-0 px-3 rounded-xl border border-stone-300 bg-white text-sm font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              <option value={100}>₹100 Stamp Paper</option>
              <option value={200}>₹200 Stamp Paper</option>
            </select>
            
          </div>

          {/* Dropbox 2: Courier Region */}
          <div className="min-w-0">
            <label htmlFor="card-deliveryLocation" className="block text-sm font-bold text-stone-700 mb-2">
              2. Courier Destination
            </label>
            <select
              id="card-deliveryLocation"
              value={location}
              onChange={(e) => setLocation(e.target.value as 'Within Chennai' | 'Within Tamil Nadu')}
              className="h-12 w-full min-w-0 px-3 rounded-xl border border-stone-300 bg-white text-sm font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              <option value="Within Chennai">
                Chennai (₹{stampPaper === 100 ? pricing.stamp100Chennai : pricing.stamp200Chennai}/-)
              </option>
              <option value="Within Tamil Nadu">
                Tamil Nadu (₹{stampPaper === 100 ? pricing.stamp100TamilNadu : pricing.stamp200TamilNadu}/-)
              </option>
            </select>
          
          </div>

          {/* Option 3: Notary Signature */}
          <div className="sm:col-span-2">
            <label htmlFor="card-notary" className="flex items-start gap-3 rounded-xl border border-stone-300 bg-white p-4 cursor-pointer focus-within:ring-2 focus-within:ring-amber-500">
              <input
                id="card-notary"
                type="checkbox"
                checked={includeNotary}
                onChange={(e) => setIncludeNotary(e.target.checked)}
                aria-describedby="card-notary-description"
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-stone-300 accent-amber-600"
              />
              <span className="min-w-0">
                <span className="block text-sm font-bold leading-5 text-stone-700">
                  3. Include Notary Signature <span className="inline-block whitespace-nowrap">(+₹{pricing.notaryExtraFee})</span>
                </span>
                <span id="card-notary-description" className="mt-1 block text-xs leading-5 text-stone-500">
                  Advocate Notary attestation and seal (Optional)
                </span>
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Breakdown Items */}
      <div className="p-6 divide-y divide-stone-100">
        {/* 1. Stamp Duty */}
        <div className="py-3.5 flex items-start justify-between gap-4 first:pt-0">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-brand-50 text-brand-800 rounded-xl shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-stone-900 text-sm">Government Non-Judicial Stamp Paper</h4>
              <p className="text-xs text-stone-500 mt-0.5">
                Physical non-judicial stamp paper face value (₹{stampPaper})
              </p>
            </div>
          </div>
          <span className="font-bold text-brand-800 text-xs sm:text-sm shrink-0 bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-200/80">
            ₹{stampFaceValue}
          </span>
        </div>

        {/* 2. Service Fee */}
        <div className="py-3.5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-brand-50 text-brand-800 rounded-xl shrink-0 mt-0.5">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-stone-900 text-sm">Drafting & Printing Service</h4>
              <p className="text-xs text-stone-500 mt-0.5">
                Tamil Nadu standard legal format drafting and physical printing on stamp paper
              </p>
            </div>
          </div>
          <span className="font-semibold text-stone-800 text-xs sm:text-sm shrink-0">
            ₹{draftingFee}
          </span>
        </div>

        {/* 3. Courier Charge */}
        <div className="py-3.5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-brand-50 text-brand-800 rounded-xl shrink-0 mt-0.5">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-stone-900 text-sm">Courier Charges ({location})</h4>
              <p className="text-xs text-stone-500 mt-0.5">
                Courier delivery with dispatch tracking
              </p>
            </div>
          </div>
          <span className="font-semibold text-stone-800 text-xs sm:text-sm shrink-0">
            ₹{estimatedCourier}
          </span>
        </div>

        {/* 4. Notary Fee if selected */}
        {includeNotary && (
          <div className="py-3.5 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-brand-50 text-brand-800 rounded-xl shrink-0 mt-0.5">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-stone-900 text-sm">Notary Public Signature & Seal</h4>
                <p className="text-xs text-stone-500 mt-0.5">
                  Official verification, signing, and red seal endorsement by practicing Advocate Notary Public
                </p>
              </div>
            </div>
            <span className="font-bold text-brand-800 text-xs sm:text-sm shrink-0 bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-200">
              ₹{breakdown.notaryFee}
            </span>
          </div>
        )}

        {/* Total Summary */}
        <div className="pt-4 flex items-center justify-between">
          <div>
            <span className="text-sm font-extrabold text-stone-900">Total Payable Package</span>
            <span className="block text-xs text-stone-500">
              In Rs.{stampPaper} stamp paper ({location} with courier){includeNotary ? ' + Notary signature' : ''}
            </span>
          </div>
          <div className="text-right">
            <span className="text-xl sm:text-2xl font-black text-brand-800">₹{breakdown.totalPayable}/-</span>
          </div>
        </div>
      </div>

      {/* Feature bullets */}
      <div className="bg-stone-50 px-6 py-5 border-t border-stone-200/80 space-y-2.5">
        <div className="flex items-center gap-2 text-xs text-stone-700 font-medium">
          <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
          <span>Tamil Nadu non-judicial stamp paper</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-stone-700 font-medium">
          <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
          <span>1 physical original copy printed on genuine stamp paper</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-stone-700 font-medium">
          <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
          <span>Courier dispatch with tracking ID</span>
        </div>

        {showCta && (
          <div className="pt-3">
            {onStartOrder ? (
              <button
                onClick={onStartOrder}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer"
              >
                <FileText className="w-4 h-4 text-white" />
                <span>Start Your Agreement (₹{breakdown.totalPayable}/-)</span>
              </button>
            ) : (
              <Link
                href="/order"
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider text-center"
              >
                <FileText className="w-4 h-4 text-white" />
                <span>Start Your Agreement (₹{breakdown.totalPayable}/-)</span>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
