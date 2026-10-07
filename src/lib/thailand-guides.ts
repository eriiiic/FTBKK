// Shared content of the two Thailand guides: the Founder's Guide (/founders-guide,
// lib/founders-guide.ts) and Expanding to Thailand (/expand-to-thailand, lib/expansion-guide.ts).
// Figures were checked against the linked sources on the date below; anything legal, visa or tax
// related must be confirmed with a professional before acting on it. The content lives here in
// code on purpose (no admin editor).

export const GUIDE_CHECKED_ON = '2026-10-07';

/** GUIDE_CHECKED_ON as shown on the pages: "7 October 2026". */
export const GUIDE_CHECKED_LABEL = new Date(`${GUIDE_CHECKED_ON}T00:00:00Z`).toLocaleDateString(
  'en-GB',
  { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' },
);

export interface Source {
  label: string;
  url: string;
}

const src = (label: string, url: string): Source => ({ label, url });

export const SOURCES = {
  smartVisa: src(
    'SMART visa explained (Issa Compass, Oct 2026)',
    'https://www.issacompass.com/insights/thailand-smart-visa-explained-who-qualifies-what-it-covers-and-how-to-apply-in-2',
  ),
  smartOfficial: src('SMART Visa Unit, BOI', 'https://smart-visa.boi.go.th/'),
  ltrDtv: src(
    'LTR vs DTV (Issa Compass, Oct 2026)',
    'https://www.issacompass.com/insights/ltr-vs-dtv-visa-thailand-work-from-thailand-professional',
  ),
  ltrOfficial: src('Long-Term Resident visa, BOI', 'https://ltr.boi.go.th/'),
  dtv: src('DTV visa 2026 (Thaiger)', 'https://thethaiger.com/visas/dtv/'),
  evisa: src('Thai e-Visa portal', 'https://www.thaievisa.go.th/'),
  starterKit: src(
    'Entrepreneur setup in Thailand (Thailand Starter Kit)',
    'https://www.thailandstarterkit.com/entrepreneur/',
  ),
  fba: src(
    'Doing business in Thailand: key legal points (Tilleke & Gibbins)',
    'https://www.tilleke.com/insights/critical-considerations-foreign-investors-doing-business-thailand/',
  ),
  boiSoftware: src(
    'BOI incentives for software development (Tilleke & Gibbins, 2024)',
    'https://www.tilleke.com/insights/thailand-adopts-investment-incentive-policies-for-software-development-and-data-centers/',
  ),
  boi: src('Thailand Board of Investment', 'https://www.boi.go.th/'),
  dbd: src('Department of Business Development (company registration)', 'https://www.dbd.go.th/'),
  rd: src('Thai Revenue Department', 'https://www.rd.go.th/'),
  vat: src(
    'VAT at 7% extended to 30 Sept 2027 (MGR Online, Jul 2026)',
    'https://en.mgronline.com/politics/cabinet-greenlights-extension-of-7-vat-rate-through-30-sept-2027-to-control-cost/',
  ),
  residency: src(
    'Tax residency and foreign income (Issa Compass, 2026)',
    'https://www.issacompass.com/insights/thailand-tax-residency-explained-the-180-day-rule-and-how-foreign-income-is-actu',
  ),
  sso: src(
    'Social security changes for 2026 (HLB Thailand)',
    'https://www.hlbthai.com/thailand-social-security-contribution-changes-for-2026/',
  ),
  pdpa: src(
    'PDPA fines imposed (Tilleke & Gibbins, Aug 2025)',
    'https://www.tilleke.com/insights/more-than-a-warning-eight-serious-fines-imposed-in-thai-data-protection-cases',
  ),
  pdpc: src('Personal Data Protection Committee', 'https://www.pdpc.or.th/'),
  startupAct: src(
    'Draft Startup Promotion Act (Tilleke & Gibbins, Dec 2025)',
    'https://www.tilleke.com/insights/thailand-prepares-startup-promotion-act-to-unlock-fundraising-and-support/',
  ),
  nia: src('Startup Thailand (NIA)', 'https://startupthailand.nia.or.th/'),
  depa: src('Digital Economy Promotion Agency (depa)', 'https://www.depa.or.th/en/'),
  dip: src('Department of Intellectual Property', 'https://www.ipthailand.go.th/en/'),
  businessFrance: src('Business France / Team France Export', 'https://www.businessfrance.fr/'),
  vie: src('V.I.E (international volunteer programme)', 'https://mon-vie-via.businessfrance.fr/'),
  ftcc: src('Franco-Thai Chamber of Commerce', 'https://www.francothaicc.com/'),
  tresor: src(
    'French Embassy economic service in Thailand',
    'https://www.tresor.economie.gouv.fr/Pays/TH',
  ),
  bpifrance: src('Bpifrance (export support)', 'https://www.bpifrance.fr/'),
  cfe: src('Caisse des Français de l’Étranger', 'https://www.cfe.fr/'),
  registre: src(
    'Registering with the French consulate',
    'https://www.service-public.fr/particuliers/vosdroits/F33307',
  ),
  treaty: src(
    'France-Thailand tax treaty (impots.gouv.fr)',
    'https://www.impots.gouv.fr/international/conventions-fiscales',
  ),
  ltrHsp: src(
    'LTR visa: requirements and benefits (Thaiger, Aug 2026)',
    'https://thethaiger.com/visas/ltr/',
  ),
  capital: src(
    'Minimum capital for foreign companies (Tilleke & Gibbins)',
    'https://www.tilleke.com/insights/updated-minimum-capital-provisions-foreign-companies-thailand/',
  ),
  ibc: src(
    'International Business Centers (Tilleke & Gibbins)',
    'https://www.tilleke.com/insights/boi-merges-two-promoted-activities-new-international-business-centers/',
  ),
  selling: src(
    'Thailand: selling factors and techniques (US Commercial Service)',
    'https://www.trade.gov/country-commercial-guides/thailand-selling-factors-and-techniques',
  ),
  entities: src(
    'Business entities in Thailand in 2026 (Healy Consultants)',
    'https://www.healyconsultants.com/thailand-company-registration/setup-llc/',
  ),
} satisfies Record<string, Source>;

export type SourceKey = keyof typeof SOURCES;

/* ----------------------------------------------------------------------------------- visas */

export interface Visa {
  name: string;
  forWho: string;
  facts: string[];
  thaiWork: string;
  sources: SourceKey[];
}

export const VISA = {
  dtv: {
    name: 'DTV (Destination Thailand Visa)',
    forWho: 'Remote workers and freelancers with employers or clients outside Thailand.',
    facts: [
      '5 years, multiple entries, 180 days per entry (extendable once by 180 days).',
      'THB 500,000 in savings, ideally held for about 3 months.',
      'Visa fee about THB 10,000; e-Visa only, applied for from outside Thailand.',
    ],
    thaiWork: 'No Thai clients or employer, no work permit.',
    sources: ['dtv', 'ltrDtv', 'evisa'],
  },
  smartS: {
    name: 'SMART S (startup founder)',
    forWho:
      'Founders or directors (or 25%+ shareholders) of a Thai company in a targeted industry.',
    facts: [
      'Endorsement by NIA, depa or BOI is required.',
      'THB 600,000 in a personal account for the last 3 months; health insurance.',
      '2 years, renewable; no 90-day reporting, but annual reports to the SMART Visa Unit.',
      'The T, I and E categories are reported closed to new applications in 2026; only S and O (family) remain.',
    ],
    thaiWork: 'Yes, for the endorsed company. No separate work permit needed.',
    sources: ['smartVisa', 'smartOfficial'],
  },
  ltrWft: {
    name: 'LTR, Work-from-Thailand professional',
    forWho: 'Employees of a large foreign company (listed, or USD 50M revenue over 3 years).',
    facts: [
      'USD 80,000 a year of personal income (or USD 40,000+ with a master’s degree, owned IP or a USD 1M Series A).',
      '10 years (5 + 5), annual reporting instead of every 90 days.',
      'Health insurance of at least USD 50,000.',
    ],
    thaiWork:
      'No Thai income. The 17% flat tax applies only to the separate Highly-Skilled Professional category.',
    sources: ['ltrDtv', 'ltrOfficial'],
  },
  nonB: {
    name: 'Non-B visa + work permit',
    forWho: 'Anyone employed by a Thai company, including you as director of your own.',
    facts: [
      'Standard company: THB 2 million paid-up capital and 4 Thai employees per foreign work permit.',
      'BOI-promoted companies are exempt from both rules.',
      '90-day address reports at immigration (TM.47).',
    ],
    thaiWork: 'Yes, for the company and job named on the permit.',
    sources: ['starterKit', 'boi'],
  },
  ltrHsp: {
    name: 'LTR, Highly-Skilled Professional',
    forWho: 'Specialists and managers employed by a Thai company in a targeted industry.',
    facts: [
      'USD 80,000 a year of income (or USD 40,000+ with a master’s degree).',
      '17% flat personal income tax on Thai employment income.',
      '10 years (5 + 5); digital work permit, outside the 4 Thai staff per foreigner rule.',
    ],
    thaiWork: 'Yes, for the Thai employer named in the application.',
    sources: ['ltrHsp', 'ltrOfficial'],
  },
  vie: {
    name: 'V.I.E (French international volunteer)',
    forWho: 'Young French talent (18 to 28) posted abroad by a French company for 6 to 24 months.',
    facts: [
      'Managed by Business France, which handles the contract and social cover.',
      'Can be hosted by your Thai entity or by a partner structure while you set one up.',
      'A Thai visa and work permit are still needed: plan them with Business France.',
    ],
    thaiWork: 'Yes, for the host company in Thailand.',
    sources: ['vie', 'businessFrance'],
  },
} satisfies Record<string, Visa>;

/* ---------------------------------------------------------------------------------- taxes */

export interface TaxRow {
  label: string;
  value: string;
  note?: string;
  sources: SourceKey[];
}

export const TAXES: TaxRow[] = [
  {
    label: 'Corporate income tax',
    value: '20%',
    note: 'SMEs (capital under THB 5M and revenue under THB 30M): 0% up to THB 300,000 profit, 15% up to THB 3M, 20% above.',
    sources: ['starterKit', 'rd'],
  },
  {
    label: 'VAT',
    value: '7%',
    note: 'Reduced rate extended to 30 September 2027. Registration from THB 1.8 million revenue a year.',
    sources: ['vat', 'starterKit'],
  },
  {
    label: 'Withholding tax on services',
    value: '3% (usually)',
    note: 'Thai companies deduct it when paying service invoices and issue a certificate you claim back.',
    sources: ['rd'],
  },
  {
    label: 'Personal income tax',
    value: '0% to 35%',
    note: 'Progressive. Tax resident after 180 days in Thailand in a calendar year.',
    sources: ['residency', 'rd'],
  },
  {
    label: 'Foreign income',
    value: 'Taxed when remitted',
    note: 'Since 1 January 2024, foreign income brought into Thailand by a resident is taxable in the year it arrives.',
    sources: ['residency'],
  },
  {
    label: 'Social security',
    value: '5% + 5%',
    note: 'Employer and employee, on salary capped at THB 17,500 a month (THB 875 maximum each) for 2026 to 2028.',
    sources: ['sso'],
  },
  {
    label: 'France and Thailand',
    value: 'Tax treaty',
    note: 'A double taxation treaty signed in 1974 applies. Where you pay depends on residency and the income type.',
    sources: ['treaty'],
  },
];

/* ------------------------------------------------------------------------------ checklist */

export interface ChecklistPhase {
  title: string;
  items: string[];
}

/* ------------------------------------------------------------------------- who can help */

export interface Helper {
  name: string;
  what: string;
  url: string;
}

export const HELP_FRENCH: Helper[] = [
  {
    name: 'Business France / Team France Export',
    what: 'Market studies, B2B meetings, trade missions and the V.I.E programme.',
    url: SOURCES.businessFrance.url,
  },
  {
    name: 'Franco-Thai Chamber of Commerce',
    what: 'Business network, events, business services and introductions to trusted providers.',
    url: SOURCES.ftcc.url,
  },
  {
    name: 'Economic service of the French Embassy',
    what: 'Sector notes on Thailand and regulatory monitoring.',
    url: SOURCES.tresor.url,
  },
  {
    name: 'Bpifrance',
    what: 'Export insurance (assurance prospection) and financing for French companies going abroad.',
    url: SOURCES.bpifrance.url,
  },
  {
    name: 'La French Tech Bangkok',
    what: 'Founders who have done it before you, monthly events and introductions.',
    url: '/join',
  },
];

export const HELP_THAI: Helper[] = [
  {
    name: 'Board of Investment (BOI)',
    what: '100% foreign ownership, tax holidays and visa support for promoted activities.',
    url: SOURCES.boi.url,
  },
  {
    name: 'National Innovation Agency (NIA)',
    what: 'Startup Thailand programmes, grants and SMART visa endorsement.',
    url: SOURCES.nia.url,
  },
  {
    name: 'depa',
    what: 'Digital economy promotion, startup funds and SMART visa endorsement for digital companies.',
    url: SOURCES.depa.url,
  },
  {
    name: 'Department of Business Development',
    what: 'Company registration, annual filings and the public company register.',
    url: SOURCES.dbd.url,
  },
  {
    name: 'Department of Intellectual Property',
    what: 'Trademarks, patents and copyright notifications.',
    url: SOURCES.dip.url,
  },
];

/* -------------------------------------------------------------------------------- tips */

export const TIPS: { title: string; body: string }[] = [
  {
    title: 'LINE is the office',
    body: 'Clients, suppliers and officials expect LINE, not email. Create a LINE Official Account for the company early.',
  },
  {
    title: 'Relationships before contracts',
    body: 'Thai partners buy from people they know. Plan several meetings, meals and events before the first deal.',
  },
  {
    title: 'Keep it calm',
    body: 'Open disagreement in a meeting makes people lose face. Raise problems privately and phrase them as questions.',
  },
  {
    title: 'Thai language matters',
    body: 'Government forms, many contracts and invoices are in Thai. Budget for a bilingual assistant or accountant.',
  },
  {
    title: 'Two calendars',
    body: 'Official documents use the Buddhist Era: 2026 is 2569. Songkran in April and year end slow everything down.',
  },
  {
    title: 'Get paid locally',
    body: 'PromptPay QR codes are everywhere. Local gateways such as Opn Payments or 2C2P handle Thai cards and wallets.',
  },
];

/** The sources a set of cards cites, then any extra ones, without duplicates, for the list at the
 * bottom of a guide. */
export function sourceList(cited: SourceKey[][], extra: SourceKey[] = []): Source[] {
  return [...new Set([...cited.flat(), ...extra])].map((k) => SOURCES[k]);
}
