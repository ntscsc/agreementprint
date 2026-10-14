import type { Metadata } from 'next';
import { OrderIntakeWizard } from '@/components/order/OrderIntakeWizard';

export const metadata: Metadata = {
  title: 'Create a Rental Agreement | AgreementPrint',
  description: 'Enter Owner, Tenant, and Rental Property details for drafting your 11-month rental agreement on Tamil Nadu non-judicial stamp paper.',
  openGraph: {
    title: 'Create a Rental Agreement | AgreementPrint',
    description: 'Enter Owner, Tenant, and Rental Property details for drafting your 11-month rental agreement on Tamil Nadu non-judicial stamp paper.',
  },
};

export default function OrderPage() {
  return <OrderIntakeWizard />;
}
