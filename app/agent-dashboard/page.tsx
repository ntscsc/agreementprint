import type { Metadata } from 'next';
import { AgentDashboard } from '@/components/referrals/AgentDashboard';

export const metadata: Metadata = { title: 'Agent Dashboard | AgreementPrint', robots: { index: false, follow: false } };

export default function AgentDashboardPage() {
  return <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8"><AgentDashboard /></div>;
}
