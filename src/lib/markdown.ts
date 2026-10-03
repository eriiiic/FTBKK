import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

/** Render admin- or owner-written Markdown to safe HTML. */
export function renderMarkdown(md: string): string {
  const html = marked.parse(md ?? '', { async: false, gfm: true, breaks: false });
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'del']),
    allowedAttributes: {
      a: ['href', 'title', 'rel', 'target'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      th: ['align'],
      td: ['align'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: {
      img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: 'lazy' } }),
      a: (tagName, attribs) => ({
        tagName,
        attribs: /^https?:/.test(attribs.href ?? '') ? { ...attribs, rel: 'noopener' } : attribs,
      }),
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
