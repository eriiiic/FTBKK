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
  institutional: 'Institutional partner',
} as const;
export type BadgeKey = keyof typeof BADGES;

export const ORG_STATUSES = [
  'unverified',
  'pending',
  'published',
  'rejected',
  'expired',
  'hidden',
] as const;
export type OrgStatus = (typeof ORG_STATUSES)[number];
