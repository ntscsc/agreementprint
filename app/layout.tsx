import { siteOrigin, socialImage } from '@/lib/seo';
import type { Metadata } from 'next';
import './globals.css';
import { I18nProvider } from '@/lib/i18n/context';
import { AuthProvider } from '@/lib/auth-context';
import { SiteShell } from '@/components/SiteShell';
import { VisitorTracker } from '@/components/VisitorTracker';

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: 'Online Rental Agreements in Tamil Nadu | AgreementPrint',
  description: 'Create your rental agreement online on Tamil Nadu non-judicial stamp paper, with clear fees and doorstep courier delivery.',
  openGraph: {
    images: [socialImage],
    title: 'Online Rental Agreements in Tamil Nadu | AgreementPrint',
    description: 'Create your rental agreement online on Tamil Nadu non-judicial stamp paper, with clear fees and doorstep courier delivery.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    images: [socialImage],
    title: 'Online Rental Agreements in Tamil Nadu | AgreementPrint',
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
          <VisitorTracker />
          <I18nProvider>
            <SiteShell>{children}</SiteShell>
          </I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
