import type { Metadata } from 'next';
import Link from 'next/link';
import { 
  FileText, 
  CreditCard, 
  Printer, 
  Truck, 
  ArrowRight
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'How It Works | Rental Agreement Process in Tamil Nadu',
  description: 'Learn the steps to submit rental agreement details, review charges, and receive the document by courier in Tamil Nadu.',
  openGraph: {
    title: 'How It Works | Rental Agreement Process in Tamil Nadu',
    description: 'Learn the steps to submit rental agreement details, review charges, and receive the document by courier in Tamil Nadu.',
  },
};

export default function HowItWorksPage() {
  const steps = [
    {
      num: '01',
      icon: <FileText className="w-6 h-6 text-amber-700" />,
      title: 'Submit Agreement Details Online',
      desc: 'Fill in the owner, tenant, and property details in the form. Aadhaar is optional.',
      details: [
        'Owner and tenant name, age, and contact details',
        'Identification details such as Aadhaar, Voter ID, PAN, or Passport',
        'Rent amount, security deposit, notice period, and tenancy duration',
        'Simple form with clear fields and a review step before payment',
      ],
    },
    {
      num: '02',
      icon: <CreditCard className="w-6 h-6 text-sky-700" />,
      title: 'Review & Pay Online',
      desc: 'Check the details on the summary page and complete the payment online. The price and optional services are shown before checkout.',
      details: [
        'Digital order confirmation with your Order ID',
        'Secure payment process with confirmation by email or SMS',
        'Status updates available through the order tracking link',
      ],
    },
    {
      num: '03',
      icon: <Printer className="w-6 h-6 text-purple-700" />,
      title: 'Drafting & Stamp Paper',
      desc: 'The agreement is prepared using standard tenancy terms and printed on non-judicial stamp paper with the required serial number.',
      details: [
        'Tamil Nadu non-judicial stamp paper with serial number',
        'Standard tenancy clauses based on local requirements',
        'Review for names, dates, and property details before dispatch',
      ],
    },
    {
      num: '04',
      icon: <Truck className="w-6 h-6 text-emerald-700" />,
      title: 'Courier Delivery',
      desc: 'Once the document is ready, it is packed and sent by courier with tracking information.',
      details: [
        'Dispatch after document verification',
        'Courier tracking details shared with your order',
        'Sign the agreement with the tenant and two witnesses on delivery',
      ],
    },
  ];

  return (
    <div className="space-y-14 py-8 pb-16">
      {/* Hero Header */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-stone-900 text-white rounded-3xl p-8 sm:p-12 border border-stone-800 shadow-sm relative overflow-hidden">
          <div className="max-w-3xl space-y-4">
            <span className="text-xs uppercase tracking-wider font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
              Simple Process
            </span>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              How the Rental Agreement Process Works
            </h1>

            <p className="text-stone-300 text-base sm:text-lg leading-relaxed">
              A straightforward 4-step process for submitting details, reviewing the charges, preparing the document, and receiving it by courier in Tamil Nadu.
            </p>

            <div className="pt-2">
              <Link
                href="/order"
                className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold px-6 py-3 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:translate-y-0.5 inline-flex items-center gap-2"
              >
                <span>Start Rental Agreement</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Step by step cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {steps.map((st, idx) => (
            <div
              key={idx}
              className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow grid grid-cols-1 lg:grid-cols-12 gap-6 items-center"
            >
              <div className="lg:col-span-1 flex items-center justify-start lg:justify-center">
                <div className="w-14 h-14 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center font-black text-2xl text-stone-800">
                  {st.num}
                </div>
              </div>

              <div className="lg:col-span-11 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-stone-50 rounded-lg border border-stone-200/60">
                    {st.icon}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-stone-900">{st.title}</h2>
                </div>

                <p className="text-stone-600 text-sm leading-relaxed">{st.desc}</p>

                <div className="space-y-1.5 pt-2">
                  {st.details.map((item, dIdx) => (
                    <div key={dIdx} className="flex items-start gap-2 text-xs text-stone-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0 mt-1.5"></span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
