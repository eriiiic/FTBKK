import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { redirectFor } from './redirects';

const OLD_SITE = /^https?:\/\/(?:www\.)?french-tech-bangkok\.com(?=\/|$|[?#])/i;

/**
 * Links to the old Wix site (in imported posts) become relative links to the new pages:
 * /post/x -> /blog/x, /contact-8 -> /about#contact, and so on. Other links are left alone.
 */
export function localLink(href: string) {
  if (!OLD_SITE.test(href) && !/^\/(?!\/)/.test(href)) return href;
  const url = new URL(href.replace(OLD_SITE, ''), 'https://x.invalid');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const to = redirectFor(path);
  if (to) return to.includes('#') ? to : `${to}${url.hash}`;
  return `${path}${url.search}${url.hash}`;
}

/**
 * Render admin- or owner-written Markdown to safe HTML. `breaks` keeps single line breaks, for
 * short texts typed in a settings box where Enter should start a new line.
 */
export function renderMarkdown(md: string, { breaks = false } = {}): string {
  // Wix buttons came over as links whose text sits on its own lines ("[\n\nLet's talk\n\n](…)"),
  // which Markdown does not read as a link: pull the text back inside the brackets.
  const fixed = (md ?? '').replace(
    /\[\s*\n\s*([^\]]*?\S)\s*\](?=\()/g,
    (_all, text: string) => `[${text.replace(/\s*\n\s*/g, ' ')}]`,
  );
  const html = marked.parse(fixed, { async: false, gfm: true, breaks });
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'del']),
    allowedAttributes: {
      a: ['href', 'title', 'rel', 'target'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      th: ['align'],
      td: ['align'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    // Headings left empty in the editor (an Enter after "## ") would show as blank gaps.
    exclusiveFilter: (frame) => /^h[1-6]$/.test(frame.tag) && !frame.text.trim(),
    transformTags: {
      img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: 'lazy' } }),
      a: (tagName, attribs) => {
        if (!attribs.href) return { tagName, attribs };
        const href = localLink(attribs.href);
        return {
          tagName,
          attribs: /^https?:/.test(href)
            ? { ...attribs, href, rel: 'noopener' }
            : { ...attribs, href },
        };
      },
    },
  });
}

/** Plain text for meta descriptions and excerpts. */
export function plainText(md: string, max = 160) {
  const text = (md ?? '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * Download tags in post text: {{download: file.pdf}} or {{download: file.pdf | Read the report}}
 * become a link to that attachment (styled as a download button by the page). The file is matched
 * by its name; a tag naming no attachment is dropped.
 */
export function expandDownloads(
  md: string,
  attachments: { name: string; key: string; size?: number }[],
  mediaUrl: (key: string) => string | null,
) {
  return (md ?? '').replace(
    /\{\{\s*download:\s*([^}|]+?)\s*(?:\|\s*([^}]+?)\s*)?\}\}/gi,
    (_all, name, label) => {
      const want = String(name).toLowerCase();
      const file = attachments.find((a) => a.name.toLowerCase() === want || a.key === name);
      if (!file) return '';
      const size = file.size ? ` (${formatSize(file.size)})` : '';
      const text = String(label || file.name).replace(/[[\]]/g, '');
      return `[${text}${size}](${mediaUrl(file.key)})`;
    },
  );
}

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
