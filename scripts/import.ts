/**
 * Phase 3: load the captured Wix content (migration/data, falling back to migration/data/seed)
 * into D1 and upload images to R2.
 *
 *   npm run import            # local D1 + local R2 (wrangler dev / astro dev state)
 *   npm run import -- --remote   # the real Cloudflare D1 + R2 (phase 9)
 *   --skip-images             # only the database
 *   --force-settings          # overwrite settings already edited in the admin
 *
 * Idempotent: rows are upserted on slug, people are replaced, settings are only inserted when
 * missing (unless --force-settings).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { slugify } from '../src/lib/format';
import { plainText } from '../src/lib/markdown';
import { mapWixCategory, sectorsFor } from './lib/wix-categories';
import {
  cleanWixMarkdown,
  decodeEntities,
  dropLeadingCoverImage,
  extractByline,
  inlineAttachments,
  postCategories,
} from './lib/clean-wix';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'migration', 'data');
const IMAGES = path.join(ROOT, 'migration', 'images');
const FILES = path.join(ROOT, 'migration', 'files');
const args = new Set(process.argv.slice(2));
const target = args.has('--remote') ? '--remote' : '--local';
const now = Math.floor(Date.now() / 1000);

function load<T>(name: string): { data: T; source: string } | null {
  for (const file of [path.join(DATA, name), path.join(DATA, 'seed', name)]) {
    if (existsSync(file))
      return { data: JSON.parse(readFileSync(file, 'utf8')), source: path.relative(ROOT, file) };
  }
  return null;
}

const q = (v: unknown): string => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'object') return q(JSON.stringify(v));
  return `'${String(v).replace(/'/g, "''")}'`;
};
const toTs = (iso: string | undefined | null) => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.floor(t / 1000);
};

function upsert(table: string, row: Record<string, unknown>, conflict = 'slug') {
  const cols = Object.keys(row);
  const updates = cols.filter((c) => c !== conflict).map((c) => `${c} = excluded.${c}`);
  return `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map((c) => q(row[c])).join(', ')}) ON CONFLICT(${conflict}) DO UPDATE SET ${updates.join(', ')};`;
}

// ---------- images ----------

const imageMap: Record<string, string> = load<Record<string, string>>('images.json')?.data ?? {};
const toUpload = new Map<string, string>(); // r2 key -> local file
/** migration image path (e.g. "events/foo.jpg") -> R2 key; null when the file is missing. */
function imageKey(rel: string | null | undefined): string | null {
  if (!rel) return null;
  const file = path.join(IMAGES, rel);
  if (!existsSync(file)) return null;
  toUpload.set(rel, file);
  return rel;
}
/** Rewrite Wix image URLs inside Markdown to /media/ keys. */
function rewriteImages(md: string) {
  return md.replace(/https?:\/\/static\.wixstatic\.com\/media\/[^\s)"']+/g, (url) => {
    const orig = url.match(/https?:\/\/static\.wixstatic\.com\/media\/[^/?#]+/)?.[0] ?? url;
    const key = imageKey(imageMap[orig]);
    return key ? `/media/${key}` : url;
  });
}

// ---------- build SQL ----------

const sql: string[] = ['PRAGMA defer_foreign_keys = true;'];
const counts: Record<string, string> = {};

// Settings (from the seed copy; captured pages.json is raw section text for reference).
const pages = load<any>('seed/pages.json') ?? load<any>('pages.json');
if (pages && !Array.isArray(pages.data)) {
  const { site, home, about } = pages.data;
  const values: Record<string, unknown> = {
    siteTitle: 'La French Tech Bangkok',
    siteDescription: site.description,
    contactEmail: site.contactEmail,
    socials: site.socials,
    heroTitle: home.heroTitle,
    heroTagline: home.heroTagline,
    mission: home.mission,
    values: home.values,
    ecosystemHeading: home.ecosystemHeading,
    pillars: home.pillars,
    aboutIntro: about.intro,
    joinPaths: about.join,
  };
  const verb = args.has('--force-settings') ? 'INSERT OR REPLACE' : 'INSERT OR IGNORE';
  for (const [k, v] of Object.entries(values)) {
    sql.push(`${verb} INTO settings (key, value) VALUES (${q(k)}, ${q(JSON.stringify(v))});`);
  }
  counts.settings = `${Object.keys(values).length} keys from ${pages.source}`;
}

// Categories.
const CATS = [
  'Ecosystem News',
  'Founder Guides',
  'Tech Insights',
  'Events & Community',
  'Studies & Resources',
];
CATS.forEach((name, i) =>
  sql.push(upsert('categories', { slug: slugify(name), name, sort_order: i })),
);

// Events.
const ev = load<any[]>('events.json');
if (ev) {
  const list = ev.data.filter((e) => !e.junk);
  for (const e of list) {
    const startsAt = toTs(e.startsAt);
    if (!startsAt) continue;
    const upcoming = startsAt > now;
    sql.push(
      upsert('events', {
        slug: e.slug,
        title: decodeEntities(e.title),
        series: e.series ?? 'Other',
        summary: e.summary ? decodeEntities(e.summary) : null,
        body_md: rewriteImages(cleanWixMarkdown(e.bodyMd ?? '')),
        starts_at: startsAt,
        ends_at: toTs(e.endsAt),
        timezone: 'Asia/Bangkok',
        venue: e.venue || null,
        address: e.address || null,
        map_url: e.address
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${e.venue ?? ''} ${e.address}`.trim())}`
          : null,
        cover_key: imageKey(e.cover),
        registration_open: upcoming,
        status: 'published',
        updated_at: now,
      }),
    );
  }
  counts.events = `${list.length} from ${ev.source}`;
}

// Posts.
const po = load<any[]>('posts.json');
if (po) {
  for (const p of po.data) {
    const attachments = (p.attachments ?? [])
      .filter((a: any) => a.file && existsSync(path.join(ROOT, 'migration', a.file)))
      .map((a: any) => {
        const key = `posts/files/${path.basename(a.file)}`;
        toUpload.set(key, path.join(ROOT, 'migration', a.file));
        return { name: a.name, key };
      });
    const byline = extractByline(cleanWixMarkdown(p.bodyMd ?? ''));
    const coverKey = imageKey(p.cover);
    const body = dropLeadingCoverImage(
      inlineAttachments(rewriteImages(byline.body), attachments),
      coverKey,
    );
    sql.push(
      upsert('posts', {
        slug: p.slug,
        title: decodeEntities(p.title),
        // Some Wix excerpts start with the flattened byline ("Bangkok, ThailandBy …"): rebuild those.
        excerpt: /^Bangkok,\s*Thailand/i.test(p.excerpt ?? '')
          ? plainText(byline.body, 200)
          : p.excerpt
            ? decodeEntities(p.excerpt)
            : null,
        body_md: body,
        cover_key: coverKey,
        // The byline typed in the post is right where Wix's author field is not (e.g. "master6942").
        author_name: byline.authorName ?? p.author ?? null,
        author_role: byline.authorRole,
        published_at: toTs(p.publishedAt) ?? now,
        status: 'published',
        attachments,
        updated_at: now,
      }),
    );
    // Replace the post's categories (an earlier import put every post in every category).
    sql.push(
      `DELETE FROM post_categories WHERE post_id = (SELECT id FROM posts WHERE slug = ${q(p.slug)});`,
    );
    for (const c of postCategories(p.title, p.categories ?? [])) {
      const slug = slugify(c);
      sql.push(
        upsert('categories', { slug, name: c, sort_order: 99 }).replace(
          /DO UPDATE SET .*;$/,
          'DO NOTHING;',
        ),
      );
      sql.push(
        `INSERT OR IGNORE INTO post_categories (post_id, category_id) SELECT p.id, c.id FROM posts p, categories c WHERE p.slug = ${q(p.slug)} AND c.slug = ${q(slug)};`,
      );
    }
  }
  counts.posts = `${po.data.length} from ${po.source}`;
}

// Organisations: captured sponsors + seed institutions and board companies, merged by slug.
type OrgIn = {
  slug?: string;
  name: string;
  category?: string;
  wixCategory?: string;
  description?: string;
  pitch?: string;
  badges?: string[];
  sectors?: string[];
  logo?: string;
  website?: string | null;
  linkedin?: string | null;
};
const orgs = new Map<string, OrgIn & { badges: string[] }>();
const sponsors = existsSync(path.join(DATA, 'organisations.json'))
  ? (JSON.parse(readFileSync(path.join(DATA, 'organisations.json'), 'utf8')) as OrgIn[])
  : [];
// "AlphOmega8 Co. Ltd." (sponsor page) and "AlphOmega8" (board company) are one organisation.
const LEGAL_SUFFIX =
  /[\s,]+(?:co\.?,?\s*ltd\.?|company limited|ltd\.?|limited|inc\.?|pte\.?\s*ltd\.?)\s*$/i;
const orgSlug = (name: string) => slugify(name.replace(LEGAL_SUFFIX, ''));
for (const s of sponsors) {
  const slug = orgSlug(s.name || s.slug || '');
  // Rows imported earlier under the suffixed slug are replaced by this one.
  const old = slugify(s.name || '');
  if (old && old !== slug) sql.push(`DELETE FROM organisations WHERE slug = ${q(old)};`);
  orgs.set(slug, { ...s, slug, badges: ['sponsor'] });
}
const seedOrgs = load<OrgIn[]>('seed/organisations.json')?.data ?? [];
for (const s of seedOrgs) {
  const slug = orgSlug(s.name);
  const existing = orgs.get(slug);
  orgs.set(
    slug,
    existing
      ? { ...existing, ...s, badges: [...new Set([...existing.badges, ...(s.badges ?? [])])] }
      : { ...s, slug, badges: s.badges ?? [] },
  );
}
for (const o of orgs.values()) {
  const description = (o.description ?? '').trim();
  sql.push(
    upsert('organisations', {
      slug: o.slug,
      name: o.name,
      logo_key: imageKey(o.logo),
      pitch: o.pitch ?? (description ? description.split(/(?<=[.!?])\s/)[0]!.slice(0, 160) : null),
      description_md: description,
      category: o.category ?? mapWixCategory(o.wixCategory ?? ''),
      sectors: o.sectors ?? sectorsFor(`${o.wixCategory ?? ''} ${description}`),
      badges: o.badges,
      website: o.website ?? null,
      linkedin: o.linkedin ?? null,
      status: 'published',
      confirmed_at: now,
      updated_at: now,
    }),
  );
}
counts.organisations = `${orgs.size} (${sponsors.length} captured sponsors + ${seedOrgs.length} seed)`;

// People: seed names enriched with captured photos/LinkedIn when the capture found them.
const ppl = load<any[]>('seed/people.json');
if (ppl) {
  const captured = existsSync(path.join(DATA, 'people.captured.json'))
    ? (Object.values(
        JSON.parse(readFileSync(path.join(DATA, 'people.captured.json'), 'utf8')),
      ).flat() as any[])
    : [];
  sql.push('DELETE FROM people;');
  ppl.data.forEach((p, i) => {
    const hit = captured.find((c) => c.text?.includes(p.name));
    const photoRel = hit?.photo
      ? imageMap[hit.photo.match(/https?:\/\/static\.wixstatic\.com\/media\/[^/?#]+/)?.[0] ?? '']
      : null;
    const titleLine = hit?.text
      ?.split('\n')
      .map((l: string) => l.trim())
      .find((l: string) => l && l !== p.name && l !== p.organisation);
    sql.push(
      `INSERT INTO people (name, title, organisation_id, organisation_name, "group", linkedin, photo_key, sort_order) VALUES (${q(p.name)}, ${q(p.title || titleLine || null)}, (SELECT id FROM organisations WHERE slug = ${q(orgSlug(p.organisation))}), ${q(p.organisation)}, ${q(p.group)}, ${q(hit?.linkedin ?? null)}, ${q(imageKey(photoRel))}, ${i});`,
    );
  });
  counts.people = `${ppl.data.length} from ${ppl.source}${captured.length ? ' (enriched from capture)' : ''}`;
}

// ---------- run ----------

const dir = mkdtempSync(path.join(tmpdir(), 'ftbkk-import-'));
const sqlFile = path.join(dir, 'import.sql');
writeFileSync(sqlFile, sql.join('\n') + '\n');
const wrangler = (...a: string[]) =>
  execFileSync('npx', ['wrangler', ...a], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'inherit'],
  }).toString();

console.log(`Importing into ${target === '--remote' ? 'REMOTE' : 'local'} D1…`);
wrangler('d1', 'execute', 'ftbkk', target, '--file', sqlFile, '--yes');

if (!args.has('--skip-images')) {
  let n = 0;
  for (const [key, file] of toUpload) {
    wrangler('r2', 'object', 'put', `ftbkk-media/${key}`, '--file', file, target);
    n++;
  }
  counts.media = `${n} files uploaded to R2`;
}
if (!existsSync(IMAGES)) counts.note = 'migration/images missing: run `npm run capture` for images';
if (!existsSync(FILES)) counts.files = 'no post attachments captured yet';

const tables = ['events', 'posts', 'categories', 'organisations', 'people', 'settings'];
const rows = tables.map((t) => {
  const out = wrangler(
    'd1',
    'execute',
    'ftbkk',
    target,
    '--json',
    '--command',
    `SELECT COUNT(*) AS n FROM ${t}`,
  );
  return { table: t, rows: (JSON.parse(out)[0].results as { n: number }[])[0]!.n };
});
console.table(rows);
console.log(counts);
