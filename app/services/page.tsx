import { canonicalUrl } from '@/lib/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { VENDOR_SERVICE_TITLE } from '@/src/config/vendor';
import { VENDOR_SERVICES } from '@/src/config/vendor-services';

export const metadata: Metadata = {
  alternates: { canonical: canonicalUrl('/services') },
  title: 'Our Services | AgreementPrint',
  description: 'Explore stamp paper, e-Stamp and other services: rental agreements, notary services, card printing and application assistance.',
};
export default function ServicesPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-9 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="rounded-3xl bg-stone-900 p-6 text-white sm:p-10"><p className="text-sm font-semibold text-amber-400">AgreementPrint</p><h1 className="mt-3 text-3xl font-black sm:text-4xl">More ways we can help you</h1><p className="mt-4 max-w-3xl text-base leading-relaxed text-stone-300">From agreements and stamp paper to application help and card printing, speak to our team about the service you need.</p><p className="mt-4 text-sm font-semibold text-amber-300">{VENDOR_SERVICE_TITLE}</p></div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-stone-700">Rental agreements and custom requests can be started online. For the other services below, contact our team to check the documents needed, price and availability.</div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{VENDOR_SERVICES.map((group) => <section key={group.title} className="rounded-2xl border border-stone-200 bg-white p-6"><h2 className="text-lg font-bold text-stone-900">{group.title}</h2><ul className="mt-4 space-y-3">{group.services.map((service) => <li key={service} className="flex items-start gap-2 text-sm text-stone-600"><CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /><span>{service}</span></li>)}</ul></section>)}</div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h2 className="text-xl font-bold text-stone-900">Need help with a service?</h2><p className="mt-3 text-sm leading-relaxed text-stone-700">Contact our team to discuss the documents needed, price and availability.</p><Link href="/contact" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700">Ask About a Service <ArrowRight className="h-4 w-4" /></Link></div>
    </div>
  );
}
