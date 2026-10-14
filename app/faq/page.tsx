import type { Metadata } from 'next';
import { FaqClient } from './FaqClient';
import { faqData } from './faq-data';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions | Rental Agreements & Stamp Duty Tamil Nadu',
  description: 'Answers about rental agreement duration, stamp paper options, pricing, online payments, privacy, delivery, and refunds.',
  openGraph: {
    title: 'Frequently Asked Questions | Rental Agreements & Stamp Duty Tamil Nadu',
    description: 'Answers about rental agreement duration, stamp paper options, pricing, online payments, privacy, delivery, and refunds.',
  },
};

export default function FaqPage() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqData.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: a,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <FaqClient />
    </>
  );
}
