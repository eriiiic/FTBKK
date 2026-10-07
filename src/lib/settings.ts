import { env } from 'cloudflare:workers';
import { DEFAULT_CODE_OF_CONDUCT } from './code-of-conduct';
import { DEFAULT_PRIVACY_NOTICE } from './privacy';

/** Site-wide settings, editable in /admin/settings and /admin/site-texts. Stored as key/JSON rows in the settings table. */
export interface Settings {
  siteTitle: string;
  siteDescription: string;
  contactEmail: string;
  moderatorEmails: string[];
  socials: {
    instagram: string;
    whatsapp: string;
    facebook: string;
    linkedin: string;
    youtube: string;
  };
  heroTitle: string;
  heroTagline: string;
  mission: string;
  values: string[];
  ecosystemHeading: string;
  /** Home photo slots (Website pages > Home); null = the built-in default. */
  homeHeroPhoto: Photo | null;
  homeAboutPhoto: Photo | null;
  homeCommunityPhotos: (Photo | null)[];
  /** The four items next to the About us photo on Home; empty = DEFAULT_ABOUT_ITEMS. */
  homeAboutItems: { title: string; text: string }[];
  /** "They support La French Tech Bangkok" on Home: title = name, link = website. Empty = defaults. */
  homePartners: Card[];
  /** Default covers of Connect and Talk events (R2 keys); null = the built-in image. */
  eventCovers: { connect: string | null; talk: string | null };
  /** The numbers band on Home, typed by hand: title = the figure ("300+"), text = its label. */
  homeNumbers: { title: string; text: string }[];
  /** Home "Community" block; empty = the defaults in lib/home.ts. */
  homeCommunityTitle: string;
  homeCommunityText: string;
  /** Home closing band; empty = DEFAULT_CLOSING_TITLE. */
  homeClosingTitle: string;
  aboutIntro: string;
  /** "An official French Tech Community" section on the About page (Markdown). */
  communityText: string;
  /** "You can join us" cards on the home and About pages; link is optional. */
  joinPaths: Card[];
  /** Top of the /join page (Markdown); empty = DEFAULT_JOIN_INTRO. */
  joinIntro: string;
  /** "Become a member" block on /join (Markdown); empty = DEFAULT_JOIN_MEMBERSHIP. */
  joinMembership: string;
  /** Top of /tech-pulse (Markdown); empty = DEFAULT_TECH_PULSE_INTRO. */
  techPulseIntro: string;
  /** The Thai page /th (Markdown, "## " starts a section); empty = DEFAULT_THAI_PAGE. */
  thaiPage: string;
  /** /code-of-conduct page (Markdown); {contactEmail} is replaced by the contact email. */
  codeOfConduct: string;
  /** /privacy page (Markdown); {contactEmail} is replaced by the contact email. */
  privacyNotice: string;
  membershipOpen: boolean;
  /** Individual membership sign-up on /join (lib/members.ts). */
  memberSignupOpen: boolean;
  memberPriority: boolean;
  analyticsToken: string;
  /** Contacts > Possible duplicates: pairs marked "not the same person" (see pairKey). */
  notDuplicates: string[];
}

/** Fallbacks used when a key has never been saved (fresh database). Real copy is seeded by the import. */
export const defaultSettings: Settings = {
  siteTitle: 'La French Tech Bangkok',
  siteDescription: '',
  contactEmail: 'hello@french-tech-bangkok.com',
  moderatorEmails: [],
  socials: { instagram: '', whatsapp: '', facebook: '', linkedin: '', youtube: '' },
  heroTitle: 'La French Tech Bangkok',
  heroTagline: '',
  mission: '',
  values: [],
  ecosystemHeading: '',
  homeHeroPhoto: null,
  homeAboutPhoto: null,
  homeCommunityPhotos: [],
  homeAboutItems: [],
  homePartners: [],
  eventCovers: { connect: null, talk: null },
  homeNumbers: [],
  homeCommunityTitle: '',
  homeCommunityText: '',
  homeClosingTitle: '',
  aboutIntro: '',
  communityText: '',
  joinPaths: [],
  joinIntro: '',
  joinMembership: '',
  techPulseIntro: '',
  thaiPage: '',
  codeOfConduct: DEFAULT_CODE_OF_CONDUCT,
  privacyNotice: DEFAULT_PRIVACY_NOTICE,
  membershipOpen: false,
  memberSignupOpen: false,
  memberPriority: false,
  analyticsToken: '',
  notDuplicates: [],
};

export type Card = { title: string; text: string; link?: string };
export type Photo = { key: string; alt?: string };

/**
 * Cards edited as repeated form rows (`<prefix>Title`, `<prefix>Text`, `<prefix>Link` arrays)
 * back into a list. Empty rows are dropped; the link is kept only when `withLink`.
 */
export function cardsFromForm(form: Record<string, unknown>, prefix: string, withLink = false) {
  const list = (k: string) => (Array.isArray(form[k]) ? (form[k] as string[]) : []);
  const [titles, texts, links] = ['Title', 'Text', 'Link'].map((k) => list(`${prefix}${k}`));
  return titles!
    .map((t, i): Card => {
      const link = withLink ? links![i]?.trim() : '';
      return {
        title: t.trim(),
        text: (texts![i] ?? '').replace(/\r\n?/g, '\n').trim(),
        ...(link ? { link } : {}),
      };
    })
    .filter((c) => c.title || c.text || c.link);
}

export async function getSettings(db: D1Database = env.DB): Promise<Settings> {
  try {
    const { results } = await db
      .prepare('SELECT key, value FROM settings')
      .all<{ key: string; value: string }>();
    const saved = Object.fromEntries(results.map((r) => [r.key, JSON.parse(r.value)]));
    return { ...defaultSettings, ...saved };
  } catch {
    // Table not migrated yet.
    return defaultSettings;
  }
}

export async function saveSettings(patch: Partial<Settings>, db: D1Database = env.DB) {
  const stmt = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );
  await db.batch(Object.entries(patch).map(([k, v]) => stmt.bind(k, JSON.stringify(v))));
}
