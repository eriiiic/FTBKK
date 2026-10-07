import { env } from 'cloudflare:workers';

/**
 * The public address of the site (SITE_URL), used for every absolute link: canonical URLs,
 * social images, the sitemap, structured data and emails. Change SITE_URL at the domain cutover.
 */
export const siteOrigin = () => new URL(env.SITE_URL || 'https://www.french-tech-bangkok.com');

export function siteUrl(path: string) {
  return new URL(path, siteOrigin()).href;
}

/** Shown in search results for pages that have no description of their own. */
export const DEFAULT_DESCRIPTION =
  'La French Tech Bangkok is the volunteer-run community of French and Thai tech entrepreneurs in Thailand: events, an open ecosystem directory, news and free membership.';
