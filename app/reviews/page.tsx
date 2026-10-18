import type { Metadata } from 'next';
import { CustomerReviews } from '@/components/reviews/CustomerReviews';
import { canonicalUrl } from '@/lib/seo';

export const metadata: Metadata = { title: 'Customer Reviews | AgreementPrint', description: 'Read customer experiences and share your feedback about AgreementPrint.', alternates: { canonical: canonicalUrl('/reviews') } };
export default function ReviewsPage() {
  return <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14"><CustomerReviews /></div>;
}
