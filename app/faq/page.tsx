import { canonicalUrl, socialImage } from '@/lib/seo';
import type { Metadata } from 'next';
import { FaqClient } from './FaqClient';
import { faqData } from './faq-data';

export const metadata: Metadata = {
  alternates: { canonical: canonicalUrl('/faq') },
  title: 'FAQs | AgreementPrint',
  description: 'Simple answers about stamp paper, rental and custom agreements, notary signatures, delivery, payments, referral rewards and free rent receipts.',
  openGraph: {
    images: [socialImage],
    title: 'FAQs | AgreementPrint',
    description: 'Simple answers about stamp paper, rental and custom agreements, notary signatures, delivery, payments, referral rewards and free rent receipts.',
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
