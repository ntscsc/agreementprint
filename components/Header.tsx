'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, FileText, User, LogOut, ChevronDown } from 'lucide-react';
import { VENDOR_SERVICE_TITLE } from '@/src/config/vendor';
import { useI18n } from '@/lib/i18n/context';
import { useAuth } from '@/lib/auth-context';

interface HeaderProps { onStartAgreement?: () => void; }
interface NavItem { label: string; href: string; }

export const Header: React.FC<HeaderProps> = ({ onStartAgreement }) => {
  const { t } = useI18n();
  const { user, isAdmin, signOut, signInWithGoogle } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const activeMenuRef = useRef<HTMLDivElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const closeMenus = () => { setOpenMenu(null); setMobileMenuOpen(false); };

  useEffect(() => {
    if (!openMenu && !mobileMenuOpen) return;
    const outside = (event: PointerEvent) => {
      if (openMenu && event.target instanceof Node && !activeMenuRef.current?.contains(event.target)) setOpenMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (openMenu) document.getElementById(`nav-${openMenu}-button`)?.focus();
      else mobileButtonRef.current?.focus();
      setOpenMenu(null); setMobileMenuOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [openMenu, mobileMenuOpen]);

  const primary: NavItem[] = [
    { label: t.nav.home, href: '/' },
    { label: 'Services', href: '/services' },
    { label: t.nav.pricing, href: '/pricing' },
    { label: t.nav.howItWorks, href: '/how-it-works' },
  ];
  const groups = [
    { id: 'agreements', label: 'Agreements', links: [
      { label: 'Rental Agreement', href: '/order' },
      { label: 'Custom Agreement', href: '/custom-agreement' },
      { label: t.nav.rentReceipt, href: '/rent-receipt' },
    ] },
    { id: 'help', label: 'Help', links: [
      { label: t.nav.faq, href: '/faq' },
      { label: t.nav.contact, href: '/contact' },
    ] },
  ];
  const account: NavItem[] = [
    ...(isAdmin ? [{ label: 'Admin Portal', href: '/admin' }] : []),
    { label: 'My Orders', href: '/my-orders' },
    { label: 'My Requests', href: '/my-requests' },
    { label: t.nav.trackOrder, href: '/track' },
    { label: 'Referral Credits', href: '/referrals' },
  ];
  const linkClass = (href: string, dropdown = false) => dropdown
    ? `block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${pathname === href ? 'bg-amber-50 text-amber-900' : 'text-stone-700 hover:bg-stone-100'}`
    : `rounded-lg px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${pathname === href ? 'bg-white/20 text-white' : 'text-blue-50 hover:bg-white/15'}`;
  const renderLink = (link: NavItem, dropdown = false) => (
    <Link key={link.href} href={link.href} aria-current={pathname === link.href ? 'page' : undefined} onClick={closeMenus} className={linkClass(link.href, dropdown)}>{link.label}</Link>
  );
  const actionClass = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';
  const start = () => { closeMenus(); onStartAgreement?.(); };
  const signIn = () => { closeMenus(); void signInWithGoogle().catch(() => {}); };
  const signOutUser = () => { closeMenus(); void signOut(); };

  return (
    <header className="sticky top-0 z-50 border-b border-[#0b4f86] bg-[#0b5e9e] text-white shadow-sm">
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-20 items-center justify-between gap-3 py-2 sm:gap-4">
          <Link href="/" onClick={closeMenus} className="group flex min-w-0 items-center gap-1.5 sm:gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            <span className="flex h-9 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white sm:h-11 sm:w-12">
              <svg aria-hidden="true" viewBox="245 106 208 179" className="h-full w-full">
                <image href="/agreementprint-logo.png" width="677" height="369" />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block text-base font-extrabold tracking-tight text-[#ffb15c] transition group-hover:text-[#ffd29c] sm:text-lg">AgreementPrint</span>
              <span className="mt-0.5 block whitespace-nowrap text-[7px] font-medium leading-3 text-blue-100 min-[400px]:text-[8px] sm:text-[10px] sm:leading-4">{VENDOR_SERVICE_TITLE}</span>
            </span>
          </Link>

          <nav aria-label="Main navigation" className="hidden items-center gap-1 2xl:flex">
            {renderLink(primary[0])}
            {groups.slice(0, 1).map((group) => (
              <div key={group.id} className="relative" ref={openMenu === group.id ? activeMenuRef : undefined}>
                <button id={`nav-${group.id}-button`} type="button" aria-expanded={openMenu === group.id} aria-controls={`nav-${group.id}-links`} onClick={() => setOpenMenu(openMenu === group.id ? null : group.id)} className={`flex items-center gap-1 ${linkClass(group.links.some((link) => pathname === link.href) ? pathname : '')}`}>
                  {group.label}<ChevronDown className={`h-4 w-4 transition-transform ${openMenu === group.id ? 'rotate-180' : ''}`} />
                </button>
                {openMenu === group.id && <div id={`nav-${group.id}-links`} className="absolute left-0 top-full mt-2 w-56 rounded-xl border border-stone-200 bg-white p-2 shadow-xl">{group.links.map((link) => renderLink(link, true))}</div>}
              </div>
            ))}
            {primary.slice(1).map((link) => renderLink(link))}
            {groups.slice(1).map((group) => (
              <div key={group.id} className="relative" ref={openMenu === group.id ? activeMenuRef : undefined}>
                <button id={`nav-${group.id}-button`} type="button" aria-expanded={openMenu === group.id} aria-controls={`nav-${group.id}-links`} onClick={() => setOpenMenu(openMenu === group.id ? null : group.id)} className={`flex items-center gap-1 ${linkClass(group.links.some((link) => pathname === link.href) ? pathname : '')}`}>
                  {group.label}<ChevronDown className={`h-4 w-4 transition-transform ${openMenu === group.id ? 'rotate-180' : ''}`} />
                </button>
                {openMenu === group.id && <div id={`nav-${group.id}-links`} className="absolute left-0 top-full mt-2 w-52 rounded-xl border border-stone-200 bg-white p-2 shadow-xl">{group.links.map((link) => renderLink(link, true))}</div>}
              </div>
            ))}
          </nav>

          <div className="hidden items-center gap-3 2xl:flex">
            <div className="relative border-l border-white/20 pl-3" ref={openMenu === 'account' ? activeMenuRef : undefined}>
              <button id="nav-account-button" type="button" aria-expanded={openMenu === 'account'} aria-controls="nav-account-links" onClick={() => setOpenMenu(openMenu === 'account' ? null : 'account')} className={`flex items-center gap-2 ${linkClass(account.some((link) => pathname === link.href) ? pathname : '')}`}>
                <User className="h-4 w-4" /><span>My Account</span><ChevronDown className={`h-4 w-4 transition-transform ${openMenu === 'account' ? 'rotate-180' : ''}`} />
              </button>
              {openMenu === 'account' && <div id="nav-account-links" className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-stone-200 bg-white p-2 shadow-xl">
                {user && <div className="border-b border-stone-100 px-3 py-2"><p className="truncate text-sm font-semibold text-stone-900">{user.displayName || 'My Account'}</p><p className="truncate text-xs text-stone-500">{user.email}</p></div>}
                {account.map((link) => renderLink(link, true))}
                <div className="mt-1 border-t border-stone-100 pt-1">{user ? <button type="button" onClick={signOutUser} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-100"><LogOut className="h-4 w-4" />Sign Out</button> : <button type="button" onClick={signIn} className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-amber-800 hover:bg-amber-50">Sign In with Google</button>}</div>
              </div>}
            </div>
            {onStartAgreement ? <button type="button" onClick={start} className={actionClass}><FileText className="h-4 w-4" />Start Agreement</button> : <Link href="/order" onClick={closeMenus} className={actionClass}><FileText className="h-4 w-4" />Start Agreement</Link>}
          </div>

          <div className="flex items-center gap-2 2xl:hidden">
            <div className="hidden sm:block">{onStartAgreement ? <button type="button" onClick={start} className={actionClass}>Start Agreement</button> : <Link href="/order" onClick={closeMenus} className={actionClass}>Start Agreement</Link>}</div>
            <button ref={mobileButtonRef} type="button" onClick={() => { setOpenMenu(null); setMobileMenuOpen(!mobileMenuOpen); }} aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation" className="rounded-lg p-2 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">{mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}</button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && <nav id="mobile-navigation" aria-label="Mobile navigation" className="max-h-[calc(100dvh-5rem)] overflow-y-auto border-t border-stone-200 bg-stone-50 px-4 py-5 2xl:hidden">
        <div className="mx-auto max-w-3xl space-y-5">
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">{primary.map((link) => renderLink(link, true))}</div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {[...groups, { id: 'account', label: 'My Account', links: account }].map((group) => <section key={group.id} aria-labelledby={`mobile-${group.id}`} className="rounded-xl border border-stone-200 bg-white p-3"><h2 id={`mobile-${group.id}`} className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-wide text-stone-500">{group.label}</h2>{group.links.map((link) => renderLink(link, true))}{group.id === 'account' && <div className="mt-2 border-t border-stone-100 px-3 pt-3">{user ? <><p className="mb-2 truncate text-xs text-stone-500">{user.displayName || user.email}</p><button type="button" onClick={signOutUser} className="text-sm font-semibold text-stone-700">Sign Out</button></> : <button type="button" onClick={signIn} className="text-sm font-semibold text-amber-800">Sign In with Google</button>}</div>}</section>)}
          </div>
          {onStartAgreement ? <button type="button" onClick={start} className={`${actionClass} w-full`}>Start Your Agreement</button> : <Link href="/order" onClick={closeMenus} className={`${actionClass} w-full`}>Start Your Agreement</Link>}
        </div>
      </nav>}
    </header>
  );
};
