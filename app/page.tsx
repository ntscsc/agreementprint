import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, CheckCircle2, FileText, Gift, Printer, ReceiptText, Truck, CreditCard } from 'lucide-react';
import { PriceBreakdownCard } from '@/components/PriceBreakdownCard';
import { VENDOR_SERVICE_TITLE } from '@/src/config/vendor';

export const metadata: Metadata = {
  title: 'AgreementPrint | Agreement Drafting & Printing',
  description: 'Get your rental agreement prepared, printed on Tamil Nadu stamp paper and delivered to your door. Request custom agreements, create free rent receipts and earn referral rewards.',
  openGraph: {
    title: 'AgreementPrint | Agreement Drafting & Printing',
    description: 'Share your details. We prepare, print and deliver your rental agreement. Simple ordering, clear prices and custom agreements to suit your needs.',
  },
};

const homeContainer = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8';

const services = [
  { icon: FileText, title: 'Rental Agreements', text: 'Share the rental details. We prepare your agreement, print it on stamp paper and send it by courier.', label: 'Start your agreement', href: '/order', panel: 'border-brand-200 bg-brand-50', iconColor: 'bg-brand-100 text-brand-800', action: 'bg-brand-700 hover:bg-brand-800' },
  { icon: Printer, title: 'Custom Agreements', text: 'Need a different agreement? Share a sample and tell us what you need. Our team will contact you with a price.', label: 'Tell us what you need', href: '/custom-agreement', panel: 'border-amber-200 bg-amber-50', iconColor: 'bg-amber-100 text-amber-800', action: 'bg-amber-700 hover:bg-amber-800' },
  { icon: ReceiptText, title: 'Free Rent Receipts', text: 'Create a rent receipt in a few simple steps. Print a copy or save it as a PDF, free of charge.', label: 'Create a rent receipt', href: '/rent-receipt', panel: 'border-brand-200 bg-brand-50', iconColor: 'bg-brand-100 text-brand-800', action: 'bg-brand-700 hover:bg-brand-800' },
  { icon: Gift, title: 'Refer & Earn', text: 'Help a friend get their agreement. Earn credits when they use your referral link for their first paid order.', label: 'See your rewards', href: '/referrals', panel: 'border-amber-200 bg-amber-50', iconColor: 'bg-amber-100 text-amber-800', action: 'bg-amber-700 hover:bg-amber-800' },
];
const steps = [
  { icon: FileText, title: 'Share your details', text: 'Tell us about the owner, tenant, property and rent.' },
  { icon: CreditCard, title: 'Check and pay', text: 'Choose your options, check the full price and pay online.' },
  { icon: Printer, title: 'We prepare and print', text: 'Our team checks your details and prepares your agreement on stamp paper.' },
  { icon: Truck, title: 'Delivered to your door', text: 'Receive the printed agreement at the address you choose.' },
];

