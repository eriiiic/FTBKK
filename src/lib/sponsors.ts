import { z } from 'zod';
import { optionalUrl } from './forms';
import { mediaUrl } from './format';

// Hosts, sponsors and partners of an event. A row is linked to an organisation of the ecosystem
// directory (its current name, logo and website are used) or entered by hand (name, URL, logo).
// Pure helpers (no bindings) so they can be unit tested; the query is in queries.ts.

export const SPONSOR_ROLES = ['host', 'sponsor', 'partner'] as const;
export type SponsorRole = (typeof SPONSOR_ROLES)[number];
export const MAX_SPONSORS = 30;

/** Headings on the event page and labels in emails, in this order. */
export const ROLE_LABELS: Record<SponsorRole, string> = {
  host: 'Hosted by',
  sponsor: 'Sponsored by',
  partner: 'Partners',
};
/** The role as a noun, for the admin picker. */
export const ROLE_NAMES: Record<SponsorRole, string> = {
  host: 'Host (venue)',
  sponsor: 'Sponsor',
  partner: 'Partner',
};

const list = (len: number) => z.array(z.string().max(len)).max(MAX_SPONSORS).default([]);
const optionalId = z
  .union([z.literal(''), z.coerce.number().int().positive()])
  .optional()
  .transform((v) => (v ? v : null));

/** The sponsors form of the event editor (use formToObject(form, SPONSOR_ARRAYS)). */
export const SponsorsFormSchema = z
  .object({
    /** One entry per current row, in the order shown. */
    sponsorId: list(12),
    sponsorRole: z.array(z.enum(SPONSOR_ROLES)).max(MAX_SPONSORS).default([]),
    /** Name and URL of rows entered by hand (empty for rows linked to an organisation). */
    sponsorName: list(120),
    sponsorUrl: z.array(optionalUrl()).max(MAX_SPONSORS).default([]),
    sponsorRemove: list(12),
    /** Add an organisation from the ecosystem directory... */
    addOrgId: optionalId,
    /** ...or someone entered by hand. */
    addName: z
      .string()
      .max(120)
      .optional()
      .transform((s) => (s ? s : null))
      .refine((s) => s === null || s.length >= 2, 'Enter a name.'),
    addUrl: optionalUrl(),
    addRole: z.enum(SPONSOR_ROLES).default('sponsor'),
  })
  .refine((d) => !(d.addOrgId && d.addName), {
    message: 'Pick an organisation from the directory or enter a name, not both.',
    path: ['addOrgId'],
  });
export type SponsorsForm = z.infer<typeof SponsorsFormSchema>;
export const SPONSOR_ARRAYS = [
  'sponsorId',
  'sponsorRole',
  'sponsorName',
  'sponsorUrl',
  'sponsorRemove',
];

export interface SponsorRow {
  id: number;
  role: SponsorRole;
  organisationId: number | null;
  name: string;
  logoKey: string | null;
  url: string | null;
}
/** A row to save: existing rows keep their id, the added one has none. */
export type PlannedSponsor = Omit<SponsorRow, 'id'> & { id: number | null; sortOrder: number };
export type NewSponsor = Omit<SponsorRow, 'id'>;

/**
 * The event's new sponsor list from the form: the current rows in the order the form lists them
 * (with their edited role, and name and URL for rows entered by hand; minus the removed ones),
 * then the one being added. Rows missing from the form (added by another admin meanwhile) are kept
 * at the end. An organisation is listed once per role.
 */
