'use client';

import { EXTRA_COPY_PRICE, MAX_EXTRA_COPIES } from '@/src/config/pricing';

export function ExtraCopiesField({ value = 0, onChange, stamp = 100 }: { value?: number; onChange: (value: number) => void; stamp?: 100 | 200 }) {
  return <label className="block text-sm font-semibold text-stone-800">Extra printed copies (optional)
    <input type="number" min={0} max={MAX_EXTRA_COPIES} step={1} required value={value} onChange={event => {
      const count = event.target.value === '' ? 0 : Number(event.target.value);
      if (Number.isSafeInteger(count) && count >= 0 && count <= MAX_EXTRA_COPIES) onChange(count);
    }} className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
    <span className="mt-2 block text-sm font-normal text-stone-600">One original is included. Each extra copy costs ₹{EXTRA_COPY_PRICE}, including the same ₹{stamp} stamp paper. {1 + (Number.isSafeInteger(value) && value >= 0 ? value : 0)} copies in total.</span>
  </label>;
}
