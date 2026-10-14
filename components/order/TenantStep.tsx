'use client';

import React from 'react';
import { Users, Lock } from 'lucide-react';
import { PersonDetails } from '@/lib/types';

interface TenantStepProps {
  data: Partial<PersonDetails>;
  onChange: (fields: Partial<PersonDetails>) => void;
  errors: Record<string, string>;
}

export const TenantStep: React.FC<TenantStepProps> = ({ data, onChange, errors }) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="border-b border-stone-200 pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-900">Step 2: Tenant (Occupant) Details</h2>
            <p className="text-xs text-stone-500">Provide official details of the person occupying the rental premises.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Full Name */}
        <div className="sm:col-span-2">
          <label htmlFor="tenant-fullName" className="block text-xs font-bold text-stone-700 mb-1">
            Tenant Full Legal Name *
          </label>
          <input
            id="tenant-fullName"
            type="text"
            required
            value={data.fullName || ''}
            onChange={(e) => onChange({ fullName: e.target.value })}
            placeholder="e.g. M. Karthik"
            aria-invalid={!!errors.fullName}
            aria-describedby={errors.fullName ? 'tenant-fullName-error' : undefined}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-stone-900 focus:outline-none focus:ring-2 ${
              errors.fullName
                ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-400'
                : 'border-stone-300 bg-white focus:ring-amber-500'
            }`}
          />
          {errors.fullName && <p id="tenant-fullName-error" className="text-xs text-rose-600 mt-1">{errors.fullName}</p>}
        </div>

        {/* Father's or Spouse's Name */}
        <div>
          <label htmlFor="tenant-relativeName" className="block text-xs font-bold text-stone-700 mb-1">
            Father&apos;s or Spouse&apos;s Name *
          </label>
          <input
            id="tenant-relativeName"
            type="text"
            required
            value={data.relativeName || ''}
            onChange={(e) => onChange({ relativeName: e.target.value })}
            placeholder="e.g. V. Murugan"
            aria-invalid={!!errors.relativeName}
            aria-describedby={errors.relativeName ? 'tenant-relativeName-error' : undefined}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-stone-900 focus:outline-none focus:ring-2 ${
              errors.relativeName
                ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-400'
                : 'border-stone-300 bg-white focus:ring-amber-500'
            }`}
          />
          {errors.relativeName && <p id="tenant-relativeName-error" className="text-xs text-rose-600 mt-1">{errors.relativeName}</p>}
        </div>

        {/* Age */}
        <div>
          <label htmlFor="tenant-age" className="block text-xs font-bold text-stone-700 mb-1">
            Age (Years) *
          </label>
          <input
            id="tenant-age"
            type="number"
            inputMode="numeric"
            min="18"
            max="120"
            required
            value={data.age || ''}
            onChange={(e) => onChange({ age: e.target.value ? Number(e.target.value) : '' })}
            placeholder="e.g. 32"
            aria-invalid={!!errors.age}
            aria-describedby={errors.age ? 'tenant-age-error' : undefined}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-stone-900 focus:outline-none focus:ring-2 ${
              errors.age
                ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-400'
                : 'border-stone-300 bg-white focus:ring-amber-500'
            }`}
          />
          {errors.age && <p id="tenant-age-error" className="text-xs text-rose-600 mt-1">{errors.age}</p>}
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="tenant-phone" className="block text-xs font-bold text-stone-700 mb-1">
            Primary Mobile Number *
          </label>
          <input
            id="tenant-phone"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            required
            value={data.phone || ''}
            onChange={(e) => onChange({ phone: e.target.value.replace(/[^0-9]/g, '') })}
            placeholder="10-digit mobile number"
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? 'tenant-phone-error' : undefined}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-stone-900 focus:outline-none focus:ring-2 ${
              errors.phone
                ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-400'
                : 'border-stone-300 bg-white focus:ring-amber-500'
            }`}
          />
          {errors.phone && <p id="tenant-phone-error" className="text-xs text-rose-600 mt-1">{errors.phone}</p>}
        </div>

        {/* Aadhaar Number (Optional) */}
        <div>
          <label htmlFor="tenant-aadhaar" className="block text-xs font-bold text-stone-700 mb-1">
            Aadhaar Number (Optional)
          </label>
          <input
            id="tenant-aadhaar"
            type="text"
            inputMode="numeric"
            maxLength={14}
            value={data.aadhaarLast4 || ''}
            onChange={(e) => onChange({ aadhaarLast4: e.target.value.replace(/[^0-9\s-]/g, '') })}
            placeholder="e.g. 5678 9012 3456"
            aria-invalid={!!errors.aadhaarLast4}
            aria-describedby={errors.aadhaarLast4 ? 'tenant-aadhaar-error' : undefined}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono text-stone-900 focus:outline-none focus:ring-2 ${
              errors.aadhaarLast4
                ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-400'
                : 'border-stone-300 bg-white focus:ring-amber-500'
            }`}
          />
          {errors.aadhaarLast4 && (
            <p id="tenant-aadhaar-error" className="text-xs text-rose-600 mt-1">{errors.aadhaarLast4}</p>
          )}
        </div>

        {/* PAN Number (Optional) */}
        <div>
          <label htmlFor="tenant-pan" className="block text-xs font-bold text-stone-700 mb-1">
            PAN Number <span className="text-stone-400 font-normal">(Optional)</span>
          </label>
          <input
            id="tenant-pan"
            type="text"
            maxLength={10}
            value={data.pan || ''}
            onChange={(e) => onChange({ pan: e.target.value.toUpperCase() })}
            placeholder="FGHIJ5678K"
            aria-invalid={!!errors.pan}
            aria-describedby={errors.pan ? 'tenant-pan-error' : undefined}
            className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 uppercase bg-white text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
          />
          {errors.pan && <p id="tenant-pan-error" className="text-xs text-rose-600 mt-1">{errors.pan}</p>}
        </div>

        {/* Permanent Address */}
        <div className="sm:col-span-2">
          <label htmlFor="tenant-address" className="block text-xs font-bold text-stone-700 mb-1">
            Tenant Permanent Address (as in ID proof) *
          </label>
          <textarea
            id="tenant-address"
            rows={3}
            required
            value={data.address || ''}
            onChange={(e) => onChange({ address: e.target.value })}
            placeholder="Permanent residence address prior to this tenancy (as recorded in Aadhaar/Voter ID)"
            aria-invalid={!!errors.address}
            aria-describedby={errors.address ? 'tenant-address-error' : undefined}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-stone-900 focus:outline-none focus:ring-2 ${
              errors.address
                ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-400'
                : 'border-stone-300 bg-white focus:ring-amber-500'
            }`}
          />
          {errors.address && <p id="tenant-address-error" className="text-xs text-rose-600 mt-1">{errors.address}</p>}
        </div>
      </div>
    </div>
  );
};
