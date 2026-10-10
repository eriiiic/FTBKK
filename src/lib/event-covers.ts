import { mediaUrl } from './format';

// Event types and their default covers. The type is stored in events.series: "French Tech
// Connect", "French Tech Talk", "French Tech Select", or any other series name (Workshop...).

export const CONNECT = 'French Tech Connect';
export const TALK = 'French Tech Talk';
export const SELECT = 'French Tech Select';

/** The types with a default cover, in the order the admin shows them. */
export const COVER_KINDS = ['connect', 'talk', 'select'] as const;
export type CoverKind = (typeof COVER_KINDS)[number];
export const KIND_NAMES: Record<CoverKind, string> = {
  connect: CONNECT,
  talk: TALK,
  select: SELECT,
};

/** Built-in covers, used until Settings > Default event covers has its own. Select has none. */
export const DEFAULT_EVENT_COVERS: Record<CoverKind, string | null> = {
  connect: '/brand/events/connect.jpg',
  talk: '/brand/events/talk.jpg',
  select: null,
};

export type EventKind = CoverKind | 'other';
export type EventCovers = Record<CoverKind, string | null>;

export function eventKind(series: string | null | undefined): EventKind {
  const s = (series ?? '').toLowerCase();
  if (/\bconnect\b/.test(s)) return 'connect';
  if (/\btalks?\b/.test(s)) return 'talk';
  if (/\bselect\b/.test(s)) return 'select';
  return 'other';
}

/** The series stored for a type picked in the admin; "other" keeps the typed series name. */
export function seriesFor(kind: string, name: string | undefined) {
  if (kind === 'connect') return CONNECT;
  if (kind === 'talk') return TALK;
  if (kind === 'select') return SELECT;
  return name?.trim() || 'Other';
}

/**
 * An event's cover: its own image, else the default for Connect, Talk or Select (Settings, else
 * the built-in one), else null.
 */
export function eventCover(
  e: { coverKey: string | null; series: string },
  covers: EventCovers | null | undefined,
): string | null {
  if (e.coverKey) return mediaUrl(e.coverKey);
  const kind = eventKind(e.series);
  if (kind === 'other') return null;
  const own = covers?.[kind];
  return own ? mediaUrl(own) : DEFAULT_EVENT_COVERS[kind];
}
