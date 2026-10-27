import Link from 'next/link';
import { RequestIcon } from '@/components/custom-agreements/RequestIcon';
import { CustomRequests } from '@/components/custom-agreements/CustomRequests';
export const metadata = { title: 'My Custom Agreement Requests | AgreementPrint' };
export default function MyRequestsPage() {
  return <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
    <header><div className="flex items-center justify-between gap-3"><h1 className="text-2xl font-bold tracking-tight text-stone-900">My requests</h1><Link href="/custom-agreement" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"><RequestIcon name="plus" />New request</Link></div><p className="mt-2 text-sm text-stone-600">Your custom documents, quotes and updates.</p></header>
    <CustomRequests />
  </div>;
}
