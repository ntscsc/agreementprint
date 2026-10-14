import type { Metadata } from 'next';
import './globals.css';
import { I18nProvider } from '@/lib/i18n/context';
import { AuthProvider } from '@/lib/auth-context';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { DisclaimerBanner } from '@/components/DisclaimerBanner';
import { WhatsAppButton } from '@/components/WhatsAppButton';

export const metadata: Metadata = {
  title: 'StampSure | Rental Agreements on Tamil Nadu Stamp Paper',
  description: 'Create your rental agreement online on Tamil Nadu non-judicial stamp paper, with clear fees and doorstep courier delivery.',
  openGraph: {
    title: 'StampSure | Rental Agreements on Tamil Nadu Stamp Paper',
    description: 'Create your rental agreement online on Tamil Nadu non-judicial stamp paper, with clear fees and doorstep courier delivery.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StampSure | Rental Agreements on Tamil Nadu Stamp Paper',
    description: 'Create your rental agreement online on Tamil Nadu non-judicial stamp paper, with clear fees and doorstep courier delivery.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-stone-50 text-stone-900 font-sans selection:bg-amber-100 selection:text-amber-900 antialiased" suppressHydrationWarning>
        <AuthProvider>
          <I18nProvider>
            <DisclaimerBanner compact={true} />
            <Header />
            <main className="flex-1">
              {children}
            </main>
            <WhatsAppButton variant="floating" />
            <Footer />
          </I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
