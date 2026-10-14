import type { Metadata } from 'next';
import { RentReceiptGenerator } from '@/components/rent-receipt/RentReceiptGenerator';

export const metadata: Metadata = {
  title: 'Free Rent Receipt Generator | StampSure',
  description:
    'Create and print monthly rent receipts for your tenants. Generate receipts locally and save them as a PDF.',
};

export default function RentReceiptPage() {
  return (
    <div className="py-10 sm:py-14">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-10">
          <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-900">
            Free online tool
          </span>
          <h1 className="mt-4 text-3xl sm:text-4xl font-black tracking-tight text-stone-900">
            Generate Rent Receipts
          </h1>
          <p className="mt-3 text-sm sm:text-base leading-relaxed text-stone-600">
            Create monthly rent receipts for your records and print them or save them as a PDF.
            Your details stay in this browser and are not submitted to StampSure.
          </p>
        </div>
        <RentReceiptGenerator />
      </div>
    </div>
  );
}
