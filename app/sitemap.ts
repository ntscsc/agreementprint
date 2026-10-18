import type { MetadataRoute } from 'next';
import { canonicalUrl, publicPagePaths } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPagePaths.map((path) => ({ url: canonicalUrl(path) }));
}
