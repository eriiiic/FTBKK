// Markdown messages in emails (Email the community): the text is rendered like the site's
// Markdown (same sanitiser), then every tag gets inline styles, since email clients ignore
// stylesheets. Lines such as {{event: slug}} or {{post: slug}} become a card for that event or
// blog post, built with tables so it holds up in Gmail, Outlook and Apple Mail.
import { renderMarkdown } from './markdown';

export interface EmailCard {
  kind: 'event' | 'post';
  title: string;
  /** Absolute link to the page. */
  url: string;
  /** Absolute image URL, or null. */
  image: string | null;
  /** Date line (event: day and time, post: publication date). */
  meta: string;
  /** Venue for an event. */
  place?: string | null;
  summary?: string | null;
}

/** One card token, alone on its line: {{event: slug}} or {{post: slug}}. */
export const CARD_TOKEN = /^[ \t]*\{\{\s*(event|post)\s*:\s*([a-z0-9][a-z0-9-]*)\s*\}\}[ \t]*$/gim;

export const cardKey = (kind: string, slug: string) => `${kind.toLowerCase()}:${slug}`;

/** The cards a message asks for, in order and without repeats. */
export function cardRefs(md: string) {
  const seen = new Set<string>();
  const out: { kind: 'event' | 'post'; slug: string }[] = [];
  for (const m of (md ?? '').matchAll(CARD_TOKEN)) {
    const kind = m[1]!.toLowerCase() as 'event' | 'post';
    const key = cardKey(kind, m[2]!);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ kind, slug: m[2]! });
  }
  return out;
}

const NAVY = '#160b47';
const INK = '#1a1530';
const MUTED = '#5c5a73';
const LINK = '#0062ff';
const LINE = '#e0dfe8';

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

const STYLES: Record<string, string> = {
  p: 'margin:0 0 12px',
  h1: `margin:24px 0 12px;font-size:24px;line-height:1.3;color:${NAVY}`,
  h2: `margin:24px 0 12px;font-size:20px;line-height:1.3;color:${NAVY}`,
  h3: `margin:20px 0 8px;font-size:17px;line-height:1.3;color:${NAVY}`,
  h4: `margin:16px 0 8px;font-size:16px;color:${NAVY}`,
  ul: 'margin:0 0 12px;padding-left:24px',
  ol: 'margin:0 0 12px;padding-left:24px',
  li: 'margin:0 0 4px',
  blockquote: `margin:0 0 12px;padding:4px 0 4px 16px;border-left:3px solid ${LINE};color:${MUTED}`,
  hr: `border:0;border-top:1px solid ${LINE};margin:20px 0`,
  a: `color:${LINK}`,
  img: 'max-width:100%;height:auto;border:0;border-radius:8px;display:block;margin:0 0 12px',
  table: 'border-collapse:collapse;margin:0 0 12px',
  th: `border:1px solid ${LINE};padding:6px 8px;text-align:left`,
  td: `border:1px solid ${LINE};padding:6px 8px`,
  code: 'font-family:Menlo,Consolas,monospace;font-size:14px;background:#f5f5f5;padding:1px 4px',
  pre: 'margin:0 0 12px;padding:12px;background:#f5f5f5;overflow:auto',
};

