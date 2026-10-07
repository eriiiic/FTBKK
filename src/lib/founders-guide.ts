// The Founder's Guide (/founders-guide): practical notes for founders starting or growing a
// startup in Thailand. Visas, taxes, tips and helpers are shared with the expansion guide
// (lib/thailand-guides.ts).

import type { ChecklistPhase, SourceKey } from './thailand-guides';

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
    label: 'Testing your idea',
    who: 'You have a startup idea or an early product and want to know if Thailand is the right market.',
    visa: 'Visa exemption or a business visit. Meetings are fine; doing paid work in Thailand is not.',
    structure: 'No Thai company yet. Keep invoicing from where you are based today.',
    steps: [
      'Come to a French Tech Connect evening to meet founders who did it before you.',
      'Talk to 10 potential customers before you talk to a lawyer.',
      'Check whether your activity can get BOI promotion: it decides if you can own 100%.',
      'File your trademark in Thailand early: it is first-to-file.',
      'Ask NIA and depa which startup programmes are open to foreign founders.',
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
    name: 'Stay abroad: contractors or an employer of record',
    ownership: 'Your existing company',
    goodFor: 'Testing the market or hiring one or two people before you incorporate.',
    watch:
      'A team working for you in Thailand can create a taxable presence. Get advice before it grows.',
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

/** Sources listed under the FAQ that the visa, structure and tax cards do not already cite. */
export const EXTRA_SOURCES: SourceKey[] = [
  'pdpa',
  'pdpc',
  'startupAct',
  'nia',
  'depa',
  'dip',
  'businessFrance',
  'vie',
  'ftcc',
  'tresor',
  'bpifrance',
  'cfe',
  'registre',
];
