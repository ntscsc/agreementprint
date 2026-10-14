import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { TrackClient } from './TrackClient';

export const metadata: Metadata = {
  title: 'Track Rental Agreement Order Status | TN Stamp Paper',
  description: 'Track your Tamil Nadu non-judicial rental agreement order, verification status, and courier consignment delivery.',
  openGraph: {
    title: 'Track Rental Agreement Order Status | TN Stamp Paper',
    description: 'Track your Tamil Nadu non-judicial rental agreement order, verification status, and courier consignment delivery.',
  },
};

export default function TrackPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto py-20 px-4 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-stone-500">Loading order tracking desk...</p>
        </div>
      }
    >
      <TrackClient />
    </Suspense>
  );
}
