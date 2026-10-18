'use client';

import { useSearchParams } from 'next/navigation';
import { PriceBreakdownCard } from '@/components/PriceBreakdownCard';

export function PricingOptions() {
  const params = useSearchParams();
  const stamp = params.get('stamp') === '200' ? 200 : 100;
  const region = params.get('region') === 'Within Tamil Nadu' ? 'Within Tamil Nadu' : 'Within Chennai';

  return <PriceBreakdownCard key={`${stamp}-${region}`} showCta initialStampPaper={stamp} initialLocation={region} />;
}
