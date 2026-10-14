import type { Metadata } from 'next';
import { AdminClient } from './AdminClient';

export const metadata: Metadata = {
  title: 'Certified Stamp Vendor Portal | Administration',
  description: 'Protected vendor dashboard for Tamil Nadu rental agreement verification, drafting, correction requests, and courier consignment fulfilment.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminPage() {
  return <AdminClient />;
}
