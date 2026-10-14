import type { Metadata } from 'next';
import { ShieldCheck, Lock, EyeOff, FileText, CheckCircle2 } from 'lucide-react';
import { DisclaimerBanner } from '@/components/DisclaimerBanner';
import { VENDOR_CONFIG } from '@/src/config/vendor';
import { SupportEmailLink } from '@/components/SupportEmailLink';

export const metadata: Metadata = {
  title: 'Privacy Policy | Data Protection & Aadhaar Masking Policy | TN Stamp Paper',
  description: 'Read how we protect agreement details, contact information and custom agreement sample uploads.',
  openGraph: {
    title: 'Privacy Policy | Data Protection & Aadhaar Masking Policy | TN Stamp Paper',
    description: 'Read how we protect agreement details, contact information and custom agreement sample uploads.',
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header */}
      <div className="space-y-3 border-b border-stone-200 pb-6">
        <span className="text-xs uppercase tracking-wider font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
          Identity Protection
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
          Privacy & Identity Protection Policy
        </h1>
        <p className="text-xs text-stone-500">Last Updated: October 2026</p>
      </div>

      {/* Mandatory Aadhaar Masking Highlight Box */}
      <div className="bg-emerald-50 border-2 border-emerald-300/80 rounded-2xl p-6 space-y-3">
        <div className="flex items-center gap-2 text-emerald-950 font-bold text-base">
          <ShieldCheck className="w-6 h-6 text-emerald-700" />
          <span>Strict Aadhaar Privacy & Masking Commitment</span>
        </div>
        <p className="text-xs sm:text-sm text-emerald-900 leading-relaxed">
          Aadhaar information is optional. Share only the minimum identification details needed for your agreement and avoid entering full Aadhaar numbers. Before uploading custom agreement samples, redact unnecessary Aadhaar, bank and other sensitive information. Sample files may contain the information you choose to share with our drafting team.
        </p>
      </div>

      {/* Policy Details */}
      <div className="space-y-8 text-xs sm:text-sm text-stone-700 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-700" />
            <span>1. Information We Collect</span>
          </h2>
          <p>
            When you order a rental agreement through {VENDOR_CONFIG.tradeName}, we collect only information strictly essential to draft the legal tenancy contract onto official non-judicial stamp paper:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-stone-600">
            <li>Owner & Tenant full legal names, father/spouse name, age, permanent address, contact number, and email.</li>
            <li>Last 4 digits of Aadhaar number and optional PAN number for tax accounting records.</li>
            <li>Rental property location, survey number/door number, pincode, monthly rent, security deposit, and tenancy dates.</li>
            <li>For custom agreement requests: sample PDF/DOCX templates or JPG/PNG photos, customisation instructions, preferred language, contact details and contact preference.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-amber-700" />
            <span>2. Private Agreement Data</span>
          </h2>
          <p>
            Agreement drafts and orders are stored with access controls. Custom agreement samples are uploaded privately and verified before vendor review. Identity or property proof uploads are not part of the standard rental agreement flow.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs">
              <strong className="text-stone-900 block mb-1">Restricted Customer Access</strong>
              Accessible only by the authenticated customer who created the order.
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs">
              <strong className="text-stone-900 block mb-1">Certified Vendor Only</strong>
              Authorized vendor staff review submitted details to prepare the agreement.
            </div>
          </div>
          <p className="text-stone-600 pt-1">
            Enter standard rental agreement details directly in the order form. Custom agreement requests accept up to three sample files, 10 MB each. Remove unnecessary Aadhaar, bank and other sensitive information before sharing a sample. We use your chosen contact details to clarify your request and communicate the quote; consent to this contact does not include marketing.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-700" />
            <span>3. Zero Commercial Data Sharing</span>
          </h2>
          <p>
            We will never sell, rent, lease, or commercialize your personal data, rental figures, or contact details to third-party telemarketers, brokers, or advertising networks. Your information is used strictly to fulfill your physical stamp paper dispatch.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-amber-700" />
            <span>4. Data Retention & Erasure</span>
          </h2>
          <p>
            Customer orders and status history are maintained so you can track your courier dispatch. For questions about your stored agreement details or data deletion requests, contact our vendor desk at{' '}
            <SupportEmailLink className="font-mono text-amber-800 font-semibold" />.
          </p>
        </section>
      </div>

      <DisclaimerBanner />
    </div>
  );
}
