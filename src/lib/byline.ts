// Posts imported from Wix open with a hand-typed byline; the article header shows the author.

import type { PostAuthor } from '../db/schema';

export interface Byline {
  authorName: string | null;
  authorRole: string | null;
  /** Each named author, with the link the byline gives them and the shared role. */
  authors: PostAuthor[];
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
  if (!/^\s*[*_]*By[*_]*\s+/i.test(byLine))
    return { authorName: null, authorRole: null, authors: [], body: md };
  const linked = [...byLine.matchAll(/\[([^\]]+)\]\(([^)\s]*)[^)]*\)/g)].map((m) => ({
    name: stripFormatting(m[1]!),
    url: /^https?:/.test(m[2]!) ? m[2] : undefined,
  }));
  const plain = stripFormatting(byLine.replace(/^\s*[*_]*By[*_]*\s+/i, ''));
  const found: PostAuthor[] = linked.length
    ? linked
    : plain
        .split(/\s+(?:and|&|et)\s+|,\s*/i)
        .map((name) => ({ name: name.trim() }))
        .filter((a) => a.name);
  const authorName = found.length ? found.map((a) => a.name).join(' and ') : null;
  i++;
  let authorRole: string | null = null;
  const role = stripFormatting(blocks[i] ?? '');
  if (role && role.length <= 60 && !/[.!?:]$/.test(role) && !role.startsWith('#')) {
    authorRole = role;
    i++;
  }
  if (/^\s*La French Tech Bangkok\s*$/i.test(blocks[i] ?? '')) i++;
  const authors = found.map((a) => ({
    name: a.name,
    ...(authorRole ? { role: authorRole } : {}),
    ...(a.url ? { url: a.url } : {}),
  }));
  return { authorName, authorRole, authors, body: blocks.slice(i).join('\n\n').trim() };
}

/** "Jane Doe and John Roe" -> two names. */
export function splitNames(names: string | null | undefined) {
  return (names ?? '')
    .split(/\s+(?:and|&|et)\s+|,\s*/i)
    .map((n) => n.trim())
    .filter(Boolean);
}

/** "Jane", "Jane and John", "Jane, John and Ann". */
export function joinNames(names: string[]) {
  return names.length > 1
    ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
    : (names[0] ?? '');
}

/**
 * The authors a post shows and its text without any typed byline: the author list from the
 * editor, else the byline typed at the top of the text, else the single author fields.
 */
export function resolveAuthors(post: {
  bodyMd: string;
  authors?: PostAuthor[] | null;
  authorName: string | null;
  authorRole: string | null;
}) {
  const byline = extractByline(post.bodyMd);
  const authors: PostAuthor[] = post.authors?.length
    ? post.authors
    : byline.authors.length
      ? byline.authors
      : splitNames(post.authorName).map((name) => ({
          name,
          ...(post.authorRole ? { role: post.authorRole } : {}),
        }));
  return { authors, body: byline.body };
}

/** The single author columns cards and feeds read, kept in step with the author list. */
export function authorColumns(authors: PostAuthor[]) {
  const roles = [...new Set(authors.map((a) => a.role ?? ''))];
  return {
    authorName: joinNames(authors.map((a) => a.name)) || null,
    authorRole: (roles.length === 1 && roles[0]) || null,
  };
}

/**
 * For a post whose author is still typed at the top of its text: the author list from that
 * byline and the text without it. Null when there is nothing to move.
 */
export function moveByline(post: { bodyMd: string }) {
  const byline = extractByline(post.bodyMd);
  if (!byline.authors.length) return null;
  return { bodyMd: byline.body, authors: byline.authors, ...authorColumns(byline.authors) };
}
