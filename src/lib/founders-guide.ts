// The Founder's Guide (/founders-guide): practical notes for French and francophone founders
// setting up or growing in Thailand. Figures were checked against the sources listed at the bottom
// of the page on the date below; anything legal, visa or tax related must be confirmed with a
// professional before acting on it.

export const GUIDE_CHECKED_ON = '2026-10-07';

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
} satisfies Record<string, Source>;

export type SourceKey = keyof typeof SOURCES;

/* ---------------------------------------------------------------- paths (interactive picker) */

export interface Path {
  id: string;
  label: string;
  who: string;
  visa: string;
  structure: string;
  steps: string[];
  sections: { href: string; label: string }[];
}

export const PATHS: Path[] = [
  {
    id: 'explore',
    label: 'Exploring the market',
    who: 'You run a company in France or elsewhere and want to test Thailand before committing.',
    visa: 'Visa exemption or a business visit. Meetings are fine; doing paid work in Thailand is not.',
    structure: 'Keep selling from your existing company. No Thai entity yet.',
    steps: [
      'Book a market check with Business France (Team France Export) in Bangkok.',
      'Come to a French Tech Connect evening to meet founders who did it before you.',
      'Talk to 10 potential customers before you talk to a lawyer.',
      'File your trademark in Thailand early: it is first-to-file.',
      'Read the BOI rules for your activity: they decide whether you can own 100%.',
    ],
    sections: [
      { href: '#structure', label: 'Company structures' },
      { href: '#help', label: 'Who can help' },
    ],
  },
  {
    id: 'remote',
    label: 'Working remotely from Bangkok',
    who: 'Your company and clients are abroad; you want to live and work from Thailand.',
    visa: 'DTV (5 years, foreign clients only) or LTR Work-from-Thailand if your employer is large.',
    structure: 'None in Thailand. Your income must come from outside Thailand.',
    steps: [
      'Check the DTV conditions: THB 500,000 in savings and proof of remote work.',
      'Apply online from outside Thailand on the e-Visa portal.',
      'Count your days: 180 days or more in a year makes you a Thai tax resident.',
      'Plan when you bring money into Thailand: foreign income remitted by a resident is taxable.',
      'Keep French health cover going (CFE or private insurance).',
    ],
    sections: [
      { href: '#visas', label: 'Visas compared' },
      { href: '#tax', label: 'Taxes at a glance' },
    ],
  },
  {
    id: 'setup',
    label: 'Setting up a Thai company',
    who: 'You will sell to Thai customers, hire locally or need a Thai contracting entity.',
    visa: 'SMART S if your startup is endorsed by NIA, depa or BOI; otherwise Non-B and a work permit.',
    structure: 'A Thai private limited company, BOI-promoted if you want 100% foreign ownership.',
    steps: [
      'Decide between a BOI-promoted company (100% foreign) and a standard Thai company (49%).',
      'Pick an accountant before you register: they will file every month from day one.',
      'Reserve the name and register with the Department of Business Development.',
      'Open a corporate bank account (banks usually ask for the director’s work permit).',
      'Register for VAT once you approach THB 1.8 million of yearly revenue.',
    ],
    sections: [
      { href: '#structure', label: 'Company structures' },
      { href: '#budget', label: 'First-year budget' },
      { href: '#checklist', label: 'Setup checklist' },
    ],
  },
  {
    id: 'grow',
    label: 'Hiring and raising',
    who: 'You already operate in Thailand and want to build a team or raise money.',
    visa: 'Work permits for foreign hires; the V.I.E programme for young French talent, run by Business France.',
    structure: 'Your Thai company, possibly with a holding abroad for investors.',
    steps: [
      'Write employment contracts in Thai and English; follow the Labour Protection Act.',
      'Register every employee with the Social Security Office (5% each side, capped).',
      'Publish a PDPA privacy notice and decide who handles personal data requests.',
      'Meet Thai corporate venture arms and VCs; ask us for introductions.',
      'Follow the draft Startup Promotion Act: it would allow convertible notes and simpler fundraising.',
    ],
    sections: [
      { href: '#people', label: 'Hiring' },
      { href: '#money', label: 'Banking and funding' },
    ],
  },
];

/* ----------------------------------------------------------------------------------- visas */

export interface Visa {
  name: string;
  forWho: string;
  facts: string[];
  thaiWork: string;
  sources: SourceKey[];
}

