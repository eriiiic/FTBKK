import { plainText } from './markdown';

/** Longest meta description search engines show; longer automatic text is cut there. */
export const SEO_DESCRIPTION_MAX = 160;

const cut = (s: string) =>
  s.length > SEO_DESCRIPTION_MAX ? `${s.slice(0, SEO_DESCRIPTION_MAX - 1).trimEnd()}…` : s;

/** Comma-separated keywords as a clean list (trimmed, no empties, no duplicates). */
export function keywordList(raw: string | null | undefined) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of (raw ?? '').split(',')) {
    const word = k.trim().replace(/\s+/g, ' ');
    if (word && !seen.has(word.toLowerCase())) {
      seen.add(word.toLowerCase());
      out.push(word);
    }
  }
  return out;
}

/**
 * The SEO values a post gets when its SEO fields are left as they are: its title, its summary
 * (or the start of its text) and its category names.
 */
export function autoPostSeo(
  post: { title: string; excerpt: string | null; bodyMd: string },
  categoryNames: string[],
) {
  const excerpt = (post.excerpt ?? '').trim().replace(/\s+/g, ' ');
  const body = post.bodyMd.replace(/\{\{\s*download:[^}]*\}\}/gi, '');
  return {
    title: post.title.trim(),
    description: excerpt ? cut(excerpt) : plainText(body, SEO_DESCRIPTION_MAX),
    keywords: keywordList(categoryNames.join(',')).join(', '),
  };
}

/** A typed SEO value is stored only when it differs from the automatic one (else null). */
export function seoOverride(value: string | null | undefined, auto: string) {
  const v = (value ?? '').trim().replace(/\s+/g, ' ');
  return v && v !== auto ? v : null;
}

/** What the public post page uses: the override when one is saved, else the automatic value. */
export function postSeo(
  post: {
    title: string;
    excerpt: string | null;
    bodyMd: string;
    seoTitle: string | null;
    seoDescription: string | null;
    seoKeywords: string | null;
  },
  categoryNames: string[],
) {
  const auto = autoPostSeo(post, categoryNames);
  return {
    title: post.seoTitle || auto.title,
    description: post.seoDescription || auto.description,
    keywords: keywordList(post.seoKeywords ?? auto.keywords),
  };
}
