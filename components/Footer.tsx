'use client';

import React from 'react';
import Link from 'next/link';
import { Mail, Truck } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { SupportEmailLink } from '@/components/SupportEmailLink';
import { VENDOR_SERVICE_TITLE } from '@/src/config/vendor';
import { useAuth } from '@/lib/auth-context';

const services = [
  { label: 'Rental Agreements', href: '/order' },
  { label: 'Custom Agreements', href: '/custom-agreement' },
  { label: 'Free Rent Receipts', href: '/rent-receipt' },
  { label: 'All Services', href: '/services' },
];
const help = [
  { label: 'Pricing', href: '/pricing' },
  { label: 'How It Works', href: '/how-it-works' },
  { label: 'Common Questions', href: '/faq' },
  { label: 'Contact Us', href: '/contact' },
];
const policies = [
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Refunds & Cancellations', href: '/refund-policy' },
  { label: 'Disclaimer', href: '/disclaimer' },
];

export const Footer: React.FC = () => {
  const { isAdmin } = useAuth();
  const account = [
    { label: 'My Orders', href: '/my-orders' },
    { label: 'My Requests', href: '/my-requests' },
    { label: 'Track My Order', href: '/track' },
    { label: 'Referral Credits', href: '/referrals' },
    ...(isAdmin ? [{ label: 'Admin Portal', href: '/admin' }] : []),
  ];
  const focus = 'rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-700';

  return (
    <footer className="border-t border-stone-200 bg-stone-100 text-stone-700">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-9 py-9 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.85fr)] lg:gap-12">
          <div className="space-y-4">
            <Link href="/" className={`${focus} inline-flex items-center gap-2.5`}><BrandMark className="h-10 w-10 shrink-0" /><span className="text-lg font-extrabold tracking-tight text-[#b84d12]">AgreementPrint</span></Link>
            <p className="max-w-md text-sm font-semibold leading-relaxed text-stone-800">{VENDOR_SERVICE_TITLE}</p>
            <p className="max-w-md text-sm leading-relaxed text-stone-600">Stamp paper, e-Stamps and agreements made simple. Get your rental agreement prepared, printed and delivered across Tamil Nadu.</p>
            <div className="flex items-start gap-2 text-sm text-stone-600"><Truck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" /><span>Courier delivery with tracking</span></div>
            <div className="flex items-start gap-2 text-sm text-stone-700"><Mail aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" /><SupportEmailLink className={`${focus} min-w-0 break-all hover:text-amber-800 hover:underline`} /></div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3">
            {[{ title: 'Services', links: services }, { title: 'My Account', links: account }, { title: 'Help', links: help }].map((group) => <nav key={group.title} aria-label={`Footer ${group.title}`}><h2 className="text-sm font-bold text-stone-900">{group.title}</h2><ul className="mt-3 space-y-1">{group.links.map((link) => <li key={link.href}><Link href={link.href} className={`${focus} inline-block py-2 text-sm leading-relaxed text-stone-600 transition hover:text-amber-800 hover:underline`}>{link.label}</Link></li>)}</ul></nav>)}
          </div>
        </div>

        <div className="space-y-4 border-t border-stone-300 py-6">
          <nav aria-label="Policies" className="flex flex-wrap gap-x-5 gap-y-2">{policies.map((link) => <Link key={link.href} href={link.href} className={`${focus} py-1 text-xs font-medium text-stone-600 hover:text-amber-800 hover:underline`}>{link.label}</Link>)}</nav>
          <div className="flex flex-col gap-3 text-xs leading-relaxed text-stone-600 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} AgreementPrint. All rights reserved.</p><a href="mailto:pradhiip1992official@gmail.com" className={`${focus} hover:text-amber-800 hover:underline`}>Contact Developer</a></div>
        </div>
      </div>
    </footer>
  );
};
