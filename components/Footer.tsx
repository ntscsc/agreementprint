'use client';

import React from 'react';
import Link from 'next/link';
import { BrandMark } from '@/components/BrandMark';
import { 
  Mail, 
  Truck
} from 'lucide-react';
import { SupportEmailLink } from '@/components/SupportEmailLink';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-stone-100 text-stone-700 border-t border-stone-200 text-sm">
      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Col 1: Brand & Service Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BrandMark className="h-9 w-9 shrink-0" />
              <h4 className="font-extrabold text-[#b84d12] text-base sm:text-lg">StampSure</h4>
            </div>

            <p className="text-xs text-stone-400 leading-relaxed">
              Online rental agreement drafting on non-judicial stamp paper with doorstep delivery and courier tracking across Tamil Nadu.
            </p>

            <div className="space-y-2 pt-2 text-xs text-stone-400">
              <div className="flex items-center gap-2.5">
                <Truck className="w-4 h-4 text-brand-600 shrink-0" />
                <span>Courier dispatch with tracking</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-brand-600 shrink-0" />
                <SupportEmailLink className="hover:text-brand-600 transition-colors" />
              </div>
            </div>
          </div>

          {/* Col 2: Services */}
          <div className="space-y-3">
            <h5 className="font-bold text-brand-800 text-xs uppercase tracking-wider">Services</h5>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/order" className="text-stone-700 hover:text-stone-900 transition-colors">
                  11-Month Rental Agreement
                </Link>
              </li>
              <li>
                <Link href="/rent-receipt" className="text-stone-700 hover:text-stone-900 transition-colors">
                  Generate Rent Receipt
                </Link>
              </li>
              <li>
                <Link href="/referrals" className="text-stone-700 hover:text-stone-900 transition-colors">
                  Referral Credits
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-stone-700 hover:text-stone-900 transition-colors">
                  Pricing & Stamp Duty
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="text-stone-700 hover:text-stone-900 transition-colors">
                  How Stamping Works
                </Link>
              </li>
              <li>
                <Link href="/track" className="text-stone-700 hover:text-stone-900 transition-colors">
                  Track Courier Dispatch
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Support */}
          <div className="space-y-3">
            <h5 className="font-bold text-brand-800 text-xs uppercase tracking-wider">Support</h5>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/faq" className="text-stone-700 hover:text-stone-900 transition-colors">
                  Frequently Asked Questions
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-stone-700 hover:text-stone-900 transition-colors">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Legal & Policies */}
          <div className="space-y-3">
            <h5 className="font-bold text-brand-800 text-xs uppercase tracking-wider">Policies & Terms</h5>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/privacy-policy" className="text-stone-700 hover:text-stone-900 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-stone-700 hover:text-stone-900 transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/refund-policy" className="text-stone-700 hover:text-stone-900 transition-colors">
                  Refund & Cancellation Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 pt-6 border-t border-stone-300 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-600 gap-4">
          <p>© {new Date().getFullYear()} StampSure. All rights reserved.</p>
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <p>
                            <a href="mailto:pradhiip1992official@gmail.com" className="hover:text-brand-600 transition-colors">
                Contact Developer [pradhiip1992official@gmail.com]
              </a>
            </p>
            {/* <span>Tamil Nadu, India</span> */}
          </div>
        </div>
      </div>
    </footer>
  );
};
