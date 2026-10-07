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
 * Partners of La French Tech Bangkok, in the order of the Partners section on /ecosystem. Any
 * listing of the directory can be a partner; the type is independent of its category. Groups
 * follow what other French Tech communities show (Singapore, Toulouse): institutions first, then
 * companies, funders, places, experts, schools and community partners.
 */
export const PARTNER_TYPES = {
  institutional: {
    label: 'Institutional partners',
    blurb: 'The public bodies and chambers that back French tech in Thailand.',
  },
  corporate: {
    label: 'Corporate partners',
    blurb: 'Companies that support the community and its events.',
  },
  investor: {
    label: 'Investors and VCs',
    blurb: 'Funds and business angels who meet our founders.',
  },
  coworking: {
    label: 'Coworkings and venues',
    blurb: 'The places that host our events and our founders.',
  },
  expert: {
    label: 'Expert partners',
    blurb: 'Lawyers, accountants and advisers who help startups settle in Thailand.',
  },
  academic: {
    label: 'Schools and universities',
    blurb: 'Where we find talent, research and future founders.',
  },
  community: {
    label: 'Community and media partners',
    blurb: 'Associations, networks and media we work with.',
  },
} as const;
export type PartnerType = keyof typeof PARTNER_TYPES;
export const PARTNER_TYPE_KEYS = Object.keys(PARTNER_TYPES) as [PartnerType, ...PartnerType[]];

/** Partners grouped by type, in PARTNER_TYPES order, each group by its order then name. */
export function partnerGroups<
  T extends { name: string; partnerType: string | null; partnerOrder: number },
>(orgs: readonly T[]) {
  return PARTNER_TYPE_KEYS.map((key) => ({
    key,
    ...PARTNER_TYPES[key],
    items: orgs
      .filter((o) => o.partnerType === key)
      .sort((a, b) => a.partnerOrder - b.partnerOrder || a.name.localeCompare(b.name)),
  })).filter((g) => g.items.length > 0);
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
