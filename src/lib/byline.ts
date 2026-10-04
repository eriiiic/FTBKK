// Posts imported from Wix open with a hand-typed byline; the article header shows the author.

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
