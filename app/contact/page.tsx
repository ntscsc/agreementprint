import type { Metadata } from 'next';
import { ContactClient } from './ContactClient';

export const metadata: Metadata = {
  title: 'Contact Support | TN Stamp Paper',
  description: 'Contact support for rental agreement drafting, stamp paper, and courier tracking in Tamil Nadu.',
};

export default function ContactPage() {
  return <ContactClient />;
}
