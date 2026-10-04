import { env } from 'cloudflare:workers';

/** Site-wide settings, editable in /admin/settings. Stored as key/JSON rows in the settings table. */
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
  pillars: { title: string; text: string }[];
  aboutIntro: string;
  /** "An official French Tech Community" section on the About page (Markdown). */
  communityText: string;
  /** "You can join us" cards on the home and About pages; link is optional. */
  joinPaths: { title: string; text: string; link?: string }[];
  membershipOpen: boolean;
  memberPriority: boolean;
  analyticsToken: string;
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
  pillars: [],
  aboutIntro: '',
  communityText: '',
  joinPaths: [],
  membershipOpen: false,
  memberPriority: false,
  analyticsToken: '',
};

export type Card = Settings['joinPaths'][number];

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
