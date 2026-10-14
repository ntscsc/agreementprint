'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BrandMark } from '@/components/BrandMark';
import { usePathname } from 'next/navigation';
import { 
  Menu, 
  X, 
  FileText, 
  User,
  LogOut,
  ChevronDown
} from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { useAuth } from '@/lib/auth-context';

interface HeaderProps {
  onStartAgreement?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onStartAgreement }) => {
  const { t } = useI18n();
  const { user, signOut, signInWithGoogle } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const exploreMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exploreOpen && !accountOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node) {
        if (exploreOpen && !exploreMenuRef.current?.contains(event.target)) {
          setExploreOpen(false);
        }
        if (accountOpen && !accountMenuRef.current?.contains(event.target)) {
          setAccountOpen(false);
        }
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExploreOpen(false);
        setAccountOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [exploreOpen, accountOpen]);

  const primaryNavLinks = [
    { label: t.nav.home, href: '/' },
    { label: t.nav.howItWorks, href: '/how-it-works' },
    { label: t.nav.rentReceipt, href: '/rent-receipt' },
    { label: t.nav.pricing, href: '/pricing' },
  ];

  const exploreLinks = [
    { label: 'Custom Agreement', href: '/custom-agreement' },
    { label: 'My Requests', href: '/my-requests' },
    { label: t.nav.faq, href: '/faq' },
    { label: t.nav.contact, href: '/contact' },
    { label: t.nav.trackOrder, href: '/track' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-[#0b4f86] bg-[#0b5e9e] text-white shadow-sm">
      {/* Main Navigation Bar */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo / Brand */}
          <Link
            href="/"
            className="flex items-center gap-3 text-left group rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            <BrandMark className="h-10 w-10 shrink-0" />
            <div>
              <div className="font-extrabold text-base sm:text-lg text-[#ffb15c] tracking-tight group-hover:text-[#ffd29c] transition-colors flex items-center gap-1.5">
                <span>StampSure</span>
              </div>
              <p className="text-[11px] text-blue-100 font-normal leading-tight hidden 2xl:block">
                Non-Judicial Stamp Paper Agreement Drafting
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden xl:flex items-center gap-1">
            {primaryNavLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold tracking-wide transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'text-blue-50 hover:text-white hover:bg-white/15'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="relative" ref={exploreMenuRef}>
              <button
                type="button"
                onClick={() => setExploreOpen((open) => !open)}
                className={`flex cursor-pointer items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold tracking-wide transition-colors ${
                  exploreLinks.some((link) => pathname === link.href) || exploreOpen
                    ? 'bg-white/20 text-white'
                    : 'text-blue-50 hover:text-white hover:bg-white/15'
                }`}
                aria-expanded={exploreOpen}
                aria-haspopup="menu"
              >
                Explore
                <ChevronDown className={`h-4 w-4 transition-transform ${exploreOpen ? 'rotate-180' : ''}`} />
              </button>
              {exploreOpen && (
                <div className="absolute left-0 top-full z-50 mt-2 min-w-48 rounded-xl border border-stone-200 bg-white p-2 shadow-xl">
                  {exploreLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setExploreOpen(false)}
                      className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        pathname === link.href
                          ? 'bg-brand-100 text-brand-800'
                          : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* Action CTAs */}
          <div className="hidden xl:flex items-center gap-2">
            {/* User Account / Sign In Status */}
            {user ? (
              <div className="relative" ref={accountMenuRef}>
                <button
                  type="button"
                  onClick={() => setAccountOpen((open) => !open)}
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                  className="flex max-w-40 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100">
                    <User className="h-4 w-4 fill-current text-brand-800" />
                  </span>
                  <span className="truncate">{user.displayName || 'Account'}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-blue-100 transition-transform ${accountOpen ? 'rotate-180' : ''}`} />
                </button>
                {accountOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-stone-200 bg-white p-2 shadow-xl">
                    <p className="truncate px-3 py-2 text-xs text-stone-500">{user.email}</p>
                    <Link href="/my-orders" onClick={() => setAccountOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm text-stone-700 hover:bg-stone-100 hover:text-stone-900">
                      My Orders
                    </Link>
                    <Link href="/referrals" onClick={() => setAccountOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm text-stone-700 hover:bg-stone-100 hover:text-stone-900">
                      Referral Credits
                    </Link>
                    <button
                      onClick={() => {
                        setAccountOpen(false);
                        signOut();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-stone-700 hover:bg-stone-100 hover:text-brand-700 cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => signInWithGoogle().catch(() => {})}
                className="px-3 py-2 rounded-xl text-sm text-white font-medium transition-colors cursor-pointer flex items-center gap-1.5 hover:bg-white/15"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100">
                  <User className="h-4 w-4 fill-current text-brand-800" />
                </span>
                <span>Sign In</span>
              </button>
            )}

            {onStartAgreement ? (
              <button
                onClick={onStartAgreement}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-sm transition-all flex items-center gap-2 hover:shadow-amber-500/20 active:translate-y-0.5 cursor-pointer whitespace-nowrap"
              >
                <FileText className="w-4 h-4 text-white" />
                <span>Start Agreement</span>
              </button>
            ) : (
              <Link
                href="/order"
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-sm transition-all flex items-center gap-2 hover:shadow-amber-500/20 active:translate-y-0.5 whitespace-nowrap"
              >
                <FileText className="w-4 h-4 text-white" />
                <span>Start Agreement</span>
              </Link>
            )}
          </div>

          {/* Mobile menu trigger */}
          <div className="flex xl:hidden items-center gap-2">
            <Link
              href="/order"
              className="bg-amber-600 text-white font-bold px-3 py-2 rounded-lg text-xs whitespace-nowrap"
            >
              Start
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-white hover:text-white hover:bg-white/15 focus:outline-none cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="xl:hidden bg-stone-50 border-t border-stone-200 px-4 pt-3 pb-6 space-y-2">
          {user ? (
            <div className="p-3 mb-2 bg-stone-100 rounded-lg text-xs text-stone-800 flex items-center justify-between gap-3">
              <span className="truncate">{user.displayName || user.email}</span>
              <button onClick={() => signOut()} className="text-blue-700 font-semibold cursor-pointer">
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                signInWithGoogle().catch(() => {});
              }}
              className="w-full mb-2 p-3 bg-white border border-stone-200 rounded-xl text-xs text-stone-800 flex items-center justify-center gap-2 cursor-pointer font-medium hover:bg-stone-100"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100">
                <User className="h-4 w-4 fill-current text-brand-800" />
              </span>
              <span>Sign In with Google</span>
            </button>
          )}

          {user && (
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/my-orders"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-100"
              >
                My Orders
              </Link>
              <Link
                href="/referrals"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-100"
              >
                Referral Credits
              </Link>
            </div>
          )}

          <nav className="flex flex-col space-y-1">
            {[...primaryNavLinks, ...exploreLinks].map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`text-left px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-brand-100 text-brand-800 font-bold'
                      : 'text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="pt-3 border-t border-stone-200 flex flex-col gap-2">
            <Link
              href="/order"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl text-center text-sm flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span>Start Your Agreement</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
