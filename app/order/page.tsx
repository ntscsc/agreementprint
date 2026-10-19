import { canonicalUrl, socialImage } from '@/lib/seo';
import type { Metadata } from 'next';
import { OrderIntakeWizard } from '@/components/order/OrderIntakeWizard';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: { canonical: canonicalUrl('/order') },
  title: 'Create a Rental Agreement | AgreementPrint',
  description: 'Enter Owner, Tenant, and Rental Property details for drafting your 11-month rental agreement on Tamil Nadu non-judicial stamp paper.',
  openGraph: {
    images: [socialImage],
    title: 'Create a Rental Agreement | AgreementPrint',
    description: 'Enter Owner, Tenant, and Rental Property details for drafting your 11-month rental agreement on Tamil Nadu non-judicial stamp paper.',
  },
};

export default function OrderPage() {
  return <OrderIntakeWizard />;
}
