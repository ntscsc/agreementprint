'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, IndianRupee } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export function HomePriceEnquiry() {
  const { user, loading } = useAuth();
  const [type, setType] = useState('standard');
  const [region, setRegion] = useState('Within Chennai');
  const [stamp, setStamp] = useState('100');
  const inputClass = 'mt-2 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-brand-600 xl:min-h-14 xl:text-base';

  if (loading || !user) return null;

  return (
    <aside aria-labelledby="hero-price-title" className="w-full min-w-0 rounded-2xl border border-brand-200 bg-white/95 p-6 shadow-lg shadow-brand-900/5 sm:p-7 xl:p-8">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><IndianRupee aria-hidden="true" className="h-5 w-5" /></div>
      <h2 id="hero-price-title" className="text-xl font-extrabold tracking-tight xl:text-2xl text-stone-900">Find your agreement price</h2>
      <p className="mt-2 text-sm leading-relaxed text-stone-600 xl:text-base">Explore package prices on our pricing page. Confirm your options and final price when ordering.</p>
      <div className="mt-5 space-y-4 xl:mt-6 xl:space-y-5">
        <label className="block text-sm font-semibold text-stone-700 xl:text-base">Agreement type
          <select value={type} onChange={event => setType(event.target.value)} className={inputClass}>
            <option value="standard">Rental / lease agreement</option>
            <option value="custom">Custom agreement</option>
          </select>
        </label>
        {type === 'standard' ? <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <label className="block text-sm font-semibold text-stone-700 xl:text-base">Delivery region
              <select value={region} onChange={event => setRegion(event.target.value)} className={inputClass}>
                <option value="Within Chennai">Chennai</option>
                <option value="Within Tamil Nadu">Rest of Tamil Nadu</option>
              </select>
            </label>
            <label className="block text-sm font-semibold text-stone-700 xl:text-base">Stamp paper
              <select value={stamp} onChange={event => setStamp(event.target.value)} className={inputClass}>
                <option value="100">₹100 stamp paper</option>
                <option value="200">₹200 stamp paper</option>
              </select>
            </label>
          </div>
          <Link href={{ pathname: '/pricing', query: { stamp, region } }} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 xl:min-h-14 xl:text-base">See prices<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
        </> : <>
          <p className="text-sm leading-relaxed text-stone-600">Share your document or sample. Our team will confirm a price based on your requirements.</p>
          <Link href="/custom-agreement" className="flex min-h-12 items-center justify-center rounded-xl bg-amber-700 px-4 py-3 text-sm font-bold text-white hover:bg-amber-800">Request a custom quote</Link>
        </>}
      </div>
    </aside>
  );
}
