'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { DisclaimerBanner } from '@/components/DisclaimerBanner';
import { WhatsAppButton } from '@/components/WhatsAppButton';

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return <><main className="flex-1">{children}</main><footer className="border-t border-stone-200 px-4 py-3 text-center text-xs text-stone-600">AgreementPrint Administration <span aria-hidden="true">·</span> <Link href="/" className="font-semibold text-blue-800 hover:underline">View website</Link></footer></>;
  }
  return <><DisclaimerBanner compact /><Header /><main className="flex-1">{children}</main><WhatsAppButton variant="floating" /><Footer /></>;
}
