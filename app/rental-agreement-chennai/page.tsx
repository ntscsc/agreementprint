import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, FileText, Printer, Truck } from 'lucide-react';
import { canonicalUrl, socialImage } from '@/lib/seo';

const title = 'Online Rental Agreement in Chennai | AgreementPrint';
const description = 'Prepare your rental agreement online in Chennai. English or Tamil drafting, stamp paper printing, optional notary service and courier delivery with tracking.';
export const metadata: Metadata = {
  title, description,
  alternates: { canonical: canonicalUrl('/rental-agreement-chennai') },
  openGraph: { title, description, url: canonicalUrl('/rental-agreement-chennai'), type: 'website', images: [socialImage] },
  twitter: { card: 'summary_large_image', title, description, images: [socialImage.url] },
};

const steps = [
  { icon: FileText, title: 'Enter your rental details', text: 'Add the landlord, tenant and property details, then enter the agreed rent, deposit, start date and rental period.' },
  { icon: CheckCircle2, title: 'Review and place your order', text: 'Choose your stamp paper, copies and delivery region. Preview your agreement and review the price before payment.' },
  { icon: Printer, title: 'We prepare and print', text: 'Our team checks your submission and prepares your agreement in your selected language. Add notary service when placing the order if needed.' },
  { icon: Truck, title: 'Receive your printed agreement', text: 'Your physical agreement is sent by courier. Follow preparation and delivery progress from My Orders.' },
];
const questions = [
  { q: 'Can I get a rental agreement online in Chennai?', a: 'Yes. Enter your details online, review the draft and place your order. AgreementPrint prepares and prints the physical agreement and sends it to your selected delivery address.' },
  { q: 'Can I choose English or Tamil?', a: 'Yes. English and Tamil options are available for rental agreements. Select the language when entering your agreement terms.' },
  { q: 'What details should I keep ready?', a: 'Keep the landlord and tenant names, contact details and addresses, the complete property address and PIN code, and your agreed rent, deposit, start date and rental period ready.' },
  { q: 'How much does a rental agreement cost?', a: 'Your total depends on the selected stamp paper, notary option, copies and delivery region. The order form displays the price before payment. Sign in to view current package pricing.' },
  { q: 'Can I choose my rental period?', a: 'Yes. Enter the rental period agreed between the landlord and tenant. You can change the default duration in the form.' },
  { q: 'Does this service include government registration?', a: 'Government registration and Rent Authority formalities are not included in agreement preparation, printing or optional notary service. See our disclaimer for the scope of the service.' },
];

export default function ChennaiRentalAgreementPage() {
  const service = { '@context': 'https://schema.org', '@type': 'Service', name: 'Online rental agreement in Chennai', description, url: canonicalUrl('/rental-agreement-chennai'), serviceType: 'Rental agreement preparation and printing', areaServed: { '@type': 'City', name: 'Chennai' }, provider: { '@type': 'Organization', name: 'AgreementPrint', url: canonicalUrl('/') } };
  return <div className="mx-auto max-w-6xl space-y-14 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(service).replace(/</g, '\u003c') }} />
    <nav aria-label="Breadcrumb" className="text-sm text-stone-600"><Link href="/" className="underline underline-offset-4">Home</Link><span aria-hidden="true"> / </span><span aria-current="page">Rental agreement in Chennai</span></nav>
    <section className="rounded-3xl border border-blue-200 bg-blue-50 p-6 sm:p-10" aria-labelledby="chennai-title">
      <p className="text-sm font-bold uppercase tracking-wide text-blue-800">Prepared, printed and delivered</p>
      <h1 id="chennai-title" className="mt-4 max-w-3xl text-3xl font-extrabold leading-tight text-stone-900 sm:text-5xl">Online rental agreement in Chennai</h1>
      <p className="mt-5 max-w-2xl text-base leading-8 text-stone-700">Get your rental agreement prepared without starting from a blank document. Share your details online, review the draft, and receive your agreement printed on stamp paper by courier.</p>
      <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-stone-800">{['English and Tamil options', 'Price shown before payment', 'Courier tracking'].map(item => <li key={item} className="inline-flex items-center gap-2"><CheckCircle2 aria-hidden="true" className="h-4 w-4 text-blue-800" />{item}</li>)}</ul>
      <div className="mt-8 flex flex-wrap gap-3"><Link href="/order" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-800 px-6 py-3 font-bold text-white hover:bg-blue-900">Start your rental agreement<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link><Link href="/contact" className="inline-flex min-h-12 items-center rounded-xl border border-stone-300 bg-white px-6 py-3 font-semibold text-stone-800">Ask a question</Link></div>
    </section>
    <section aria-labelledby="chennai-process"><h2 id="chennai-process" className="text-2xl font-bold text-stone-900">From rental details to a printed agreement</h2><ol className="mt-6 grid gap-4 sm:grid-cols-2">{steps.map((step, index) => <li key={step.title} className="rounded-2xl border border-stone-200 bg-white p-6"><div className="flex items-center justify-between text-blue-800"><span className="text-sm font-bold">Step {index + 1}</span><step.icon aria-hidden="true" className="h-5 w-5" /></div><h3 className="mt-4 text-lg font-bold text-stone-900">{step.title}</h3><p className="mt-2 text-sm leading-7 text-stone-600">{step.text}</p></li>)}</ol></section>
    <section className="grid gap-8 rounded-2xl border border-stone-200 p-6 sm:p-8 md:grid-cols-2" aria-labelledby="chennai-ready"><div><h2 id="chennai-ready" className="text-2xl font-bold text-stone-900">A rental agreement for your terms</h2><p className="mt-4 leading-7 text-stone-600">Record the rent, deposit, notice period and duration agreed between you. Choose the document language, stamp-paper option and number of printed copies in the order form.</p><p className="mt-3 leading-7 text-stone-600">Need a different document or a specific format? Share your sample through our <Link href="/custom-agreement" className="font-semibold text-blue-800 underline">Custom Agreement service</Link> for review and a quote.</p></div><div><h3 className="text-lg font-bold text-stone-900">Keep these details ready</h3><ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-7 text-stone-600"><li>Landlord and tenant names, addresses and contact details.</li><li>Property address, city and PIN code.</li><li>Monthly rent, deposit and other agreed charges.</li><li>Start date, duration, notice period and delivery recipient.</li></ul></div></section>
    <section aria-labelledby="chennai-questions"><h2 id="chennai-questions" className="text-2xl font-bold text-stone-900">Questions about rental agreements in Chennai</h2><div className="mt-6 divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white px-5">{questions.map(item => <details key={item.q} className="py-5"><summary className="cursor-pointer font-semibold text-stone-900">{item.q}</summary><p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">{item.a}</p></details>)}</div><p className="mt-4 text-sm text-stone-600">Explore our <Link href="/faq" className="text-blue-800 underline">FAQs</Link>, <Link href="/shipping-policy" className="text-blue-800 underline">delivery information</Link> and <Link href="/disclaimer" className="text-blue-800 underline">service disclaimer</Link>.</p></section>
    <section className="rounded-2xl bg-blue-50 p-6 sm:p-8"><h2 className="text-2xl font-bold text-stone-900">Ready to prepare your rental agreement?</h2><p className="mt-3 text-stone-600">Start with your details. Review the draft and price before you pay.</p><Link href="/order" className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-800 px-6 py-3 font-bold text-white hover:bg-blue-900">Create your agreement<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link></section>
  </div>;
}
