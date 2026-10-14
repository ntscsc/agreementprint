import type { Metadata } from 'next';
import { AlertTriangle, ShieldCheck, Scale, FileText } from 'lucide-react';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { VENDOR_CONFIG } from '@/src/config/vendor';

export const metadata: Metadata = {
  title: 'Disclaimer | Rental Agreement & Stamp Vendor Services Tamil Nadu',
  description: 'Disclaimer: Authorized stamp vendor and drafting service, not a law firm. We do not provide legal advice.',
  openGraph: {
    title: 'Disclaimer | Rental Agreement & Stamp Vendor Services Tamil Nadu',
    description: 'Disclaimer: Authorized stamp vendor and drafting service, not a law firm. We do not provide legal advice.',
  },
};

export default function DisclaimerPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header */}
      <div className="space-y-3 border-b border-stone-200 pb-6">
        <span className="text-xs uppercase tracking-wider font-bold text-rose-800 bg-rose-100 px-3 py-1 rounded-full">
          Notice
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
          Disclaimer
        </h1>
        <p className="text-xs text-stone-500">Last Updated: October 2026</p>
      </div>

      {/* Primary Disclaimer Box */}
      <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-100 rounded-xl text-amber-800 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-amber-950">Vendor Status & Non-Legal Advice Notice</h2>
            <p className="text-xs text-amber-800 font-medium">Please read this disclaimer carefully before using our platform.</p>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-amber-950 leading-relaxed font-normal">
          {VENDOR_CONFIG.tradeName} ({VENDOR_CONFIG.name}) operates strictly as an <strong>authorized non-judicial stamp paper vendor and document formatting/drafting desk</strong> licensed under the Registration Department, Government of Tamil Nadu (Licence: <span className="font-mono font-bold">{VENDOR_CONFIG.licenceNumber}</span>).
        </p>

        <p className="text-xs sm:text-sm text-amber-950 leading-relaxed font-normal">
          <strong>WE ARE NOT A LAW FIRM, ADVOCATE CHAMBERS, OR LEGAL CONSULTANCY.</strong> We do not provide personalized legal counsel, advocate opinions, title searches, court litigation representation, or legal dispute guarantees. The agreements prepared on our platform utilize standard, customary 11-month tenancy formats commonly used across the State of Tamil Nadu.
        </p>
      </div>

      {/* Detailed Declarations */}
      <div className="space-y-8 text-xs sm:text-sm text-stone-700 leading-relaxed">
        <section className="space-y-2">
          <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <Scale className="w-4 h-4 text-amber-700" />
            <span>1. No Guarantee of Legal Outcomes or Dispute Immunity</span>
          </h3>
          <p>
            The execution of a rental agreement on non-judicial stamp paper does not guarantee legal immunity or specific court judgments in the event of landlord-tenant disputes, eviction proceedings, or non-payment of rent. Enforceability of any contract depends on the facts of the case, mutually executed signatures, and adjudication under the Tamil Nadu tenancy framework and the Indian Contract Act.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-700" />
            <span>2. Recommendation for Independent Legal Counsel</span>
          </h3>
          <p>
            If your tenancy involves unique terms, heavy commercial investments, corporate sub-leases, option to buy, high-value non-refundable advances, or disputed titles, you are strongly advised to seek advice from an enrolled advocate or legal practitioner prior to executing the agreement.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-700" />
            <span>3. Authenticity of Physical Non-Judicial Stamp Paper</span>
          </h3>
          <p>
            We warrant that all physical stamp papers delivered are genuine, procured directly through official Tamil Nadu Registration Department vendor channels, and registered in our official vendor register with a serial number.
          </p>
        </section>
      </div>

      {/* Contact box */}
      <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-stone-900 text-sm">Have questions regarding vendor licensing or stamp paper?</h4>
          <p className="text-xs text-stone-600 mt-0.5">Reach out to our certified stamp vendor desk.</p>
        </div>
        <WhatsAppButton variant="primary" />
      </div>
    </div>
  );
}
