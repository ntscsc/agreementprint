import type { Metadata } from 'next';
import { FileCheck, Shield, AlertCircle } from 'lucide-react';
import { DisclaimerBanner } from '@/components/DisclaimerBanner';
import { VENDOR_CONFIG } from '@/src/config/vendor';

export const metadata: Metadata = {
  title: 'Terms and Conditions | Certified Stamp Paper Services Tamil Nadu',
  description: 'Terms of service for ordering rental agreements and non-judicial stamp paper drafting in Tamil Nadu.',
  openGraph: {
    title: 'Terms and Conditions | Certified Stamp Paper Services Tamil Nadu',
    description: 'Terms of service for ordering rental agreements and non-judicial stamp paper drafting in Tamil Nadu.',
  },
};

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header */}
      <div className="space-y-3 border-b border-stone-200 pb-6">
        <span className="text-xs uppercase tracking-wider font-bold text-stone-700 bg-stone-200 px-3 py-1 rounded-full">
          Legal Agreement
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
          Terms and Conditions of Service
        </h1>
        <p className="text-xs text-stone-500">Last Updated: October 2026</p>
      </div>

      <div className="space-y-8 text-xs sm:text-sm text-stone-700 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-amber-700" />
            <span>1. Scope of Service</span>
          </h2>
          <p>
            {VENDOR_CONFIG.tradeName} operates as an authorized non-judicial stamp paper vendor (Licence: {VENDOR_CONFIG.licenceNumber}). Our scope of service is strictly limited to:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-stone-600">
            <li>Procuring genuine non-judicial stamp paper from the Tamil Nadu Registration Department.</li>
            <li>Typing and formatting standard tenancy clauses onto the procured stamp paper and accompanying bond ledger sheets based on customer-submitted data.</li>
            <li>Packaging and dispatching the physical paper via registered courier (Speed Post or Blue Dart) to the specified delivery address.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-700" />
            <span>2. Customer Responsibilities & Accuracy</span>
          </h2>
          <p>
            The customer is solely responsible for ensuring that all data submitted (names, father/spouse names, rental figures, deposit amounts, and premises address) is accurate, truthful, and corresponds with official identity proofs. We do not independently verify title ownership of the property. Customers agree not to submit forged or fraudulent identity documents.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700" />
            <span>3. No Legal Advice & Independent Counsel</span>
          </h2>
          <p>
            The service provided does NOT constitute legal advice, advocate representation, or title verification. Our standard rental agreement formats are based on widely accepted tenancy practices across Tamil Nadu. If either party requires custom non-standard dispute arbitration or leasehold covenants, they are advised to consult an enrolled advocate.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-amber-700" />
            <span>4. Delivery Timelines & Force Majeure</span>
          </h2>
          <p>
            Postal transit times remain subject to courier logistics. We are not liable for transit delays caused by extreme weather events, state holidays, or incorrect consignee contact details.
          </p>
        </section>
      </div>

      <DisclaimerBanner />
    </div>
  );
}