export function planSponsors(
  prev: SponsorRow[],
  form: SponsorsForm,
  added: NewSponsor | null,
): PlannedSponsor[] {
  const byId = new Map(prev.map((s) => [s.id, s]));
  const removed = new Set(form.sponsorRemove.map(Number));
  const seen = new Set<number>();
  const out: (SponsorRow | NewSponsor)[] = [];
  form.sponsorId.forEach((raw, i) => {
    const row = byId.get(Number(raw));
    if (!row || seen.has(row.id)) return;
    seen.add(row.id);
    if (removed.has(row.id)) return;
    const role = form.sponsorRole[i] ?? row.role;
    if (row.organisationId) out.push({ ...row, role });
    else
      out.push({
        ...row,
        role,
        name: form.sponsorName[i]?.trim() || row.name,
        url: form.sponsorUrl[i] === undefined ? row.url : form.sponsorUrl[i]!,
      });
  });
  for (const s of prev) {
    if (seen.has(s.id) || removed.has(s.id)) continue;
    out.push(s);
  }
  if (added) {
    const dup =
      added.organisationId &&
      out.some((s) => s.organisationId === added.organisationId && s.role === added.role);
    if (!dup) out.push(added);
  }
  return out.slice(0, MAX_SPONSORS).map((s, sortOrder) => ({
    id: 'id' in s ? s.id : null,
    role: s.role,
    organisationId: s.organisationId,
    name: s.name,
    logoKey: s.logoKey,
    url: s.url,
    sortOrder,
  }));
}

/** A sponsor row joined with its organisation (org fields null when not linked or deleted). */
export interface SponsorWithOrg extends SponsorRow {
  orgName: string | null;
  orgSlug: string | null;
  orgLogoKey: string | null;
  orgWebsite: string | null;
  orgStatus: string | null;
}

export interface ShownSponsor {
  id: number;
  role: SponsorRole;
  name: string;
  logoKey: string | null;
  /** The organisation's ecosystem page, else its website; null = no link. */
  href: string | null;
  /** True when href leaves the site. */
  external: boolean;
}

/**
 * What the public sees: a linked organisation's current name, logo and website, its ecosystem
 * page when it is published; otherwise the values stored on the row.
 */
export function showSponsor(s: SponsorWithOrg): ShownSponsor {
  const linked = s.organisationId !== null && s.orgName !== null;
  const profile =
    linked && s.orgStatus === 'published' && s.orgSlug ? `/ecosystem/${s.orgSlug}` : null;
  const href = profile ?? (linked ? s.orgWebsite || s.url : s.url) ?? null;
  return {
    id: s.id,
    role: s.role,
    name: linked ? s.orgName! : s.name,
    logoKey: (linked ? s.orgLogoKey : null) ?? s.logoKey,
    href,
    external: !!href && !profile,
  };
}

/** Sponsors grouped by role (hosts, sponsors, partners), empty groups left out. */
export function groupSponsors<T extends { role: SponsorRole }>(list: T[]) {
  return SPONSOR_ROLES.map((role) => ({
    role,
    label: ROLE_LABELS[role],
    items: list.filter((s) => s.role === role),
  })).filter((g) => g.items.length > 0);
}

/** "A", "A and B", "A, B and C". */
export function joinNames(names: string[]) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** Rows for the details table of an email: ["Hosted by", "Acme"], ["Sponsored by", "B and C"]. */
export function sponsorDetails(list: { role: SponsorRole; name: string }[]): [string, string][] {
  return groupSponsors(list).map((g) => [g.label, joinNames(g.items.map((s) => s.name))]);
}

/** "Hosted by Acme · Sponsored by B and C · Partners: D", for one line of text. */
export function sponsorLine(list: { role: SponsorRole; name: string }[]) {
  return groupSponsors(list)
    .map(
      (g) =>
        `${g.role === 'partner' ? 'Partners:' : g.label} ${joinNames(g.items.map((s) => s.name))}`,
    )
    .join(' · ');
}

/**
 * Logos for an email: absolute URLs of raster logos only (most email clients don't show SVG),
 * with the name as alt text.
 */
export function emailLogos(list: ShownSponsor[], absolute: (path: string) => string) {
  return list
    .filter((s) => s.logoKey && !/\.svg$/i.test(s.logoKey))
    .map((s) => ({
      src: absolute(mediaUrl(s.logoKey)!),
      alt: s.name,
      url: s.href ? absolute(s.href) : undefined,
    }));
}
