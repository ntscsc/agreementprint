'use client';

import { Celebration } from '@/components/Celebration';
export function AdminMilestone({ uid, paidOrders, ready }: { uid: string; paidOrders: number; ready: boolean }) {
  const milestone = [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000].filter(value => value <= paidOrders).at(-1);
  return <Celebration eventKey={ready && milestone ? `agreementprint:celebration:milestone:${uid}:${milestone}` : null} progressKey={`agreementprint:celebration:milestone-progress:${uid}`} progressValue={milestone} message={`${milestone?.toLocaleString('en-IN') ?? ''} paid orders! A milestone worth celebrating.`} />;
}
