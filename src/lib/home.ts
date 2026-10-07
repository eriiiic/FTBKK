import { and, desc, eq, isNotNull, lt } from 'drizzle-orm';
import { getDb } from '../db';
import { events, organisations, type RecapPhoto } from '../db/schema';
import { mediaUrl } from './format';

// Data for the home page: photos and the partners strip. The pure helpers are
// exported for tests; homeData() runs the queries.

/** The default photo at the top of Home: the Chao Phraya and the Bangkok skyline. */
export const DEFAULT_HERO = {
  src: '/brand/hero-bangkok.jpg',
  srcset: '/brand/hero-bangkok-960.jpg 960w, /brand/hero-bangkok.jpg 1920w',
  alt: 'Bangkok, innovation hub of Southeast Asia',
};

/** The community collage until Website pages > Home has its own photos. */
export const DEFAULT_COMMUNITY_PHOTOS = [1, 2, 3].map((i) => ({
  src: `/brand/home/community-${i}.jpg`,
  alt: '',
}));

/** The items next to the About us photo, after the board's mockup; icons follow their position. */
export const DEFAULT_ABOUT_ITEMS = [
  { title: 'Connect', text: 'talent' },
  { title: 'Support', text: 'entrepreneurs' },
  { title: 'Accelerate', text: 'collaborations' },
  { title: 'Shine', text: 'internationally' },
];
export const ABOUT_ITEM_ICONS = [4, 1, 3, 2].map((i) => `/brand/home/pillar-${i}.png`);

/** "They support La French Tech Bangkok" until Website pages > Home lists its own. */
export const DEFAULT_PARTNERS = [
  { title: 'Business France', text: '', link: 'https://www.businessfrance.fr/' },
  {
    title: 'Franco-Thai Chamber of Commerce',
    text: '',
    link: 'https://www.francothaicc.com/',
  },
  { title: 'Embassy of France in Thailand', text: '', link: 'https://th.diplomatie.gouv.fr/' },
  { title: 'La French Tech', text: '', link: 'https://lafrenchtech.gouv.fr/' },
  { title: 'Bpifrance', text: '', link: 'https://www.bpifrance.fr/' },
];

/** The numbers band, from the board's mockup, until Site texts > Numbers has some. */
export const DEFAULT_HOME_NUMBERS = [
  { title: '300+', text: 'community members' },
  { title: '120+', text: 'startups supported' },
  { title: '50+', text: 'institutional and private partners' },
  { title: '3', text: 'regions connected (France, Thailand, Southeast Asia)' },
];

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
 * The photos for About us and the community collage, in order: the ones picked in Site texts, then
 * photos from recent event recaps, then event covers, without repeats.
 */
export function pickPhotos(
  chosen: RecapPhoto[],
  recent: { title: string; recap: { photos: RecapPhoto[] } | null; coverKey: string | null }[],
  max = 8,
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

export async function homeData(partners: readonly { title: string; link?: string }[]) {
  const db = getDb();
  const now = new Date();
  const [recent, orgs] = await Promise.all([
    db
      .select({ title: events.title, recap: events.recap, coverKey: events.coverKey })
      .from(events)
      .where(and(eq(events.status, 'published'), lt(events.startsAt, now)))
      .orderBy(desc(events.startsAt))
      .limit(12),
    db
      .select({
        name: organisations.name,
        logoKey: organisations.logoKey,
        url: organisations.website,
      })
      .from(organisations)
      .where(and(eq(organisations.status, 'published'), isNotNull(organisations.logoKey))),
  ]);
  return {
    eventPhotos: pickPhotos([], recent),
    partners: partnerLogos(partners, orgs),
  };
}

/** Fisher-Yates shuffle into a new array; `rand` is injectable for tests. */
export function shuffled<T>(list: readonly T[], rand: () => number = Math.random): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * The ecosystem carousel: up to `n` organisations picked at random for "All" and for each
 * category, so the home page doesn't always show the same (alphabetically first) names.
 */
export function carouselGroups<T extends { category: string }>(
  orgs: readonly T[],
  categories: readonly string[],
  n = 15,
  rand: () => number = Math.random,
) {
  return [
    { key: '', items: shuffled(orgs, rand).slice(0, n) },
    ...categories
      .map((key) => ({
        key,
        items: shuffled(
          orgs.filter((o) => o.category === key),
          rand,
        ).slice(0, n),
      }))
      .filter((g) => g.items.length > 0),
  ];
}

/** Splits a heading on *stars* so the starred words can be shown in red. */
export function highlightParts(text: string) {
  return text
    .split(/\*([^*]+)\*/)
    .map((t, i) => ({ text: t, mark: i % 2 === 1 }))
    .filter((p) => p.text);
}

const host = (u: string | null | undefined) => {
  try {
    return u ? new URL(u).hostname.replace(/^www\./, '') : null;
  } catch {
    return null;
  }
};

/**
 * The partners strip: each partner with the logo of the directory organisation that has the same
 * website (or name). Without one, the strip shows the name.
 */
export function partnerLogos(
  partners: readonly { title: string; link?: string }[],
  orgs: readonly LogoRow[],
): (Omit<Partner, 'logo'> & { logo: string | null })[] {
  return partners.map((p) => {
    const h = host(p.link);
    const name = p.title.trim().toLowerCase();
    const org =
      orgs.find((o) => o.logoKey && h && host(o.url) === h) ??
      orgs.find((o) => o.logoKey && o.name.trim().toLowerCase() === name);
    return { name: p.title, url: p.link || null, logo: mediaUrl(org?.logoKey) };
  });
}
