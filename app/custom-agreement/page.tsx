import { canonicalUrl } from '@/lib/seo';
import Link from 'next/link';
import { CustomRequestForm } from '@/components/custom-agreements/CustomRequestForm';
export const metadata = {
  robots: { index: false, follow: false },
  alternates: { canonical: canonicalUrl('/custom-agreement') }, title: 'Custom Agreement Requests | AgreementPrint', description: 'Share a sample template or photo and request custom agreement drafting, subject to review and quotation.' };
export default function CustomAgreementPage() {
  return <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8"><header className="mb-5"><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold tracking-tight text-stone-900">Customized agreement</h1><Link href="/my-requests" className="text-sm font-semibold text-brand-700 hover:underline">My requests</Link></div><p className="mt-2 text-sm leading-relaxed text-stone-600">Share a sample and tell us what to change. We will review it and send you a quote.</p><p className="mt-1 text-xs text-stone-500">(Indemnity Bond, Affidavit, No Objection, Letter of Indemnity, Sale Agreement and Other documents etc.)</p></header><CustomRequestForm /></div>;
}
