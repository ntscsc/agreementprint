import { canonicalUrl, socialImage } from '@/lib/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Suspense } from 'react';
import { PricingOptions } from '@/components/PricingOptions';
import { DisclaimerBanner } from '@/components/DisclaimerBanner';

export const metadata: Metadata = {
  alternates: { canonical: canonicalUrl('/pricing') },
  title: 'Pricing & Fees | AgreementPrint',
  description: 'See the price for your rental agreement, delivery and optional notary service. Choose what you need and check the full total before paying.',
  openGraph: {
    images: [socialImage],
    title: 'Pricing & Fees | AgreementPrint',
    description: 'Simple prices for your rental agreement. Choose your stamp paper and delivery address to see the full cost.',
  },
};
const questions = [
  { title: 'What is included in the agreement price?', text: 'We prepare your rental agreement and print one original copy on the stamp paper you choose. Delivery is shown separately, so you can see the full cost.' },
  { title: 'How much is delivery?', text: 'Courier delivery costs 50 rupees within Chennai and 100 rupees elsewhere in Tamil Nadu. The delivery address you choose decides the charge.' },
  { title: 'Do I have to add notary service?', text: 'No. You can add it if you need a notary signature and seal. The extra charge is shown before you pay.' },
  { title: 'Can I use my referral credits?', text: 'Yes. If you have earned credits, you can use them to reduce what you pay for your order.' },
  { title: 'How do I pay?', text: 'Pay online after checking your details and total. You can choose from the payment options shown at that time.' },
];

export default function PricingPage() {
  return (
    <div className="space-y-10 py-8 pb-16 sm:space-y-14">
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-stone-800 bg-stone-900 p-6 text-white sm:p-10 lg:p-12">
          <div className="max-w-3xl space-y-4">
            <span className="inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-400">Know the price before you pay</span>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">Simple prices. Clear choices.</h1>
            <p className="text-base leading-relaxed text-stone-300 sm:text-lg">Choose your stamp paper and delivery address. Add notary service if you need it. See the full price before placing your order.</p>
          </div>
        </div>
      </section>

      <section aria-label="Choose your rental agreement" className="mx-auto max-w-3xl space-y-5 px-4 sm:px-6">
        <Suspense fallback={<p role="status" className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-600">Loading your options…</p>}><PricingOptions /></Suspense>
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5"><CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" /><p className="text-sm leading-relaxed text-amber-900">Your agreement price, delivery charge and any notary service are shown above. You can check everything again before paying.</p></div>
      </section>

      <section aria-labelledby="custom-pricing" className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8"><h2 id="custom-pricing" className="text-xl font-bold text-stone-900">Need a custom agreement?</h2><p className="mt-3 text-sm leading-relaxed text-stone-600">Share a sample and tell us what you need. Our team will give you a price and expected completion date before starting work. Sending a request is free.</p><Link href="/custom-agreement" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-amber-800 hover:underline">Get a price for your agreement <ArrowRight className="h-4 w-4" /></Link></div>
      </section>

      <section aria-labelledby="pricing-questions" className="mx-auto max-w-3xl space-y-5 px-4 sm:px-6">
        <h2 id="pricing-questions" className="text-2xl font-bold text-stone-900">A few questions you might have</h2>
        <div className="space-y-3">{questions.map((question) => <details key={question.title} className="rounded-xl border border-stone-200 bg-white p-5"><summary className="cursor-pointer text-sm font-semibold text-stone-900">{question.title}</summary><p className="mt-3 text-sm leading-relaxed text-stone-600">{question.text}</p></details>)}</div>
        <p className="text-sm leading-relaxed text-stone-600">Need to cancel an order? <Link href="/refund-policy" className="font-semibold text-amber-800 hover:underline">Read our refund and cancellation policy</Link>. For help with your order, <Link href="/contact" className="font-semibold text-amber-800 hover:underline">contact our team</Link>.</p>
      </section>

      <section className="mx-auto max-w-3xl px-4 sm:px-6"><DisclaimerBanner /></section>
    </div>
  );
}
