export const TZ = 'Asia/Bangkok';

export function mediaUrl(key: string | null | undefined): string | null {
  return key ? `/media/${key.split('/').map(encodeURIComponent).join('/')}` : null;
}

export function formatDate(d: Date | string | number, opts: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...opts,
  }).format(new Date(d));
}

export function formatTime(d: Date | string | number) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(d));
}

export function formatEventDate(
  start: Date | string | number,
  end?: Date | string | number | null,
) {
  const day = formatDate(start, { weekday: 'short' });
  return end ? `${day}, ${formatTime(start)} – ${formatTime(end)}` : `${day}, ${formatTime(start)}`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export function slugify(s: string) {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function readingMinutes(md: string) {
  return Math.max(1, Math.round(md.split(/\s+/).filter(Boolean).length / 220));
}
