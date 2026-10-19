import Link from 'next/link';
import { CustomRequests } from '@/components/custom-agreements/CustomRequests';
export const metadata = { title: 'My Custom Agreement Requests | AgreementPrint' };
export default function MyRequestsPage() {
  return <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
    <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-sm font-bold uppercase tracking-widest text-brand-700">Your account</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">My Requests</h1><p className="mt-2 text-sm text-stone-600">Track your custom agreements, quotes and messages from our team.</p></div>
      <Link href="/custom-agreement" className="inline-flex min-h-11 items-center justify-center self-start rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-800">New Custom Request</Link>
    </header>
    <CustomRequests />
  </div>;
}
