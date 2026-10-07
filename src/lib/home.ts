import { and, desc, eq, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { eventSponsors, events, organisations, type RecapPhoto } from '../db/schema';
import { mediaUrl } from './format';

// Data for the home page: photos and the partners strip. The pure helpers are
// exported for tests; homeData() runs the queries.

export const MAX_HOME_PHOTOS = 8;

/** Used for the hero while no home photo nor event photo exists. */
export const FALLBACK_HERO = { src: '/brand/hero-bangkok.jpg', alt: '' };

/** Texts of the home page blocks when Site texts leaves them empty. */
export const DEFAULT_COMMUNITY_TITLE =
  'Join a network of founders, investors, mentors and partners';
export const DEFAULT_COMMUNITY_TEXT =
  'Free and open to everyone, French, Thai or any other nationality. Come to an event, list your company in the directory, or become a member to meet the people who can help you build.';
export const DEFAULT_CLOSING_TITLE = "Let's build tomorrow's bridges together";

export interface HomePhoto {
  src: string;
  alt: string;
}

/**
 * The photos the page uses, in order: the ones picked in Site texts, then photos from recent event
 * recaps, then event covers, without repeats.
 */
export function pickPhotos(
  chosen: RecapPhoto[],
  recent: { title: string; recap: { photos: RecapPhoto[] } | null; coverKey: string | null }[],
  max = MAX_HOME_PHOTOS,
): HomePhoto[] {
  const out: HomePhoto[] = [];
  const seen = new Set<string>();
  const add = (key: string | null | undefined, alt: string) => {
    if (!key || seen.has(key) || out.length >= max) return;
    seen.add(key);
    out.push({ src: mediaUrl(key)!, alt });
  };
  for (const p of chosen) add(p.key, p.alt ?? '');
  // One photo per event first, so the collage shows several events.
  for (const e of recent) add(e.recap?.photos[0]?.key, e.recap?.photos[0]?.alt || e.title);
  for (const e of recent) for (const p of e.recap?.photos ?? []) add(p.key, p.alt || e.title);
  for (const e of recent) add(e.coverKey, '');
  return out;
}

export interface Partner {
  name: string;
  logo: string;
  url: string | null;
}

type LogoRow = { name: string; logoKey: string | null; url: string | null };

/**
 * The partners strip: institutional partners first, then the hosts, sponsors and partners of our
 * events (one row per event), most events first. Only those with a logo, one per name.
 */
export function pickPartners(institutions: LogoRow[], sponsors: LogoRow[], max = 16): Partner[] {
  const by = new Map<string, { p: Partner; n: number }>();
  const add = (r: LogoRow, weight: number) => {
    if (!r.logoKey || !r.name.trim()) return;
    const k = r.name.trim().toLowerCase();
    const cur = by.get(k);
    if (cur) cur.n += weight;
    else
      by.set(k, { p: { name: r.name.trim(), logo: mediaUrl(r.logoKey)!, url: r.url }, n: weight });
  };
  for (const r of institutions) add(r, 1000);
  for (const r of sponsors) add(r, 1);
  return [...by.values()]
    .sort((a, b) => b.n - a.n || a.p.name.localeCompare(b.p.name))
    .slice(0, max)
    .map((x) => x.p);
}

export async function homeData(chosen: RecapPhoto[]) {
  const db = getDb();
  const now = new Date();
  const [recent, sponsorRows, institutions] = await Promise.all([
    db
      .select({ title: events.title, recap: events.recap, coverKey: events.coverKey })
      .from(events)
      .where(and(eq(events.status, 'published'), lt(events.startsAt, now)))
      .orderBy(desc(events.startsAt))
      .limit(12),
    db
      .select({
        name: sql<string>`coalesce(${organisations.name}, ${eventSponsors.name})`,
        logoKey: sql<string | null>`coalesce(${organisations.logoKey}, ${eventSponsors.logoKey})`,
        url: sql<string | null>`coalesce(${organisations.website}, ${eventSponsors.url})`,
      })
      .from(eventSponsors)
      .leftJoin(organisations, eq(organisations.id, eventSponsors.organisationId)),
    db
      .select({
        name: organisations.name,
        logoKey: organisations.logoKey,
        url: organisations.website,
      })
      .from(organisations)
      .where(
        and(
          eq(organisations.status, 'published'),
          inArray(organisations.category, ['institution']),
          isNotNull(organisations.logoKey),
        ),
      ),
  ]);
  return {
    photos: pickPhotos(chosen, recent),
    partners: pickPartners(institutions, sponsorRows),
  };
}
