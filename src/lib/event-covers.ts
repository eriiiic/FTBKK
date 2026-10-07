import { mediaUrl } from './format';

// Event types and their default covers. The type is stored in events.series: "French Tech
// Connect", "French Tech Talk", or any other series name (Workshop, AI Agent...).

export const CONNECT = 'French Tech Connect';
export const TALK = 'French Tech Talk';

/** Built-in covers, used until Settings > Default event images has its own. */
export const DEFAULT_EVENT_COVERS = {
  connect: '/brand/events/connect.jpg',
  talk: '/brand/events/talk.jpg',
} as const;

export type EventKind = 'connect' | 'talk' | 'other';
export type EventCovers = { connect: string | null; talk: string | null };

export function eventKind(series: string | null | undefined): EventKind {
  const s = (series ?? '').toLowerCase();
  if (/\bconnect\b/.test(s)) return 'connect';
  if (/\btalks?\b/.test(s)) return 'talk';
  return 'other';
}

/** The series stored for a type picked in the admin; "other" keeps the typed series name. */
export function seriesFor(kind: string, name: string | undefined) {
  if (kind === 'connect') return CONNECT;
  if (kind === 'talk') return TALK;
  return name?.trim() || 'Other';
}

/**
 * An event's cover: its own image, else the default for Connect or Talk (Settings, else the
 * built-in one), else null.
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
