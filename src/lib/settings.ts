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
  joinPaths: { title: string; text: string }[];
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
  joinPaths: [],
  membershipOpen: false,
  memberPriority: false,
  analyticsToken: '',
};

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
