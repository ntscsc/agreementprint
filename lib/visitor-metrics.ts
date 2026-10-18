import { publicPagePaths } from './seo';

const paths = new Set<string>([...publicPagePaths, '/my-orders', '/my-requests', '/track', '/referrals']);
export const isVisitorPage = (path: string) => paths.has(path);
export const isVisitorId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function visitorCalendarKeys(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  const month = `${part('year')}-${part('month')}`;
  return { day: `${month}-${part('day')}`, month };
}

export interface VisitorCounts {
  today: number;
  month: number;
  total: number;
  day: string;
  monthKey: string;
  startedAt: string | null;
}
