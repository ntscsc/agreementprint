import type { Metadata } from 'next';
import { RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { DisclaimerBanner } from '@/components/DisclaimerBanner';
import { SupportEmailLink } from '@/components/SupportEmailLink';

export const metadata: Metadata = {
  title: 'Refund and Cancellation Policy | Certified Stamp Paper Services',
  description: 'Our transparent refund and cancellation policy for rental agreement drafting and stamp paper procurement.',
  openGraph: {
    title: 'Refund and Cancellation Policy | Certified Stamp Paper Services',
    description: 'Our transparent refund and cancellation policy for rental agreement drafting and stamp paper procurement.',
  },
};

export default function RefundPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header */}
      <div className="space-y-3 border-b border-stone-200 pb-6">
        <span className="text-xs uppercase tracking-wider font-bold text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
          Cancellation Terms
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
          Refund and Cancellation Policy
        </h1>
        <p className="text-xs text-stone-500">Last Updated: October 2026</p>
      </div>

      <div className="space-y-8 text-xs sm:text-sm text-stone-700 leading-relaxed">
        {/* Policy Highlight */}
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 space-y-3">
          <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-amber-700" />
            <span>Refunds for Serialized Government Stamp Paper</span>
          </h2>
          <p className="text-stone-600">
            Because our service involves the procurement of serialized government non-judicial stamp paper from the Tamil Nadu Registration Department, our refund terms strictly reflect the physical execution status of your order:
          </p>
        </div>

        {/* Status Stages */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Before Printing: 100% Full Refund</span>
            </div>
            <p className="text-xs text-emerald-800 leading-relaxed">
              If you request cancellation while your order status is <strong>Submitted</strong> or <strong>Under verification</strong> (before physical non-judicial stamp paper has been serialized and printed with party names), you will receive a full refund back to your original payment method.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-700" />
              <span>After Stamping: Non-Refundable Duty</span>
            </div>
            <p className="text-xs text-amber-900 leading-relaxed">
              Once an order enters the <strong>Drafting</strong> or <strong>Dispatched</strong> stage and non-judicial stamp paper is printed with owner and tenant names, the government stamp duty cannot be refunded because government stamp paper is non-reusable.
            </p>
          </div>
        </div>

        {/* Correction Policy */}
        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-700" />
            <span>Typographical Errors & Corrections</span>
          </h2>
          <p>
            If a typographical error on the physical agreement was caused by our vendor drafting desk (where submitted details did not match what was printed), we will draft and re-dispatch a fresh agreement on new stamp paper at <strong>zero additional charge</strong>.
          </p>
          <p className="text-stone-600">
            If the error was present in the customer&apos;s original form submission, a re-stamping charge limited to the raw stamp duty and courier charge will apply.
          </p>
        </section>

        {/* How to initiate */}
        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-bold text-stone-900">
            How to Request a Cancellation or Refund
          </h2>
          <p>
              To cancel an order, contact our desk via WhatsApp or email{' '}
              <SupportEmailLink className="font-mono text-amber-800 font-semibold" /> with your Order ID. Approved refunds are credited to the original payment method within 3 to 5 business days.
          </p>
        </section>
      </div>

      <DisclaimerBanner />
    </div>
  );
}
