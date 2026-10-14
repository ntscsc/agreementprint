import Link from 'next/link';
import { CustomRequestForm } from '@/components/custom-agreements/CustomRequestForm';
export const metadata = { title: 'Custom Agreement Requests | StampSure', description: 'Share a sample template or photo and request custom agreement drafting, subject to review and quotation.' };
export default function CustomAgreementPage() {
  return <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14"><div className="mb-7 space-y-3"><p className="text-sm font-bold uppercase tracking-wide text-brand-700">Drafted around your requirements</p><h1 className="text-3xl font-black text-stone-900">Request a Custom Agreement</h1><p className="text-stone-600">Share a sample and the changes you need. Our team will review your request and contact you with a quote. No payment is required to submit.</p><Link href="/my-requests" className="inline-block font-semibold text-brand-700 underline">View My Requests</Link></div><CustomRequestForm /></main>;
}
