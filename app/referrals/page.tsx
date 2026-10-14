import type { Metadata } from 'next';
import { ReferralDashboard } from '@/components/referrals/ReferralDashboard';

export const metadata: Metadata = {
  title: 'Referral Credits | StampSure',
  description: 'Share your StampSure referral code, track eligible referrals, and view your available credits.',
};

export default function ReferralsPage() {
  return (
    <div className="py-10 sm:py-14">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <ReferralDashboard />
      </div>
    </div>
  );
}
