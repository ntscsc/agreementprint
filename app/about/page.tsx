import { canonicalUrl } from '@/lib/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { VENDOR_SERVICE_TITLE } from '@/src/config/vendor';

export const metadata: Metadata = {
  alternates: { canonical: canonicalUrl('/about') },
  title: 'About Us | AgreementPrint',
  description: 'Our team brings 25 years of experience in customer service and digital government services to stamp paper, e-Stamps and agreement preparation in Tamil Nadu.',
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
      <div className="space-y-4"><h1 className="text-3xl font-black text-stone-900 sm:text-4xl">About AgreementPrint</h1><p className="text-lg font-semibold text-amber-800">{VENDOR_SERVICE_TITLE}</p><p className="text-base leading-relaxed text-stone-600">We help customers with stamp paper, e-Stamps and agreement preparation. Tell us what you need, and our team will explain the available service and price.</p></div>
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-7">
        <p className="max-w-xl text-base leading-relaxed text-stone-600">Our team brings 25 years of experience in customer service and digital government services. We guide you through document requirements, explain the process clearly and provide personal assistance.</p>
      </div>
      <Link href="/services" className="inline-block text-sm font-semibold text-amber-800 hover:underline">See all our services</Link>
      <div className="grid gap-5 sm:grid-cols-2"><section className="rounded-2xl border border-stone-200 bg-white p-6"><h2 className="text-xl font-bold text-stone-900">Non-Judicial Stamp Paper</h2><p className="mt-3 text-sm leading-relaxed text-stone-600">Physical stamp paper for your documents. Our online rental agreement service includes preparation and printing on your selected stamp paper, with courier delivery.</p></section><section className="rounded-2xl border border-stone-200 bg-white p-6"><h2 className="text-xl font-bold text-stone-900">e-Stamp Services</h2><p className="mt-3 text-sm leading-relaxed text-stone-600">Contact our team for e-Stamp services. We will discuss your document needs, the details required and the price before you proceed.</p></section></div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h2 className="text-xl font-bold text-stone-900">Not sure which service you need?</h2><p className="mt-3 text-sm leading-relaxed text-stone-700">Speak to us about your document before placing an order.</p><Link href="/contact" className="mt-4 inline-block rounded-xl bg-amber-600 px-5 py-3 text-sm font-bold text-white hover:bg-amber-700">Contact Our Team</Link></div>
    </div>
  );
}
