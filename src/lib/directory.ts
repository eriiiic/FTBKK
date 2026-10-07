import { slugify } from './format';

/** Ecosystem directory vocabulary (from the board deck). Keys are stored in D1. */
export const CATEGORIES = {
  french_startup: { label: 'French startups', short: 'Startup' },
  french_company: { label: 'French companies in Thailand', short: 'Company' },
  service_provider: { label: 'French-speaking service providers', short: 'Services' },
  investor: { label: 'Investors', short: 'Investor' },
  incubator_coworking: { label: 'Incubators and coworkings', short: 'Incubator' },
  school: { label: 'Schools and universities', short: 'School' },
  institution: { label: 'Institutions', short: 'Institution' },
} as const;
export type Category = keyof typeof CATEGORIES;
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

export const SECTORS = [
  'AI',
  'Fintech',
  'E-commerce',
  'Travel and hospitality',
  'Mobility',
  'Health',
  'Climate and energy',
  'Agritech and food',
  'Industry',
  'Media and gaming',
  'Cybersecurity',
  'SaaS',
  'Other',
] as const;
export type Sector = (typeof SECTORS)[number];

export const STAGES = ['Idea', 'Pre-seed', 'Seed', 'Series A', 'Series B+', 'Profitable'] as const;

export const BADGES = {
  member: 'Member',
  sponsor: 'Sponsor',
  board: 'Board',
} as const;
export type BadgeKey = keyof typeof BADGES;

/**
 * A group of partners of La French Tech Bangkok (Investors and VCs, Hospitality…). The groups are
 * edited in Admin > Ecosystem > Partners and saved in settings.partnerGroups; `key` is stored on
 * the organisation (organisations.partner_type) and never changes once created.
 */
export interface PartnerGroup {
  key: string;
  label: string;
  blurb: string;
}

/**
 * The groups until the admin edits them, in the order of the Partners section on /ecosystem.
 * They follow what other French Tech communities show (Singapore, Toulouse): institutions first,
 * then companies, funders, places, experts, schools and community partners.
 */
export const DEFAULT_PARTNER_GROUPS: PartnerGroup[] = [
  {
    key: 'institutional',
    label: 'Institutional partners',
    blurb: 'The public bodies and chambers that back French tech in Thailand.',
  },
  {
    key: 'corporate',
    label: 'Corporate partners',
    blurb: 'Companies that support the community and its events.',
  },
  {
    key: 'investor',
    label: 'Investors and VCs',
    blurb: 'Funds and business angels who meet our founders.',
  },
  {
    key: 'coworking',
    label: 'Coworkings and venues',
    blurb: 'The places that host our events and our founders.',
  },
  {
    key: 'hospitality',
    label: 'Hospitality partners',
    blurb: 'Hotels, restaurants and bars that welcome our community.',
  },
  {
    key: 'expert',
    label: 'Expert partners',
    blurb: 'Lawyers, accountants and advisers who help startups settle in Thailand.',
  },
  {
    key: 'academic',
    label: 'Schools and universities',
    blurb: 'Where we find talent, research and future founders.',
  },
  {
    key: 'community',
    label: 'Community and media partners',
    blurb: 'Associations, networks and media we work with.',
  },
];

/** The saved groups, or the defaults when none were ever saved. */
export const partnerGroupList = (saved: readonly PartnerGroup[] | undefined) =>
  saved?.length ? [...saved] : DEFAULT_PARTNER_GROUPS;

/** Partners grouped in the order of `groups`, each group by its order then name. */
export function partnerGroups<
  T extends { name: string; partnerType: string | null; partnerOrder: number },
>(orgs: readonly T[], groups: readonly PartnerGroup[]) {
  return groups
    .map((g) => ({
      ...g,
      items: orgs
        .filter((o) => o.partnerType === g.key)
        .sort((a, b) => a.partnerOrder - b.partnerOrder || a.name.localeCompare(b.name)),
    }))
    .filter((g) => g.items.length > 0);
}

/** One row of the group editor, in the order shown (key empty for a new group). */
export interface PartnerGroupRow {
  key: string;
  label: string;
  blurb: string;
  remove: boolean;
}

/**
 * Applies the group editor: renames, reorders, adds (key made from the label) and removes groups.
 * A group that still has partners can't be removed; the error names it.
 */
export function editPartnerGroups(
  rows: readonly PartnerGroupRow[],
  current: readonly PartnerGroup[],
  inUse: ReadonlySet<string>,
): { groups: PartnerGroup[] } | { error: string } {
  const groups: PartnerGroup[] = [];
  const known = new Set(current.map((g) => g.key));
  const taken = new Set<string>();
  for (const r of rows) {
    const label = r.label.trim();
    const blurb = r.blurb.trim();
    const existing = r.key && known.has(r.key);
    if (existing && r.remove) {
      if (inUse.has(r.key)) {
        const name = current.find((g) => g.key === r.key)?.label ?? r.key;
        return {
          error: `"${name}" still has partners: move them to another group before removing it.`,
        };
      }
      continue;
    }
    if (!label) {
      if (existing) return { error: 'Every group needs a name.' };
      continue; // the empty "new group" row
    }
    let key = existing ? r.key : slugify(label).slice(0, 40) || 'group';
    if (!existing) {
      const base = key;
      for (let i = 2; known.has(key) || taken.has(key); i++) key = `${base}-${i}`;
    }
    taken.add(key);
    groups.push({ key, label, blurb });
  }
  if (!groups.length) return { error: 'Keep at least one group.' };
  return { groups };
}

export const ORG_STATUSES = [
  'unverified',
  'pending',
  'published',
  'rejected',
  'expired',
  'hidden',
] as const;
export type OrgStatus = (typeof ORG_STATUSES)[number];
