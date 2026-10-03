const fmt = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
const escText = (s: string) =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/[,;]/g, (c) => `\\${c}`);
/** Fold lines at 75 octets as RFC 5545 requires. */
const fold = (line: string) => line.replace(/(.{74})/g, '$1\r\n ').replace(/\r\n $/, '');

export function eventIcs(e: {
  slug: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  venue: string | null;
  address: string | null;
  summary: string | null;
  url: string;
  cancelled?: boolean;
}) {
  const end = e.endsAt ?? new Date(e.startsAt.getTime() + 2 * 3600 * 1000);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//La French Tech Bangkok//Events//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${e.cancelled ? 'CANCEL' : 'PUBLISH'}`,
    'BEGIN:VEVENT',
    `UID:${e.slug}@french-tech-bangkok.com`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(e.startsAt)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${escText(e.title)}`,
    `LOCATION:${escText([e.venue, e.address].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${escText(`${e.summary ?? ''}\n${e.url}`.trim())}`,
    `URL:${e.url}`,
    `STATUS:${e.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