export default function HomePage() {
  return (
    <div className="space-y-12 bg-stone-50 pb-12 sm:space-y-16 sm:pb-16">
      <section className="relative isolate overflow-hidden border-b border-brand-200 bg-brand-50 py-10 sm:py-14 lg:py-16">
        <Image src="/images/home-hero.webp" alt="" fill priority unoptimized sizes="100vw" className="object-cover object-right" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(248,252,255,0.95),rgba(248,252,255,0.85))] lg:bg-[linear-gradient(90deg,rgba(248,252,255,0.94)_0%,rgba(248,252,255,0.82)_45%,rgba(248,252,255,0.25)_100%)]" />
        <div className={`${homeContainer} relative z-10 grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-10`}>
          <div className="min-w-0 space-y-6 lg:col-span-7">
            <span className="inline-block rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold tracking-wide text-amber-800">{VENDOR_SERVICE_TITLE}</span>
            <h1 className="max-w-2xl text-3xl font-black leading-tight tracking-tight text-stone-900 sm:text-4xl lg:text-5xl">Your rental agreement,<br className="hidden sm:block" /> delivered to your door.</h1>
            <p className="max-w-xl text-base leading-relaxed text-stone-600 sm:text-lg">Leave the paperwork to us. Share your details online and get your agreement prepared and printed on Tamil Nadu stamp paper, with courier delivery to your chosen address.</p>
            <div className="grid grid-cols-1 gap-3 text-sm font-medium text-stone-700 sm:grid-cols-2">
              {['Tamil Nadu stamp paper', 'Clear price before you pay', 'Optional notary service', 'Courier delivery with tracking'].map((benefit) => <div key={benefit} className="flex items-start gap-2"><CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /><span>{benefit}</span></div>)}
            </div>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
              <Link href="/order" className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-800">Start My Rental Agreement <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/custom-agreement" className="inline-flex items-center justify-center rounded-xl border border-amber-700 bg-amber-700 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-800">Need a Custom Agreement?</Link>
            </div>
            <p className="text-sm text-stone-500">Already placed an order? <Link href="/my-orders" className="font-semibold text-amber-800 hover:underline">View My Orders</Link> or <Link href="/track" className="font-semibold text-amber-800 hover:underline">track your delivery</Link>.</p>
          </div>
          <div className="mx-auto w-full min-w-0 max-w-xl lg:col-span-5 lg:max-w-none"><PriceBreakdownCard showCta={false} /></div>
        </div>
      </section>

      <section aria-labelledby="our-services" className={homeContainer}>
        <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
          <h2 id="our-services" className="text-2xl font-bold text-stone-900">Our Services</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-stone-600">Get help with stamp paper, e-Stamps, agreements, notary services, card printing and applications. Explore our services and find what you need.</p>
          <div className="mt-5 flex flex-wrap gap-5 text-sm font-semibold text-amber-800"><Link href="/contact" className="hover:underline">Ask About a Service</Link><Link href="/services" className="hover:underline">View All Services</Link></div>
        </div>
      </section>

      <section aria-labelledby="home-services" className={homeContainer}>
        <div className="mb-7 max-w-2xl space-y-3">
          <h2 id="home-services" className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">What can we help you with?</h2>
          <p className="text-sm leading-relaxed text-stone-600 sm:text-base">From rental paperwork to an agreement made around your needs, start here.</p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {services.map((service) => <article key={service.href} className={`flex min-w-0 flex-col rounded-2xl border p-6 shadow-sm ${service.panel}`}><div className={`flex h-11 w-11 items-center justify-center rounded-xl ${service.iconColor}`}><service.icon aria-hidden="true" className="h-5 w-5" /></div><h3 className="mt-4 text-lg font-bold text-stone-900">{service.title}</h3><p className="mt-3 flex-1 text-sm leading-relaxed text-stone-600">{service.text}</p><Link href={service.href} className={`mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition ${service.action}`}>{service.label}<ArrowRight className="h-4 w-4 shrink-0" /></Link></article>)}
        </div>
      </section>

      <section aria-labelledby="home-process" className="border-y border-stone-200 bg-stone-100 py-10 sm:py-14">
        <div className={homeContainer}>
          <div className="mb-7 max-w-2xl space-y-3"><h2 id="home-process" className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">A few simple steps. We handle the rest.</h2><p className="text-sm leading-relaxed text-stone-600 sm:text-base">Getting your rental agreement is easy with AgreementPrint.</p></div>
          <ol className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {steps.map((step, index) => <li key={step.title} className="min-w-0 rounded-2xl border border-stone-200 bg-white p-6"><div className="flex items-center justify-between"><span className="text-2xl font-black text-amber-700">{String(index + 1).padStart(2, '0')}</span><step.icon aria-hidden="true" className="h-5 w-5 text-amber-800" /></div><h3 className="mt-4 text-base font-bold text-stone-900">{step.title}</h3><p className="mt-3 text-sm leading-relaxed text-stone-600">{step.text}</p></li>)}
          </ol>
          <Link href="/how-it-works" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-amber-800 hover:underline">See how it works <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      <section aria-labelledby="home-custom" className={homeContainer}>
        <div className="grid grid-cols-1 gap-8 rounded-3xl border border-amber-200 bg-amber-50 p-6 sm:p-8 lg:grid-cols-2 lg:items-center">
          <div className="min-w-0 space-y-4"><h2 id="home-custom" className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">Your needs are different.<br />Your agreement can be too.</h2><p className="max-w-xl text-sm leading-relaxed text-stone-700 sm:text-base">Share a sample document or photo and tell us what you want changed. We will discuss your needs and give you a price before starting work.</p><Link href="/custom-agreement" className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-bold text-white hover:bg-amber-700">Request a Custom Agreement <ArrowRight className="h-4 w-4" /></Link></div>
          <div className="min-w-0 space-y-4 rounded-2xl border border-amber-200 bg-white p-5 sm:p-6">{['Tell us what you need and share a sample.', 'Our team contacts you with a price and expected completion date.', 'Sending a request is free. Agree on the work before going ahead.'].map((detail) => <div key={detail} className="flex items-start gap-3 text-sm leading-relaxed text-stone-700"><CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><span>{detail}</span></div>)}<Link href="/my-requests" className="inline-block pt-2 text-sm font-semibold text-amber-800 hover:underline">Already sent a request? View My Requests</Link></div>
        </div>
      </section>

      <section aria-labelledby="home-help" className={homeContainer}>
        <div className="flex flex-col gap-6 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between"><div><h2 id="home-help" className="text-xl font-bold text-stone-900">Have a question before you begin?</h2><p className="mt-2 text-sm text-stone-600">Check our prices, find a quick answer or speak to our team.</p></div><div className="flex flex-wrap gap-3">{[{ label: 'See Prices', href: '/pricing' }, { label: 'Common Questions', href: '/faq' }, { label: 'Contact Us', href: '/contact' }].map((link) => <Link key={link.href} href={link.href} className="rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-50">{link.label}</Link>)}</div></div>
      </section>
    </div>
  );
}
