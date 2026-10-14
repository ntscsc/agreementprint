'use client';

import React from 'react';
import { Home, CheckCircle2 } from 'lucide-react';
import { PropertyDetails } from '@/lib/types';
import { isChennaiPincode } from '@/lib/pincode-utils';

interface PropertyStepProps {
  data: Partial<PropertyDetails>;
  onChange: (fields: Partial<PropertyDetails>) => void;
  errors: Record<string, string>;
}

export const PropertyStep: React.FC<PropertyStepProps> = ({ data, onChange, errors }) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="border-b border-stone-200 pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
            <Home className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-900">Step 3: Rental Premises (Property) Details</h2>
            <p className="text-xs text-stone-500">Specify the premises in Tamil Nadu being rented out under this agreement.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Property Type */}
        <div>
          <label htmlFor="property-type" className="block text-xs font-bold text-stone-700 mb-1">
            Property Type *
          </label>
          <select
            id="property-type"
            required
            value={data.propertyType || 'Flat'}
            onChange={(e) => onChange({ propertyType: e.target.value as PropertyDetails['propertyType'] })}
            aria-invalid={!!errors.propertyType}
            aria-describedby={errors.propertyType ? 'property-type-error' : undefined}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-stone-900 focus:outline-none focus:ring-2 bg-white ${
              errors.propertyType
                ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-400'
                : 'border-stone-300 focus:ring-amber-500'
            }`}
          >
            <option value="Flat">Residential Apartment / Flat</option>
            <option value="House">Independent House / Villa</option>
            <option value="Commercial Shop">Commercial Office / Shop</option>
          </select>
          {errors.propertyType && <p id="property-type-error" className="text-xs text-rose-600 mt-1">{errors.propertyType}</p>}
        </div>

        {/* Furnishing Status */}
        <div>
          <label htmlFor="property-furnishing" className="block text-xs font-bold text-stone-700 mb-1">
            Furnishing Status *
          </label>
          <select
            id="property-furnishing"
            required
            value={data.furnishing || 'Semi-Furnished'}
            onChange={(e) => onChange({ furnishing: e.target.value as PropertyDetails['furnishing'] })}
            aria-invalid={!!errors.furnishing}
            aria-describedby={errors.furnishing ? 'property-furnishing-error' : undefined}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-stone-900 focus:outline-none focus:ring-2 bg-white ${
              errors.furnishing
                ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-400'
                : 'border-stone-300 focus:ring-amber-500'
            }`}
          >
            <option value="Unfurnished">Unfurnished</option>
            <option value="Semi-Furnished">Semi-Furnished</option>
            <option value="Fully Furnished">Fully Furnished</option>
          </select>
          {errors.furnishing && <p id="property-furnishing-error" className="text-xs text-rose-600 mt-1">{errors.furnishing}</p>}
        </div>

        {/* Business Name (appears when Commercial is selected) */}
        {data.propertyType === 'Commercial Shop' && (
          <div className="sm:col-span-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <label htmlFor="property-businessName" className="block text-xs font-bold text-stone-700 mb-1">
              Business / Commercial Enterprise Name *
            </label>
            <input
              id="property-businessName"
              type="text"
              required
              value={data.businessName || ''}
              onChange={(e) => onChange({ businessName: e.target.value })}
              placeholder="e.g. Sri Balaji Enterprises / Nexus Infotech"
              aria-invalid={!!errors.businessName}
              aria-describedby={errors.businessName ? 'property-businessName-error' : undefined}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-stone-900 focus:outline-none focus:ring-2 bg-white ${
                errors.businessName
                  ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-400'
                  : 'border-stone-300 focus:ring-amber-500'
              }`}
            />
            {errors.businessName && (
              <p id="property-businessName-error" className="text-xs text-rose-600 mt-1">
                {errors.businessName}
              </p>
            )}
            <p className="text-[11px] text-stone-500 mt-1">
              Specify the commercial firm, retail shop, or trade name to be operated on these premises.
            </p>
          </div>
        )}

        {/* City / Taluk */}
        <div>
          <label htmlFor="property-city" className="block text-xs font-bold text-stone-700 mb-1">
            City / Taluk (Tamil Nadu) *
          </label>
          <input
            id="property-city"
            type="text"
            required
            value={data.city || ''}
            onChange={(e) => onChange({ city: e.target.value })}
            placeholder="e.g. Chennai, Madurai, Coimbatore..."
            aria-invalid={!!errors.city}
            aria-describedby={errors.city ? 'property-city-error' : undefined}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-stone-900 focus:outline-none focus:ring-2 ${
              errors.city
                ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-400'
                : 'border-stone-300 bg-white focus:ring-amber-500'
            }`}
          />
          {errors.city && <p id="property-city-error" className="text-xs text-rose-600 mt-1">{errors.city}</p>}
        </div>

        {/* Pincode */}
        <div>
          <label htmlFor="property-pincode" className="block text-xs font-bold text-stone-700 mb-1">
            PIN Code *
          </label>
          <input
            id="property-pincode"
            type="text"
            inputMode="numeric"
            maxLength={6}
            required
            value={data.pincode || ''}
            onChange={(e) => onChange({ pincode: e.target.value.replace(/[^0-9]/g, '') })}
            placeholder="e.g. 600028"
            aria-invalid={!!errors.pincode}
            aria-describedby={errors.pincode ? 'property-pincode-error' : undefined}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-stone-900 focus:outline-none focus:ring-2 ${
              errors.pincode
                ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-400'
                : 'border-stone-300 bg-white focus:ring-amber-500'
            }`}
          />
          {errors.pincode && <p id="property-pincode-error" className="text-xs text-rose-600 mt-1">{errors.pincode}</p>}
          {!errors.pincode && data.pincode && data.pincode.length === 6 && (
            <p className="text-[11px] text-stone-600 font-medium mt-1">
              {isChennaiPincode(data.pincode) ? 'Chennai, Tamilnadu' : 'Tamilnadu, India'}
            </p>
          )}
        </div>

        {/* Full Property Premises Address */}
        <div className="sm:col-span-2">
          <label htmlFor="property-fullAddress" className="block text-xs font-bold text-stone-700 mb-1">
            Full Premises Address (to appear on Stamp Paper) *
          </label>
          <textarea
            id="property-fullAddress"
            rows={3}
            required
            value={data.fullAddress || ''}
            onChange={(e) => onChange({ fullAddress: e.target.value })}
            placeholder="Complete premises address including Flat No., Building Name, Door No., Street, Locality, and Landmark"
            aria-invalid={!!errors.fullAddress}
            aria-describedby={errors.fullAddress ? 'property-fullAddress-error' : undefined}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-stone-900 focus:outline-none focus:ring-2 ${
              errors.fullAddress
                ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-400'
                : 'border-stone-300 bg-white focus:ring-amber-500'
            }`}
          />
          {errors.fullAddress && <p id="property-fullAddress-error" className="text-xs text-rose-600 mt-1">{errors.fullAddress}</p>}
        </div>
      </div>
    </div>
  );
};
