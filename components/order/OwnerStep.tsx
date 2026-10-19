'use client';

import React from 'react';
import { UserCheck, Lock } from 'lucide-react';
import { PersonDetails } from '@/lib/types';

interface OwnerStepProps {
  data: Partial<PersonDetails>;
  onChange: (fields: Partial<PersonDetails>) => void;
  errors: Record<string, string>;
}

export const OwnerStep: React.FC<OwnerStepProps> = ({ data, onChange, errors }) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="border-b border-stone-200 pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-900">Owner details</h2>
            <p className="text-xs text-stone-500">Provide the exact legal name and details as shown on official identity records.</p>
          </div>
        </div>
      </div>

      <fieldset className="min-w-0 rounded-2xl border border-stone-200 p-3 sm:p-5">
        <legend className="px-2 text-sm font-bold text-stone-900">Personal & Contact Details</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 items-start gap-x-5 gap-y-5">
        {/* Full Name */}
        <div className="min-w-0">
          <label htmlFor="owner-fullName" className="block text-xs font-bold text-stone-700 mb-1">
            Owner Full Legal Name *
          </label>
          <input
            id="owner-fullName"
            type="text"
            required
            value={data.fullName || ''}
            onChange={(e) => onChange({ fullName: e.target.value })}
            placeholder="e.g. S. Ramanathan"
            aria-invalid={!!errors.fullName}
            aria-describedby={errors.fullName ? 'owner-fullName-error' : undefined}
            className={`w-full min-w-0 px-3.5 py-2.5 rounded-xl border text-sm text-stone-900 focus:outline-none focus:ring-2 ${
              errors.fullName
                ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-400'
                : 'border-stone-300 bg-white focus:ring-amber-500'
            }`}
          />
          {errors.fullName && <p id="owner-fullName-error" className="text-xs text-rose-600 mt-1">{errors.fullName}</p>}
        </div>

        <div>
          <label htmlFor="owner-relationship" className="mb-1 block text-xs font-bold text-stone-700">Relationship wording (optional)</label>
          <select id="owner-relationship" value={data.relationship || ''} onChange={event => onChange({ relationship: (event.target.value || undefined) as PersonDetails['relationship'] })} aria-invalid={!!errors.relationship} aria-describedby={errors.relationship ? 'owner-relationship-error' : undefined} className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:ring-2 focus:ring-amber-500">
            <option value="">Select relationship</option>
            {['Son of', 'Daughter of', 'Wife of', 'Husband of', 'Child of', 'Spouse of'].map(value => <option key={value} value={value}>{value}</option>)}
          </select>
          {errors.relationship && <p id="owner-relationship-error" className="mt-1 text-xs text-rose-600">{errors.relationship}</p>}
        </div>
        {/* Father's or Spouse's Name */}
        <div>
          <label htmlFor="owner-relativeName" className="block text-xs font-bold text-stone-700 mb-1">
            Parent / Spouse Full Name (optional)
          </label>
          <input
            id="owner-relativeName"
            type="text"
            maxLength={100}
            value={data.relativeName || ''}
            onChange={(e) => onChange({ relativeName: e.target.value })}
            placeholder="e.g. K. Sundaram"
            aria-invalid={!!errors.relativeName}
            aria-describedby={errors.relativeName ? 'owner-relativeName-error' : undefined}
            className={`w-full min-w-0 px-3.5 py-2.5 rounded-xl border text-sm text-stone-900 focus:outline-none focus:ring-2 ${
              errors.relativeName
                ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-400'
                : 'border-stone-300 bg-white focus:ring-amber-500'
            }`}
          />
          {errors.relativeName && <p id="owner-relativeName-error" className="text-xs text-rose-600 mt-1">{errors.relativeName}</p>}
        </div>

        {/* Age */}
        <div>
          <label htmlFor="owner-age" className="block text-xs font-bold text-stone-700 mb-1">
            Age (Years) *
          </label>
          <input
            id="owner-age"
            type="number"
            inputMode="numeric"
            min="18"
            max="120"
            required
            value={data.age || ''}
            onChange={(e) => onChange({ age: e.target.value ? Number(e.target.value) : '' })}
            placeholder="e.g. 48"
            aria-invalid={!!errors.age}
            aria-describedby={errors.age ? 'owner-age-error' : undefined}
            className={`w-full min-w-0 px-3.5 py-2.5 rounded-xl border text-sm text-stone-900 focus:outline-none focus:ring-2 ${
              errors.age
                ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-400'
                : 'border-stone-300 bg-white focus:ring-amber-500'
            }`}
          />
          {errors.age && <p id="owner-age-error" className="text-xs text-rose-600 mt-1">{errors.age}</p>}
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="owner-phone" className="block text-xs font-bold text-stone-700 mb-1">
            Primary Mobile Number *
          </label>
          <input
            id="owner-phone"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            required
            value={data.phone || ''}
            onChange={(e) => onChange({ phone: e.target.value.replace(/[^0-9]/g, '') })}
            placeholder="10-digit mobile number"
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? 'owner-phone-error' : undefined}
            className={`w-full min-w-0 px-3.5 py-2.5 rounded-xl border text-sm text-stone-900 focus:outline-none focus:ring-2 ${
              errors.phone
                ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-400'
                : 'border-stone-300 bg-white focus:ring-amber-500'
            }`}
          />
          {errors.phone && <p id="owner-phone-error" className="text-xs text-rose-600 mt-1">{errors.phone}</p>}
        </div>

        </div>
      </fieldset>

      <details open={Boolean(errors.aadhaarLast4 || errors.pan)} className="min-w-0 rounded-2xl border border-stone-200 p-3 sm:p-5">
        <summary className="cursor-pointer text-sm font-semibold text-stone-700">Identity details (optional)</summary>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 items-start gap-x-5 gap-y-5">
        {/* Aadhaar Number (Optional) */}
        <div>
          <label htmlFor="owner-aadhaar" className="block text-xs font-bold text-stone-700 mb-1">
            Aadhaar Number (Optional)
          </label>
          <input
            id="owner-aadhaar"
            type="text"
            inputMode="numeric"
            maxLength={14}
            value={data.aadhaarLast4 || ''}
            onChange={(e) => onChange({ aadhaarLast4: e.target.value.replace(/[^0-9\s-]/g, '') })}
            placeholder="e.g. 1234 5678 9012"
            aria-invalid={!!errors.aadhaarLast4}
            aria-describedby={errors.aadhaarLast4 ? 'owner-aadhaar-error' : undefined}
            className={`w-full min-w-0 px-3.5 py-2.5 rounded-xl border text-sm font-mono text-stone-900 focus:outline-none focus:ring-2 ${
              errors.aadhaarLast4
                ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-400'
                : 'border-stone-300 bg-white focus:ring-amber-500'
            }`}
          />
          {errors.aadhaarLast4 && (
            <p id="owner-aadhaar-error" className="text-xs text-rose-600 mt-1">{errors.aadhaarLast4}</p>
          )}
        </div>

        {/* PAN Number (Optional) */}
        <div>
          <label htmlFor="owner-pan" className="block text-xs font-bold text-stone-700 mb-1">
            PAN Number <span className="text-stone-400 font-normal">(Optional)</span>
          </label>
          <input
            id="owner-pan"
            type="text"
            maxLength={10}
            value={data.pan || ''}
            onChange={(e) => onChange({ pan: e.target.value.toUpperCase() })}
            placeholder="ABCDE1234F"
            aria-invalid={!!errors.pan}
            aria-describedby={errors.pan ? 'owner-pan-error' : undefined}
            className="w-full min-w-0 px-3.5 py-2.5 rounded-xl border border-stone-300 uppercase bg-white text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
          />
          {errors.pan && <p id="owner-pan-error" className="text-xs text-rose-600 mt-1">{errors.pan}</p>}
        </div>

        </div>
      </details>

      <fieldset className="min-w-0 rounded-2xl border border-stone-200 p-3 sm:p-5">
        <legend className="px-2 text-sm font-bold text-stone-900">Permanent Residential Address</legend>
        <div className="grid grid-cols-1 md:grid-cols-3 items-start gap-x-5 gap-y-5">
        {/* Permanent Address */}
        <div className="min-w-0 md:col-span-2">
          <label htmlFor="owner-address" className="block text-xs font-bold text-stone-700 mb-1">
            Street Address *
          </label>
          <textarea
            id="owner-address"
            rows={3}
            required
            value={data.address || ''}
            onChange={(e) => onChange({ address: e.target.value })}
            placeholder="Complete address including Door/Flat No., Street, Locality, City and State as in ID proof"
            aria-invalid={!!errors.address}
            aria-describedby={errors.address ? 'owner-address-error' : undefined}
            className={`w-full min-w-0 px-3.5 py-2.5 rounded-xl border text-sm text-stone-900 focus:outline-none focus:ring-2 ${
              errors.address
                ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-400'
                : 'border-stone-300 bg-white focus:ring-amber-500'
            }`}
          />
          {errors.address && <p id="owner-address-error" className="text-xs text-rose-600 mt-1">{errors.address}</p>}
        </div>
        <div className="min-w-0">
          <label htmlFor="owner-pincode" className="block text-xs font-bold text-stone-700 mb-1">PIN Code *</label>
          <input id="owner-pincode" type="text" inputMode="numeric" autoComplete="postal-code" required maxLength={6} pattern="[1-9][0-9]{5}" value={data.pincode || ''} onChange={(e) => onChange({ pincode: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) })} placeholder="6-digit PIN code" aria-invalid={!!errors.pincode} aria-describedby={errors.pincode ? 'owner-pincode-error' : undefined} className={`w-full min-w-0 px-3.5 py-2.5 rounded-xl border text-sm text-stone-900 focus:outline-none focus:ring-2 ${errors.pincode ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-400' : 'border-stone-300 bg-white focus:ring-amber-500'}`} />
          {errors.pincode && <p id="owner-pincode-error" className="text-xs text-rose-600 mt-1">{errors.pincode}</p>}
        </div>
        </div>
      </fieldset>

    </div>
  );
};
