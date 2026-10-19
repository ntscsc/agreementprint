'use client';

import React from 'react';
import Link from 'next/link';
import { BrandMark } from '@/components/BrandMark';
import { Mail, Truck } from 'lucide-react';
import { SupportEmailLink } from '@/components/SupportEmailLink';
import { VENDOR_CONFIG, VENDOR_SERVICE_TITLE, WHATSAPP_URL } from '@/src/config/vendor';
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
  { label: 'Customer Reviews', href: '/reviews' },
  { label: 'Contact Us', href: '/contact' },
];
const policies = [
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Refunds & Cancellations', href: '/refund-policy' },
  { label: 'Returns & Replacements', href: '/return-policy' },
  { label: 'Shipping & Delivery', href: '/shipping-policy' },
  { label: 'Disclaimer', href: '/disclaimer' },
];

export const Footer: React.FC = () => {
  const { user, loading, isAdmin } = useAuth();
  const visibleHelp = help.filter(link => link.href !== '/pricing' || (!loading && !!user));
  const account = [
    { label: 'My Orders', href: '/my-orders' },
    { label: 'My Requests', href: '/my-requests' },
    { label: 'Track My Order', href: '/track' },
    { label: 'Referral Credits', href: '/referrals' },
    ...(isAdmin ? [{ label: 'Admin Portal', href: '/admin' }] : []),
  ];
  const focus = 'rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white';

  return (
    <footer className="w-full border-t border-[#334b74] bg-[linear-gradient(120deg,#172343_0%,#24245b_55%,#134750_100%)] text-blue-50">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-5 py-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.85fr)] lg:gap-8">
          <div className="space-y-2">
            <Link href="/" className={`${focus} inline-flex items-center gap-2.5`}><span className="flex h-11 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white"><BrandMark className="h-full w-full" /></span><span className="text-lg font-extrabold tracking-tight text-[#ffffff]">AgreementPrint</span></Link>
            <p className="max-w-md text-sm font-semibold leading-relaxed text-[#f1f5f9]">{VENDOR_SERVICE_TITLE}</p>
            <p className="max-w-md text-sm leading-relaxed text-blue-50">Stamp paper, e-Stamps and agreements made simple. Get your rental agreement prepared, printed and delivered across Tamil Nadu.</p>
            <div className="flex items-start gap-2 text-sm text-blue-50"><Truck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#dcfce7]" /><span>Courier delivery with tracking</span></div>
            <div className="flex items-start gap-2 text-sm text-blue-50"><Mail aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#dcfce7]" /><SupportEmailLink className={`${focus} min-w-0 break-all hover:text-[#dcfce7] hover:underline`} /></div>
            <p className="text-sm text-blue-50"><a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={`${focus} hover:text-[#dcfce7] hover:underline`}>WhatsApp only: {VENDOR_CONFIG.whatsappNumber}</a></p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            {[{ title: 'Services', links: services }, { title: 'My Account', links: account }, { title: 'Help', links: visibleHelp }].map((group) => <nav key={group.title} aria-label={`Footer ${group.title}`}><h2 className="text-sm font-bold text-[#ffffff]">{group.title}</h2><ul className="mt-2 space-y-0">{group.links.map((link) => <li key={link.href}><Link href={link.href} className={`${focus} inline-block py-1 text-sm leading-relaxed text-blue-50 transition hover:text-[#dcfce7] hover:underline`}>{link.label}</Link></li>)}</ul></nav>)}
          </div>
        </div>

        <div className="space-y-2 border-t border-[#ffffff26] py-3">
          <nav aria-label="Policies" className="flex flex-wrap gap-x-5 gap-y-2">{policies.map((link) => <Link key={link.href} href={link.href} className={`${focus} py-1 text-xs font-medium text-blue-50 hover:text-[#dcfce7] hover:underline`}>{link.label}</Link>)}</nav>
          <div className="flex flex-col gap-2 text-xs leading-relaxed text-blue-50 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} AgreementPrint. All rights reserved.</p><div className="flex flex-wrap gap-x-5 gap-y-2"><SupportEmailLink className={`${focus} hover:text-[#dcfce7] hover:underline`}>Contact Support</SupportEmailLink><a href="mailto:pradhiip1992official@gmail.com" className={`${focus} hover:text-[#dcfce7] hover:underline`}>Contact Developer</a></div></div>
        </div>
      </div>
    </footer>
  );
};
