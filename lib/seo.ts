// Keep canonical links and sitemap URLs on the same production origin.
export const siteOrigin = new URL(process.env.APP_URL || 'https://agreementprint.in').origin;

export const publicPagePaths = [
  '/',
  '/about',
  '/services',
  '/rental-agreement-chennai',
  '/contact',
  '/how-it-works',
  '/faq',
  '/pricing',
  '/rent-receipt',
  '/reviews',
  '/terms',
  '/disclaimer',
  '/shipping-policy',
  '/return-policy',
  '/privacy-policy',
  '/refund-policy',
] as const;

export function canonicalUrl(path: string): string {
  return new URL(path, `${siteOrigin}/`).href;
}

export const socialImage = {
  url: '/images/social-share.png',
  width: 1200,
  height: 630,
  alt: 'AgreementPrint. Online rental agreements in Tamil Nadu. Prepared, printed on stamp paper and delivered.',
};
