import type { Metadata } from 'next';
import Link from 'next/link';
import { 
  CheckCircle2, 
  ArrowRight, 
  FileText, 
  ShieldCheck, 
  Clock, 
  Truck, 
  ChevronRight, 
  Lock 
} from 'lucide-react';
import { PriceBreakdownCard } from '@/components/PriceBreakdownCard';
import { VENDOR_CONFIG } from '@/src/config/vendor';

export const metadata: Metadata = {
  title: 'StampSure | Rental Agreements on Tamil Nadu Stamp Paper',
  description: 'Online rental agreement drafting on non-judicial stamp paper in Tamil Nadu. Clear fees: stamp duty, service fee, and courier charges shown separately.',
  openGraph: {
    title: 'StampSure | Rental Agreements on Tamil Nadu Stamp Paper',
    description: 'Online rental agreement drafting on non-judicial stamp paper in Tamil Nadu. Clear fees: stamp duty, service fee, and courier charges shown separately.',
  },
};

export default function HomePage() {
  return (
    <div className="space-y-16 bg-stone-50 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white text-stone-900 pt-10 sm:pt-16 pb-16 px-4 sm:px-6 lg:px-8 border-b border-stone-200">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Heading and Value Props */}
            <div className="lg:col-span-7 space-y-6">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-stone-900 leading-tight">
                Rental Agreements on Tamil Nadu Stamp Paper
              </h1>

              <p className="text-stone-700 text-base sm:text-lg leading-relaxed max-w-2xl font-normal">
                Submit your tenancy details online and get your agreement drafted on Tamil Nadu stamp paper, delivered directly to your doorstep.
              </p>

              {/* Core Features */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="flex items-center gap-2 text-stone-800 text-xs sm:text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
                  <span>Non-Judicial Stamp Paper</span>
                </div>
                <div className="flex items-center gap-2 text-stone-800 text-xs sm:text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
                  <span>Courier Dispatch</span>
                </div>
                <div className="flex items-center gap-2 text-stone-800 text-xs sm:text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
                  <span>1 Physical Original Copy</span>
                </div>
                <div className="flex items-center gap-2 text-stone-800 text-xs sm:text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
                  <span>Itemized Fee Transparency</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Link
                  href="/order"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-7 py-3.5 rounded-xl shadow-lg shadow-amber-800/20 text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                  <FileText className="w-5 h-5 text-white" />
                  <span>Start Your Agreement</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Right Column: Pricing Breakdown Card (reads from config) */}
            <div className="lg:col-span-5">
              <PriceBreakdownCard showCta={true} />
            </div>
          </div>
        </div>
      </section>

      {/* What We Do Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <span className="text-xs uppercase tracking-wider font-bold text-brand-800 bg-brand-100 px-3 py-1 rounded-full">
            Online Stamping Service
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
            What We Do For Landlords & Tenants in Tamil Nadu
          </h2>
          <p className="text-stone-600 text-sm sm:text-base leading-relaxed">
            Convenient, transparent agreement drafting on non-judicial stamp paper without waiting at counter queues.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center font-bold text-base">
              01
            </div>
            <h3 className="font-bold text-stone-900 text-base">Non-Judicial Stamp Paper</h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              Printed on non-judicial stamp paper in accordance with Tamil Nadu tenancy standards.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center font-bold text-base">
              02
            </div>
            <h3 className="font-bold text-stone-900 text-base">Standard Tenancy Clauses</h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              Customized 11-month agreement format with rent, maintenance, deposit, notice period, and escalation terms.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center font-bold text-base">
              03
            </div>
            <h3 className="font-bold text-stone-900 text-base">Privacy</h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              Aadhaar is optional. Only the details needed for your order are used.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center font-bold text-base">
              04
            </div>
            <h3 className="font-bold text-stone-900 text-base">Courier Dispatch</h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              1 physical original agreement dispatched to your delivery address with courier tracking details.
            </p>
          </div>
        </div>
      </section>

      {/* 4-Step "How It Works" Section */}
      <section className="bg-stone-100 py-16 px-4 sm:px-6 lg:px-8 border-y border-stone-200">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
            <span className="text-xs uppercase tracking-wider font-bold text-brand-800 bg-brand-100 px-3 py-1 rounded-full">
              Simple Process
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
              How It Works
            </h2>
            <p className="text-stone-600 text-sm sm:text-base">
              From form submission to courier delivery.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-stone-200/90 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-black text-brand-600">01</span>
                <div className="p-2 bg-brand-50 rounded-lg text-brand-800">
                  <FileText className="w-5 h-5" />
                </div>
              </div>
              <h3 className="font-bold text-stone-900 text-base">Enter Agreement Details</h3>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                Submit owner, tenant, property details, rent amount, security deposit, and duration online.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-stone-200/90 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-black text-brand-600">02</span>
                <div className="p-2 bg-brand-50 rounded-lg text-brand-800">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>
              <h3 className="font-bold text-stone-900 text-base">Review and Pay Online</h3>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                Check the agreement details and pay online. Stamp duty, service fee, and courier charges are shown separately.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-stone-200/90 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-black text-brand-600">03</span>
                <div className="p-2 bg-brand-50 rounded-lg text-brand-800">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <h3 className="font-bold text-stone-900 text-base">Drafting & Stamping</h3>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                The details are reviewed, the agreement is drafted, and it is printed on non-judicial stamp paper.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-stone-200/90 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-black text-brand-600">04</span>
                <div className="p-2 bg-brand-50 rounded-lg text-brand-800">
                  <Truck className="w-5 h-5" />
                </div>
              </div>
              <h3 className="font-bold text-stone-900 text-base">Courier Delivery</h3>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                The physical stamped document is couriered to your address with a consignment tracking number.
              </p>
            </div>
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-800 hover:text-brand-800 transition-colors"
            >
              <span>View full process</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing Summary Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <span className="text-xs uppercase tracking-wider font-bold text-stone-800 bg-stone-200 px-3 py-1 rounded-full">
            Transparent Pricing
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
            Pricing Summary
          </h2>
          <p className="text-stone-600 text-sm sm:text-base">
            Stamp duty, vendor service fee, and courier charges are shown separately.
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <PriceBreakdownCard showCta={true} />
        </div>
      </section>
    </div>
  );
}
