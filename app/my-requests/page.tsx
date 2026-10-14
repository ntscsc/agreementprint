import Link from 'next/link';
import { CustomRequests } from '@/components/custom-agreements/CustomRequests';
export const metadata = { title: 'My Custom Agreement Requests | StampSure' };
export default function MyRequestsPage() { return <main className="mx-auto max-w-4xl px-4 py-10"><h1 className="mb-3 text-3xl font-black">Custom Agreement Requests</h1><p className="mb-4 text-stone-600">View progress, quotes and clarification requests from our team.</p><Link href="/custom-agreement" className="mb-7 inline-block font-semibold text-brand-700 underline">Request a Custom Agreement</Link><CustomRequests /></main>; }
