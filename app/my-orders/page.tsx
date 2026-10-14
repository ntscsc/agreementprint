import type { Metadata } from 'next';
import { MyOrdersClient } from './MyOrdersClient';

export const metadata: Metadata = {
  title: 'My Orders & Agreement Applications | TN Stamp Paper',
  description: 'View your submitted rental agreement orders, track stamping progress, respond to correction requests, and monitor courier delivery.',
  openGraph: {
    title: 'My Orders & Agreement Applications | TN Stamp Paper',
    description: 'View your submitted rental agreement orders, track stamping progress, respond to correction requests, and monitor courier delivery.',
  },
};

export default function MyOrdersPage() {
  return <MyOrdersClient />;
}
