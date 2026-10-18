import { canonicalUrl, socialImage } from '@/lib/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText, CreditCard, Printer, Truck, ArrowRight, Gift, ReceiptText } from 'lucide-react';

export const metadata: Metadata = {
  alternates: { canonical: canonicalUrl('/how-it-works') },
  title: 'How It Works | AgreementPrint',
  description: 'Get your agreement prepared, printed and delivered with AgreementPrint. See how to order, request a custom agreement and earn rewards.',
  openGraph: {
    images: [socialImage],
    title: 'How It Works | AgreementPrint',
    description: 'Share your details, check the price and let AgreementPrint prepare and deliver your agreement.',
  },
};

const rentalSteps = [
  {
    icon: FileText,
    title: 'Tell us about your rental',
    desc: 'Share the owner and tenant details, the property address, and the rent agreed between you.',
    details: [
      'Keep the names, addresses and rental details handy.',
      'You can save your details and finish later.',
    ],
  },
  {
    icon: CreditCard,
    title: 'Choose, check and pay',
    desc: 'Choose your stamp paper and where you want the agreement delivered. Check everything before you pay.',
    details: [
      'Add notary service if you need it.',
      'See your agreement price, delivery charge and full total before paying.',
    ],
  },
  {
    icon: Printer,
    title: 'We prepare your agreement',
    desc: 'Our team checks your details and prints your agreement on Tamil Nadu stamp paper.',
    details: [
      'We take care of preparing and printing your agreement.',
      'If any details need changing, you can update them in My Orders.',
    ],
  },
  {
    icon: Truck,
    title: 'Delivered to your door',
    desc: 'Your printed agreement is sent by courier to the owner or tenant address you choose.',
    details: [
      'Check My Orders to see how your order is progressing.',
      'Follow your parcel with the courier tracking details once it is sent.',
    ],
  },
];

const customSteps = [
  { title: 'Tell us what you need', text: 'Need something different from a rental agreement? Tell us the kind of agreement you want and any changes you need.' },
  { title: 'Share a sample', text: 'Send a sample document or a clear photo to help us understand your needs. Sending a request is free.' },
  { title: 'Get a price from our team', text: 'We will contact you with the price and expected completion date. You can discuss the details with us before agreeing to go ahead.' },
];

export default function HowItWorksPage() {
  return (
    <div className="space-y-12 py-8 pb-16">
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-stone-800 bg-stone-900 p-6 text-white sm:p-10 lg:p-12">
          <div className="max-w-3xl space-y-4">
            <span className="inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-400">Simple steps. Less hassle.</span>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">Your agreement, made easy.</h1>
            <p className="text-base leading-relaxed text-stone-300 sm:text-lg">From preparing your agreement to delivering the printed copy, we make the process easy. Tell us what you need and we will help you take the next step.</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/order" className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-stone-950 transition hover:bg-amber-400">Start Rental Agreement <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/custom-agreement" className="inline-flex items-center gap-2 rounded-xl border border-stone-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800">Request a Custom Agreement</Link>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="rental-process" className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6">
        <div><h2 id="rental-process" className="text-2xl font-bold text-stone-900">Rental agreements</h2><p className="mt-2 text-sm text-stone-600">Share your details online. We will prepare, print and send your agreement to your door.</p></div>
        <ol className="space-y-4">
          {rentalSteps.map((step, index) => (
            <li key={step.title} className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:flex-row sm:gap-5 sm:p-7">
              <div aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-lg font-black text-amber-800">{String(index + 1).padStart(2, '0')}</div>
              <div className="min-w-0 space-y-3">
                <h3 className="flex items-start gap-2 text-lg font-bold text-stone-900"><step.icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />{step.title}</h3>
                <p className="text-sm leading-relaxed text-stone-600">{step.desc}</p>
                <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-stone-700">{step.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
              </div>
            </li>
          ))}
        </ol>
        <Link href="/pricing" className="inline-flex items-center gap-2 text-sm font-semibold text-amber-800 hover:underline">See our prices <ArrowRight className="h-4 w-4" /></Link>
      </section>

      <section aria-labelledby="custom-process" className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6">
        <div><h2 id="custom-process" className="text-2xl font-bold text-stone-900">Need a custom agreement?</h2><p className="mt-2 text-sm text-stone-600">An agreement made around your needs, with a price agreed before we begin.</p></div>
        <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {customSteps.map((step, index) => <li key={step.title} className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6"><span className="text-xs font-bold uppercase tracking-wide text-amber-800">Step {index + 1}</span><h3 className="mt-3 text-lg font-bold text-stone-900">{step.title}</h3><p className="mt-3 text-sm leading-relaxed text-stone-600">{step.text}</p></li>)}
        </ol>
        <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-amber-800"><Link href="/custom-agreement" className="hover:underline">Start a custom request</Link><Link href="/my-requests" className="hover:underline">View My Requests</Link></div>
      </section>

      <section aria-label="More ways we can help" className="mx-auto grid max-w-5xl grid-cols-1 gap-5 px-4 sm:px-6 md:grid-cols-2">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><Gift aria-hidden="true" className="h-6 w-6 text-amber-800" /><h2 className="mt-4 text-xl font-bold text-stone-900">Refer a friend, earn credits</h2><p className="mt-3 text-sm leading-relaxed text-stone-700">Share your referral link with a friend. When they use it for their first paid order, you earn credits to save on your next agreement. Visit Referral Credits to see your rewards.</p><Link href="/referrals" className="mt-4 inline-block text-sm font-semibold text-amber-800 hover:underline">View Referral Credits</Link></div>
        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-6"><ReceiptText aria-hidden="true" className="h-6 w-6 text-amber-800" /><h2 className="mt-4 text-xl font-bold text-stone-900">Need a rent receipt? It is free.</h2><p className="mt-3 text-sm leading-relaxed text-stone-700">Fill in a few details to create your rent receipt. Print a copy or save it as a PDF. Your receipt details stay on your device.</p><Link href="/rent-receipt" className="mt-4 inline-block text-sm font-semibold text-amber-800 hover:underline">Create a Rent Receipt</Link></div>
      </section>
    </div>
  );
}
