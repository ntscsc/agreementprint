import type { Metadata } from 'next';
import { SuppliedPolicyPage } from '@/components/SuppliedPolicyPage';

export const metadata: Metadata = { title: 'Shipping Policy | AgreementPrint' };

export default function Page() {
  return <SuppliedPolicyPage policy="shipping-policy" />;
}
