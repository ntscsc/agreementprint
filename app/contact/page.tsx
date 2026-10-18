import { canonicalUrl } from '@/lib/seo';
import type { Metadata } from 'next';
import { ContactClient } from './ContactClient';

export const metadata: Metadata = {
  alternates: { canonical: canonicalUrl('/contact') },
  title: 'Contact Support | AgreementPrint',
  description: 'Contact support for rental agreement drafting, stamp paper, and courier tracking in Tamil Nadu.',
};

export default function ContactPage() {
  return <ContactClient />;
}
