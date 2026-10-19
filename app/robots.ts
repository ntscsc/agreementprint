import type { MetadataRoute } from 'next';
import { canonicalUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    // Let crawlers read page-level noindex. Authentication protects private data.
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: canonicalUrl('/sitemap.xml'),
  };
}
