import type { Metadata } from 'next';
import { SuppliedPolicyPage } from '@/components/SuppliedPolicyPage';

export const metadata: Metadata = { title: 'Terms & Conditions | AgreementPrint' };

export default function Page() {
  return <SuppliedPolicyPage policy="terms" />;
}
