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

export interface Byline {
  authorName: string | null;
  authorRole: string | null;
  body: string;
}

const stripFormatting = (s: string) => s.replace(/[*_]+/g, '').trim();

/**
 * Wix posts open with a typed byline:
 *   Bangkok, Thailand / By [Name](linkedin) and [Name](linkedin) / Co-president / La French Tech Bangkok
 * Moves it out of the body so the page can render it as a proper header.
 */
export function extractByline(md: string): Byline {
  const blocks = md.split(/\n\s*\n/);
  let i = 0;
  if (/^\s*Bangkok,\s*Thailand\s*$/i.test(blocks[i] ?? '')) i++;
  const byLine = blocks[i] ?? '';
  if (!/^\s*[*_]*By[*_]*\s+/i.test(byLine)) return { authorName: null, authorRole: null, body: md };
  const names = [...byLine.matchAll(/\[([^\]]+)\]\([^)]*\)/g)].map((m) => stripFormatting(m[1]));
  const authorName =
    names.length > 0
      ? names.join(' and ')
      : stripFormatting(byLine.replace(/^\s*[*_]*By[*_]*\s+/i, '')) || null;
  i++;
  let authorRole: string | null = null;
  const role = stripFormatting(blocks[i] ?? '');
  if (role && role.length <= 60 && !/[.!?:]$/.test(role) && !role.startsWith('#')) {
    authorRole = role;
    i++;
  }
  if (/^\s*La French Tech Bangkok\s*$/i.test(blocks[i] ?? '')) i++;
  return { authorName, authorRole, body: blocks.slice(i).join('\n\n').trim() };
}

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

/**
 * The capture read the blog's category menu instead of each post's own categories, so every
 * post came back with all five. Until a fresh capture reads them, sort posts by their title.
 */
export function postCategories(title: string, captured: string[]): string[] {
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
