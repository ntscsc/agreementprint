'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Search, 
  ChevronDown, 
  ChevronUp, 
  HelpCircle 
} from 'lucide-react';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { DisclaimerBanner } from '@/components/DisclaimerBanner';
import { faqData } from './faq-data';
import type { FaqCategory } from './faq-data';

export function FaqClient() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | FaqCategory>('all');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const filteredFaqs = faqData.filter((item) => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch =
      item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.a.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-14 py-8 pb-16">
      {/* Header Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-stone-900 text-white rounded-3xl p-8 sm:p-12 border border-stone-800 shadow-sm relative overflow-hidden">
          <div className="max-w-3xl space-y-4">
            <span className="text-xs uppercase tracking-wider font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
              Clear Answers
            </span>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              Frequently Asked Questions (FAQ)
            </h1>

            <p className="text-stone-300 text-base sm:text-lg leading-relaxed">
              Answers about ordering, stamp-paper options, payments, privacy, delivery, and refunds.
            </p>
          </div>
        </div>
      </section>

      {/* Search and Category Filters */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="relative">
          <Search className="w-5 h-5 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search questions (e.g. duration, Aadhaar, payment, refund, tracking)..."
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-stone-200 rounded-2xl text-sm text-stone-800 placeholder-stone-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3.5 py-1.5 rounded-full transition-colors ${
              activeCategory === 'all'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
            }`}
          >
            All Questions ({faqData.length})
          </button>
          <button
            onClick={() => setActiveCategory('legality')}
            className={`px-3.5 py-1.5 rounded-full transition-colors ${
              activeCategory === 'legality'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
            }`}
          >
            Legality & Tenancy
          </button>
          <button
            onClick={() => setActiveCategory('privacy')}
            className={`px-3.5 py-1.5 rounded-full transition-colors ${
              activeCategory === 'privacy'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
            }`}
          >
            Aadhaar & Privacy
          </button>
          <button
            onClick={() => setActiveCategory('pricing')}
            className={`px-3.5 py-1.5 rounded-full transition-colors ${
              activeCategory === 'pricing'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
            }`}
          >
            Pricing & Refunds
          </button>
          <button
            onClick={() => setActiveCategory('payment')}
            className={`px-3.5 py-1.5 rounded-full transition-colors ${
              activeCategory === 'payment'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
            }`}
          >
            Payments
          </button>
          <button
            onClick={() => setActiveCategory('delivery')}
            className={`px-3.5 py-1.5 rounded-full transition-colors ${
              activeCategory === 'delivery'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
            }`}
          >
            Courier & Tracking
          </button>
        </div>

        {/* Accordions */}
        <div className="space-y-3 pt-2">
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-stone-200 p-8 space-y-2">
              <p className="text-sm font-semibold text-stone-700">No questions matched your search query.</p>
              <div className="pt-2">
                <WhatsAppButton variant="outline" />
              </div>
            </div>
          ) : (
            filteredFaqs.map((faq, idx) => {
              const isOpen = openIndex === idx;
              return (
                <div
                  key={idx}
                  className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm transition-shadow hover:shadow-md"
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : idx)}
                    className="w-full p-5 text-left flex items-start justify-between gap-4 focus:outline-none"
                  >
                    <span className="font-bold text-stone-900 text-sm sm:text-base leading-snug">
                      {faq.q}
                    </span>
                    <span className="p-1 rounded-lg bg-stone-100 text-stone-600 shrink-0 mt-0.5">
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-stone-600 leading-relaxed border-t border-stone-100">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Action card */}
        <div className="bg-stone-100 rounded-2xl p-6 border border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-4 mt-8">
          <div>
            <h4 className="font-bold text-stone-900 text-sm">Still have questions?</h4>
            <p className="text-xs text-stone-600 mt-0.5">Contact our support team if you need help with an order.</p>
          </div>
          <div className="flex items-center gap-3">
            <WhatsAppButton variant="primary" />
            <Link
              href="/contact"
              className="bg-stone-900 hover:bg-stone-800 text-white font-semibold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>

      {/* Statutory Disclaimer */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <DisclaimerBanner />
      </section>
    </div>
  );
}
