/**
 * Clean-up for Markdown captured from Wix pages (event descriptions and blog posts): Wix leaves
 * whitespace-only paragraphs, a "Show More" button label, hashtag search links, absolute links to
 * the old site and a hand-typed byline at the top of every post.
 */
import { redirectFor } from '../../src/lib/redirects';

const OLD_SITE = /https?:\/\/(?:www\.)?french-tech-bangkok\.com(\/[^\s)"']*)?/g;

/** Wix Markdown -> tidy Markdown. Safe to run more than once. */
export function cleanWixMarkdown(md: string): string {
  let s = md.replace(/\r\n/g, '\n');
  // Paragraphs made only of spaces / non-breaking spaces become blank lines.
  s = s.replace(/^[ \t\u00a0]+$/gm, '');
  // Trailing hard breaks ("text  ") at the end of a paragraph are noise.
  s = s.replace(/[ \t\u00a0]+(?=\n\n|\n?$)/g, '');
  // The collapsed-description button label.
  s = s.replace(/\n*\s*Show (?:More|Less)\s*$/i, '');
  // Wix repeats the page section title at the top of event descriptions.
  s = s.replace(/^\s*#{1,6}\s*About the event\s*\n/i, '');
  // Lines made only of hashtag search links go; inline ones become plain text.
  s = s.replace(/^(?:\s*\[#[^\]]+\]\(\/search\/[^)]*\))+\s*$/gm, '');
  s = s.replace(/\[(#[^\]]+)\]\(\/search\/[^)]*\)/g, '$1');
  // Links to the old Wix site point at the matching page of this site.
  s = s.replace(OLD_SITE, (_all, p: string | undefined) => {
    const pathname = (p ?? '/').split(/[?#]/)[0] || '/';
    return redirectFor(pathname) ?? pathname;
  });
  // Wix authors style intro paragraphs as h4-h6: long "headings" are paragraphs.
  s = s.replace(/^#{4,6}\s+(.{120,})$/gm, '$1');
  // Wix exports every list as a loose list (blank line between items): make them tight.
  s = s.replace(/^(\s*(?:[-*]|\d+\.)\s+.+)\n\n+(?=\s*(?:[-*]|\d+\.)\s+)/gm, '$1\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

export { extractByline, type Byline } from '../../src/lib/byline';

export interface CapturedAttachment {
  name: string;
  key: string;
}

/**
 * Wix file widgets come through as "file.pdf" followed by "Download PDF • 403KB". With the file
 * captured, they become a Markdown link to it (styled as a download button by the page); without
 * it, only the size line goes.
 */
export function inlineAttachments(
  md: string,
  files: CapturedAttachment[],
  mediaPrefix = '/media/',
) {
  return md.replace(
    /^([^\n]*?\.(?:pdf|docx?|xlsx?|pptx?|zip))[ \t]*\n+\s*Download (?:PDF|File)?[ \t]*•[ \t]*([\d.,]+[ \t]*[KMG]?B)[ \t]*$/gim,
    (_all, rawName: string, size: string) => {
      const name = rawName
        .replace(/\\_/g, '_')
        .replace(/[*_]{2,}/g, '')
        .trim();
      const file = files.find((f) => f.name.replace(/\\_/g, '_') === name);
      if (!file) return name;
      return `[${name} (${size.replace(/\s+/g, ' ')})](${mediaPrefix}${file.key})`;
    },
  );
}

/** Drops the first body image when it is the same picture as the post cover. */
export function dropLeadingCoverImage(md: string, coverKey: string | null) {
  if (!coverKey) return md;
  const m = md.match(/^\s*!\[[^\]]*\]\(([^)]+)\)\s*(?:\n|$)/);
  if (m && m[1].endsWith(coverKey)) return md.slice(m[0].length).trim();
  return md;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** Decodes the HTML entities Wix leaves in plain-text fields ("Speaker &amp; topic"). */
export function decodeEntities(s: string) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (all, code: string) => {
    if (code[0] === '#') {
      const n =
        code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : all;
    }
    return ENTITIES[code.toLowerCase()] ?? all;
  });
}

const BLOG_MENU = [
  'Ecosystem News',
  'Founder Guides',
  'Tech Insights',
  'Events & Community',
  'Studies & ressources',
];

/** Each post's categories as set in the Wix dashboard (read from screenshots on 2026-10-04). */
const WIX_POST_CATEGORIES: Record<string, string[]> = {
  'french-tech-2026-an-ecosystem-ready-to-compete-on-the-global-stage': [
    'Ecosystem News',
    'Tech Insights',
    'Studies & ressources',
  ],
  'thailand-tech-pulse-q3-2026-thailand-s-tech-economy-enters-a-new-phase': [
    'Ecosystem News',
    'Tech Insights',
    'Studies & ressources',
  ],
  'la-french-tech-bangkok-releases-thailand-tech-pulse-q2-2026-edition': [
    'Ecosystem News',
    'Tech Insights',
    'Studies & ressources',
  ],
  'la-french-tech-bangkok-launches-its-first-thailand-tech-pulse-for-q1-2026': [
    'Ecosystem News',
    'Tech Insights',
    'Studies & ressources',
  ],
  'how-to-start-a-business-in-thailand-a-practical-guide-for-foreign-founders-part-1-4': [
    'Founder Guides',
  ],
  'how-to-start-a-business-in-thailand-a-practical-guide-for-foreign-founders-part-2-4': [
    'Founder Guides',
  ],
  'we-ran-ai-100-offline-on-our-laptops-learnings': ['Tech Insights'],
  'ai-is-changing-cybersecurity-faster-than-most-companies-realize': ['Tech Insights'],
  'why-bangkok-is-attracting-more-and-more-french-startups': ['Ecosystem News'],
  'la-french-tech-bangkok-officially-relabelled-for-2026-2028': ['Ecosystem News'],
  'la-french-tech-bangkok-is-looking-for-its-next-board-members': ['Events & Community'],
  'la-french-tech-bangkok-x-common-ground-thailand-a-new-home-for-french-tech-talks-2026': [
    'Events & Community',
  ],
};

/**
 * The capture read the blog's category menu instead of each post's own categories, so every
 * post came back with all five. Use the categories set in Wix, else guess from the title.
 */
export function postCategories(title: string, captured: string[], slug?: string): string[] {
  if (slug && WIX_POST_CATEGORIES[slug]) return WIX_POST_CATEGORIES[slug];
  if (!BLOG_MENU.every((c) => captured.includes(c))) return captured;
  const t = title.toLowerCase();
  const out = new Set<string>();
  if (/tech pulse|panorama|ecosystem ready|report|study/.test(t)) {
    out.add('Studies & ressources').add('Ecosystem News');
  }
  if (/guide|start a business|founder/.test(t)) out.add('Founder Guides');
  if (/\bai\b|cyber|offline|llm|tech insight/.test(t)) out.add('Tech Insights');
  if (/talk|connect|event|common ground|board/.test(t)) out.add('Events & Community');
  if (/relabel|why bangkok|board|common ground/.test(t)) out.add('Ecosystem News');
  return out.size ? [...out] : ['Ecosystem News'];
}
