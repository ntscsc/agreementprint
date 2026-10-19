import Link from 'next/link';

const policies = [
  ['Privacy Policy', '/privacy-policy'], ['Terms & Conditions', '/terms'],
  ['Refund & Cancellation Policy', '/refund-policy'], ['Return Policy', '/return-policy'],
  ['Shipping Policy', '/shipping-policy'], ['Disclaimer', '/disclaimer'],
];
export function PolicyNavigation({ current }: { current?: string }) {
  return <nav aria-label="Policies" className="mt-6 flex flex-wrap gap-x-5 gap-y-3 border-t border-stone-200 pt-5 text-sm font-medium text-brand-800 underline underline-offset-4">{policies.map(([label, href]) => <Link key={href} href={href} aria-current={current === href ? 'page' : undefined}>{label}</Link>)}</nav>;
}