/** Absolute links and image sources (uploaded images are /media/…), plus inline styles. */
function styleHtml(html: string, origin: string) {
  return html
    .replace(/\b(href|src)="\/(?!\/)/g, `$1="${origin}/`)
    .replace(/<(\w+)(\s[^>]*)?>/g, (all, tag: string, attrs = '') => {
      const style = STYLES[tag.toLowerCase()];
      if (!style) return all;
      const self = attrs.endsWith('/') ? ' /' : '';
      const rest = self ? attrs.slice(0, -1).trimEnd() : attrs;
      return `<${tag}${rest} style="${style}"${self}>`;
    });
}

/** Plain-text version of a Markdown chunk: links as "text (url)", images as their URL. */
function markdownText(md: string, origin: string) {
  const abs = (u: string) => (u.startsWith('/') && !u.startsWith('//') ? `${origin}${u}` : u);
  return md
    .replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (_a, alt: string, u: string) =>
      alt ? `${alt}: ${abs(u)}` : abs(u),
    )
    .replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (_a, t: string, u: string) =>
      t === u ? abs(u) : `${t} (${abs(u)})`,
    )
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[^*\w])[*_]([^*_\n]+)[*_](?=[^*\w]|$)/g, '$1$2')
    .replace(/^\s*[-*+]\s+/gm, '- ')
    .replace(/^>\s?/gm, '')
    .replace(/`([^`]+)`/g, '$1');
}

/** The card for an event or post: image on top, then the label, title, date, summary and link. */
export function cardHtml(c: EmailCard) {
  const label = c.kind === 'event' ? 'Event' : 'Blog';
  const cta = c.kind === 'event' ? 'See the event and register' : 'Read the article';
  const summary = c.summary ? clip(c.summary, 220) : '';
  const meta = [c.meta, c.place].filter(Boolean).join(' · ');
  const image = c.image
    ? `<tr><td style="padding:0"><a href="${esc(c.url)}"><img src="${esc(c.image)}" alt="" width="502" style="display:block;width:100%;max-width:502px;height:auto;border:0"></a></td></tr>`
    : '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px;border:1px solid ${LINE};border-radius:12px;border-collapse:separate;overflow:hidden">
${image}<tr><td style="padding:16px 20px">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#d6223d;font-weight:700">${label}</p>
<p style="margin:0 0 6px;font-size:18px;line-height:1.35;font-weight:700"><a href="${esc(c.url)}" style="color:${NAVY};text-decoration:none">${esc(c.title)}</a></p>
${meta ? `<p style="margin:0 0 8px;font-size:14px;color:${MUTED}">${esc(meta)}</p>` : ''}${summary ? `<p style="margin:0 0 10px;font-size:15px;line-height:1.5;color:${INK}">${esc(summary)}</p>` : ''}
<p style="margin:0;font-size:15px;font-weight:600"><a href="${esc(c.url)}" style="color:${LINK}">${cta} &rarr;</a></p>
</td></tr></table>`;
}

function cardText(c: EmailCard) {
  return [
    `${c.kind === 'event' ? 'EVENT' : 'BLOG'}: ${c.title}`,
    [c.meta, c.place].filter(Boolean).join(' · '),
    c.summary ? clip(c.summary, 220) : '',
    c.url,
  ]
    .filter(Boolean)
    .join('\n');
}

const clip = (s: string, max: number) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

/**
 * Renders an email's Markdown: HTML with inline styles and cards, and plain-text paragraphs for
 * the text version. `cards` maps cardKey(kind, slug) to the card; tokens naming nothing are
 * left out (and listed in `missing`). Single line breaks are kept, as in the old plain-text box.
 */
export function emailMarkdown(md: string, cards: Map<string, EmailCard>, origin: string) {
  const html: string[] = [];
  const text: string[] = [];
  const missing: string[] = [];
  const chunk = (part: string) => {
    if (!part.trim()) return;
    html.push(styleHtml(renderMarkdown(part, { breaks: true }), origin));
    for (const p of markdownText(part, origin)
      .replace(/\r\n?/g, '\n')
      .split(/\n\s*\n/)) {
      const t = p.trim();
      if (t) text.push(t);
    }
  };
  let last = 0;
  const src = (md ?? '').replace(/\r\n?/g, '\n');
  for (const m of src.matchAll(CARD_TOKEN)) {
    chunk(src.slice(last, m.index));
    last = m.index! + m[0].length;
    const key = cardKey(m[1]!, m[2]!);
    const card = cards.get(key);
    if (!card) {
      if (!missing.includes(key)) missing.push(key);
      continue;
    }
    html.push(cardHtml(card));
    text.push(cardText(card));
  }
  chunk(src.slice(last));
  return { html: html.join('\n'), paragraphs: text, missing };
}
