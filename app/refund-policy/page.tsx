import { canonicalUrl } from '@/lib/seo';
import type { Metadata } from 'next';
import { SuppliedPolicyPage } from '@/components/SuppliedPolicyPage';

export const metadata: Metadata = {
  alternates: { canonical: canonicalUrl('/refund-policy') }, title: 'Refund and Cancellation policy | AgreementPrint' };

export default function Page() {
  return <SuppliedPolicyPage policy="refund-policy" />;
}