export const VISAS: Visa[] = [
  {
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
  {
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
  {
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
  {
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
];

/* ---------------------------------------------------------------------------- structures */

export interface Structure {
  name: string;
  ownership: string;
  goodFor: string;
  watch: string;
  sources: SourceKey[];
}

export const STRUCTURES: Structure[] = [
  {
    name: 'BOI-promoted Thai company',
    ownership: 'Up to 100% foreign',
    goodFor:
      'Software, digital platforms and other promoted activities. Waives the capital and Thai-staff ratio for work permits; software development can get a capped 8-year corporate tax exemption.',
    watch:
      'Approval takes about 3 to 6 months. Software projects must spend at least THB 1.5 million a year on Thai IT salaries and start within 12 months.',
    sources: ['starterKit', 'boiSoftware', 'boi'],
  },
  {
    name: 'Standard Thai private limited company',
    ownership: 'Foreigners up to 49% in most service activities',
    goodFor:
      'Businesses with a genuine Thai co-founder or partner. Registration takes about 1 to 2 weeks; at least 2 shareholders.',
    watch:
      'Thai shareholders must be real investors: nominee arrangements are a criminal offence under the Foreign Business Act (up to 3 years in prison and THB 1 million fine).',
    sources: ['starterKit', 'fba', 'dbd'],
  },
  {
    name: 'Foreign Business License',
    ownership: 'Majority foreign, case by case',
    goodFor: 'Services outside the BOI list when you need control without promotion.',
    watch: 'Discretionary, slow and capital-heavy. Ask a lawyer whether BOI is possible first.',
    sources: ['fba'],
  },
  {
    name: 'Stay abroad: contractors or an employer of record',
    ownership: 'Your existing company',
    goodFor: 'Testing the market or hiring one or two people before you incorporate.',
    watch:
      'A team working for you in Thailand can create a taxable presence. Get advice before it grows.',
    sources: ['treaty'],
  },
];

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

/* ----------------------------------------------------------------------- budget estimator */

/** Figures the estimator uses, in THB (Thailand Starter Kit, 2026). Shown next to the tool. */
export const BUDGET = {
  registration: [30_000, 50_000],
  accounting: [51_000, 146_000],
  office: [60_000, 120_000],
  capitalPerPermit: 2_000_000,
  thaiStaffPerPermit: 4,
  boiMinCapital: 1_000_000,
  standardMinCapital: 2_000_000,
  ssoCap: 875,
  defaultSalary: 30_000,
} as const;

/* ------------------------------------------------------------------------------ checklist */

export interface ChecklistPhase {
  title: string;
  items: string[];
}

export const CHECKLIST: ChecklistPhase[] = [
  {
    title: 'Before you land',
    items: [
      'Choose your visa (DTV, SMART S, Non-B) and gather the bank statements it needs',
      'Register your trademark with the Department of Intellectual Property',
      'Decide BOI or standard company, and ask a lawyer to confirm your activity is allowed',
      'Keep French health cover (CFE or international insurance)',
      'Talk to Business France and the Franco-Thai Chamber of Commerce',
    ],
  },
  {
    title: 'First month',
    items: [
      'Register on the Registre des Français établis hors de France',
      'Get a Thai SIM and install LINE: most Thai business runs on it',
      'Make sure your landlord files your TM.30 address notification',
      'Choose an accountant and register the company with the DBD',
      'Get the company tax ID and the director’s work permit (or SMART visa)',
      'Open the corporate bank account and set up PromptPay',
    ],
  },
  {
    title: 'First quarter',
    items: [
      'File monthly withholding tax returns (PND.1, PND.3, PND.53) with your accountant',
      'Register staff with the Social Security Office within 30 days of hiring',
      'Publish a PDPA privacy notice on your website and app',
      'Register for VAT when you approach THB 1.8 million of yearly revenue',
      'Put Thai and English contracts in place for staff and clients',
      'Come to a French Tech Connect and list your company in our Ecosystem directory',
    ],
  },
  {
    title: 'Every year',
    items: [
      'Have the accounts audited by a Thai licensed auditor',
      'Hold the annual general meeting within 4 months of year end',
      'File the corporate tax return (PND.50) within 150 days of year end',
      'Renew visas and work permits, and file any SMART or LTR annual report',
      'Check BOI conditions are still met (Thai IT salaries, reporting)',
    ],
  },
];

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

/* ---------------------------------------------------------------------------------- FAQ */

export const FAQ: { q: string; a: string }[] = [
  {
    q: 'Can I own 100% of my Thai company?',
    a: 'Yes if your activity is promoted by the BOI (most software and digital platforms are) or you get a Foreign Business License. Otherwise foreigners hold up to 49% in most service activities.',
  },
  {
    q: 'Can I work on a tourist visa or visa exemption while I explore?',
    a: 'You can attend meetings and events. Doing paid work in Thailand, even for your own company, needs a work permit or a visa that covers it (SMART S, LTR).',
  },
  {
    q: 'Do I need a Thai partner?',
    a: 'Only for a standard company in a restricted sector, where Thais must hold 51%. They must be genuine investors: nominee shareholders are illegal.',
  },
  {
    q: 'How long does it take to set up?',
    a: 'About 1 to 2 weeks for a standard company, 3 to 6 months with BOI promotion, and 1 to 3 months for a SMART visa.',
  },
  {
    q: 'Can I open a bank account before my work permit?',
    a: 'Major banks usually ask for a long-term visa and work permit for the director before opening a corporate account. Ask your accountant which branch works with new companies.',
  },
  {
    q: 'Where do I pay income tax, France or Thailand?',
    a: 'It depends on where you are tax resident and where the income comes from. The France-Thailand treaty avoids double taxation, but get advice in both countries before you move.',
  },
];

/** Sources listed at the bottom of the page, in reading order. */
export const SOURCE_LIST: Source[] = Object.values(SOURCES);
