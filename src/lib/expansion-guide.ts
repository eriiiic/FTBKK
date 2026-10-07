// Expanding to Thailand (/expand-to-thailand): practical notes for established tech companies, for
// example from France, opening an office or a business in Thailand. Visas, taxes, tips and
// helpers are shared with the Founder's Guide (lib/thailand-guides.ts). Content stays in code on
// purpose (no admin editor).

import type { ChecklistPhase, SourceKey, TaxRow } from './thailand-guides';

/* ----------------------------------------------------------------------------- why Thailand */

export const STATS: { value: string; label: string; sources: SourceKey[] }[] = [
  { value: '65.4M', label: 'internet users, 92% of the population', sources: ['selling'] },
  { value: '52M', label: 'social media users', sources: ['selling'] },
  {
    value: '96%+',
    label: 'of social media users are on Facebook, YouTube and LINE',
    sources: ['selling'],
  },
  {
    value: '100%',
    label: 'foreign ownership possible for BOI-promoted activities',
    sources: ['boi', 'fba'],
  },
];

/* ----------------------------------------------------------------------------- entry models */

export type ModelId = 'abroad' | 'distributor' | 'rep' | 'branch' | 'boi' | 'partner' | 'ibc';

export interface EntryModel {
  id: ModelId;
  name: string;
  tagline: string;
  invoice: string;
  ownership: string;
  capital: string;
  setup: string;
  goodFor: string;
  watch: string;
  sources: SourceKey[];
}

export const MODELS: EntryModel[] = [
  {
    id: 'abroad',
    name: 'Sell from your home company',
    tagline: 'No Thai entity yet',
    invoice: 'From abroad',
    ownership: 'Your existing company',
    capital: 'None',
    setup: 'Now',
    goodFor: 'First deals, software sold online and testing demand before you commit capital.',
    watch:
      'Thai clients may withhold tax on fees paid abroad. Staff or an agent signing deals in Thailand can make you taxable there (permanent establishment).',
    sources: ['treaty', 'rd'],
  },
  {
    id: 'distributor',
    name: 'Distributor or reseller',
    tagline: 'A Thai partner sells for you',
    invoice: 'Through the partner',
    ownership: 'The partner’s company',
    capital: 'None',
    setup: 'Weeks to months',
    goodFor:
      'Hardware, enterprise software that needs local support, and government or corporate buyers who want a Thai supplier.',
    watch:
      'Negotiate territory, exclusivity, targets and exit terms. Your brand depends on their after-sales service.',
    sources: ['selling'],
  },
  {
    id: 'rep',
    name: 'Representative office',
    tagline: 'A team on the ground that does not sell',
    invoice: 'No',
    ownership: '100% of the foreign company',
    capital: 'THB 3M, brought in over 3 years',
    setup: '2 to 3 months',
    goodFor:
      'Market research, promoting the head office’s products, sourcing suppliers and quality control.',
    watch:
      'It cannot sign sales, invoice or earn revenue. The head office pays its costs. It needs a Foreign Business License.',
    sources: ['entities', 'capital'],
  },
  {
    id: 'branch',
    name: 'Branch office',
    tagline: 'Your company, registered in Thailand',
    invoice: 'Yes',
    ownership: '100%, with a Foreign Business License',
    capital: 'THB 3M or 25% of 3 years of costs, whichever is higher',
    setup: '3 to 6 months',
    goodFor:
      'Clients who want to contract with the parent company, and projects where one legal entity is simpler.',
    watch:
      'The head office is liable for the branch’s debts. Profits sent home carry a 10% tax. License approval is discretionary.',
    sources: ['capital', 'entities', 'fba'],
  },
  {
    id: 'boi',
    name: 'BOI-promoted subsidiary',
    tagline: 'A Thai company you own 100%',
    invoice: 'Yes',
    ownership: 'Up to 100% foreign',
    capital: 'From THB 1M, depending on the project',
    setup: '3 to 6 months',
    goodFor:
      'Software, digital services, R&D and other promoted activities. Can bring tax holidays and work permits without the 4 Thai staff rule.',
    watch:
      'Conditions to meet and report on every year, for example THB 1.5M a year of Thai IT salaries for software projects.',
    sources: ['boi', 'boiSoftware', 'starterKit'],
  },
  {
    id: 'partner',
    name: 'Thai company with a Thai partner',
    tagline: 'A joint venture',
    invoice: 'Yes',
    ownership: 'Up to 49% foreign in most services',
    capital: 'THB 2M per foreign work permit',
    setup: '1 to 2 weeks',
    goodFor:
      'A real partner who brings clients, licences or access to government buyers, in activities BOI does not promote.',
    watch:
      'Nominee shareholders are a criminal offence. Write a shareholder agreement covering control, deadlock and exit.',
    sources: ['fba', 'starterKit'],
  },
  {
    id: 'ibc',
    name: 'Regional hub (International Business Center)',
    tagline: 'Run Southeast Asia from Bangkok',
    invoice: 'Yes, mainly to group companies',
    ownership: '100% foreign',
    capital: 'THB 10M',
    setup: '3 to 6 months',
    goodFor:
      'Management, treasury, IT and support services for your companies across the region. Corporate tax from 8% down to 3%, 15% income tax for expats.',
    watch:
      'At least 10 skilled staff and a yearly local spending threshold. Our source dates from 2019: check the scheme’s current terms with the BOI.',
    sources: ['ibc', 'boi'],
  },
];

/* ---------------------------------------------------------------- entry model chooser */

export type QuestionId = 'hub' | 'invoice' | 'team' | 'boi' | 'partner';

export const QUESTIONS: { id: QuestionId; q: string; help: string }[] = [
  {
    id: 'invoice',
    q: 'Do you need to sign and invoice Thai customers from Thailand?',
    help: 'Some buyers, especially government and large corporates, only buy from a Thai entity.',
  },
  {
    id: 'team',
    q: 'Will you have staff working in Thailand within a year?',
    help: 'Employees, a country manager or a V.I.E.',
  },
  {
    id: 'boi',
    q: 'Is your activity software, digital or another BOI-promoted activity?',
    help: 'Most software, platforms, data and R&D activities are.',
  },
  {
    id: 'partner',
    q: 'Do you have a Thai partner ready to co-own the company?',
    help: 'A genuine investor, not a nominee.',
  },
  {
    id: 'hub',
    q: 'Will Bangkok manage your companies in other Asian countries?',
    help: 'Regional headquarters, treasury or shared services.',
  },
];

export type Answers = Partial<Record<QuestionId, boolean>>;

export interface Suggestion {
  id: ModelId;
  why: string;
  also: { id: ModelId; why: string }[];
}

/** The entry model to look at first for a set of yes/no answers (unanswered counts as no). */
export function suggestModel(a: Answers): Suggestion {
  if (a.hub) {
    return {
      id: 'ibc',
      why: 'You will run regional operations from Bangkok.',
      also: [{ id: 'boi', why: 'if the Thai business itself sells software or services.' }],
    };
  }
  if (!a.invoice) {
    return a.team
      ? {
          id: 'rep',
          why: 'Your team will research and promote, while sales stay with the head office.',
          also: [
            { id: 'abroad', why: 'to keep selling to Thai clients meanwhile.' },
            { id: 'boi', why: 'once you need to invoice locally.' },
          ],
        }
      : {
          id: 'abroad',
          why: 'You do not need a Thai entity yet.',
          also: [{ id: 'distributor', why: 'if buyers want a local supplier and support.' }],
        };
  }
  if (a.boi) {
    return {
      id: 'boi',
      why: 'BOI promotion gives 100% ownership and lighter work permit rules.',
      also: [{ id: 'branch', why: 'if clients must contract with your parent company.' }],
    };
  }
  if (a.partner) {
    return {
      id: 'partner',
      why: 'Your partner can hold the Thai majority in a standard company.',
      also: [{ id: 'branch', why: 'to stay 100% owned instead.' }],
    };
  }
  return {
    id: 'branch',
    why: 'You need to invoice locally, without BOI promotion or a Thai partner.',
    also: [{ id: 'distributor', why: 'to start selling while the license is processed.' }],
  };
}

/* -------------------------------------------------------------------------------- roadmap */

export const ROADMAP: { title: string; when: string; goal: string; steps: string[] }[] = [
  {
    title: 'Test',
    when: 'Months 0 to 6',
    goal: 'Prove there is demand before you commit capital.',
    steps: [
      'Order a market study or B2B meetings from Business France.',
      'Come for meetings on a visa exemption or business visit (no paid work).',
      'Win the first clients from home or through a distributor.',
      'File your trademark in Thailand: it is first-to-file.',
      'Meet companies who did it at French Tech and Franco-Thai Chamber events.',
    ],
  },
  {
    title: 'Establish',
    when: 'Months 6 to 12',
    goal: 'Choose the entity and put your first person on the ground.',
    steps: [
      'Pick the entry model with a Thai lawyer and your group tax adviser.',
      'Apply for BOI promotion or a Foreign Business License if you need one.',
      'Register the entity, open the bank account and bring in the capital.',
      'Send your first manager with a work permit or an LTR visa.',
      'Translate your sales material into Thai and open a LINE Official Account.',
    ],
  },
  {
    title: 'Scale',
    when: 'Month 12 onwards',
    goal: 'Build a Thai team and look at the region.',
    steps: [
      'Hire Thai staff and register them with Social Security.',
      'Bring in young French talent through the V.I.E programme.',
      'Document transfer pricing between the Thai entity and the group.',
      'Review your entity: a branch can become a subsidiary, a hub can serve ASEAN.',
    ],
  },
];

/* ------------------------------------------------------------------------- go-to-market */

export const SELLING: { title: string; body: string; sources: SourceKey[] }[] = [
  {
    title: 'Local partners open doors',
    body: 'Agents and distributors carry relationships you cannot build quickly, especially with government buyers.',
    sources: ['selling'],
  },
  {
    title: 'Speak Thai',
    body: 'Translate the website, brochures, manuals and contracts. English alone limits you to a small part of the market.',
    sources: ['selling'],
  },
  {
    title: 'After-sales support decides',
    body: 'Buyers ask who will support them locally. Plan Thai-speaking support before you sign the first big client.',
    sources: ['selling'],
  },
  {
    title: 'Price-conscious and competitive',
    body: 'Expect Asian and local competitors on price. Lead with references, service and total cost.',
    sources: ['selling'],
  },
  {
    title: 'Social first',
    body: 'Facebook, YouTube and LINE reach almost every social media user. B2B buyers use them too.',
    sources: ['selling'],
  },
  {
    title: 'Use the French label',
    body: 'French Tech, Business France pavilions and Franco-Thai Chamber events give you a warm first meeting.',
    sources: ['businessFrance', 'ftcc'],
  },
];

/* ---------------------------------------------------------------------------- extra taxes */

export const GROUP_TAXES: TaxRow[] = [
  {
    label: 'Profits sent home by a branch',
    value: '10%',
    note: 'Tax on profits a branch remits to its head office, on top of corporate tax.',
    sources: ['entities'],
  },
  {
    label: 'Dividends to a foreign parent',
    value: '10% withholding',
    note: 'Deducted by the Thai subsidiary when it pays dividends abroad. Check the treaty rate with your adviser.',
    sources: ['rd', 'treaty'],
  },
  {
    label: 'Fees and royalties paid abroad',
    value: '15% withholding',
    note: 'Thai payers usually deduct it on service fees and royalties paid to foreign companies; the treaty can reduce or remove it.',
    sources: ['rd', 'treaty'],
  },
  {
    label: 'Transfer pricing',
    value: 'Documentation',
    note: 'Prices between the Thai entity and the group must be at arm’s length. Larger companies file a disclosure form every year.',
    sources: ['rd'],
  },
  {
    label: 'Regional hub (IBC)',
    value: '3% to 8%',
    note: 'Corporate tax for an International Business Center, depending on local spending; 15% income tax for its expat staff.',
    sources: ['ibc'],
  },
];

/* ------------------------------------------------------------------------------ checklist */

export const CHECKLIST: ChecklistPhase[] = [
  {
    title: 'Before you decide',
    items: [
      'Validate demand with a market study or B2B meetings (Business France)',
      'Check whether your activity is restricted under the Foreign Business Act',
      'Check whether your activity can be promoted by the BOI',
      'Register your trademark with the Department of Intellectual Property',
      'Ask your accountant about withholding tax on cross-border invoices',
      'Talk to two or three companies who expanded before you',
    ],
  },
  {
    title: 'Setting up',
    items: [
      'Choose the entry model with a Thai lawyer and your group tax adviser',
      'File the BOI application or Foreign Business License if needed',
      'Register the entity with the Department of Business Development',
      'Open the corporate bank account',
      'Bring in the capital through a Thai bank and keep the remittance certificate',
      'Appoint a local accountant and register for VAT if you will invoice',
    ],
  },
  {
    title: 'Your first people',
    items: [
      'Get the first manager’s visa and work permit (Non-B or LTR)',
      'Write employment contracts in Thai and English',
      'Register staff with the Social Security Office within 30 days',
      'Look at a V.I.E for a young French profile',
      'Plan relocation: housing, schools, health insurance and the TM.30 address report',
    ],
  },
  {
    title: 'Running the business',
    items: [
      'File monthly withholding tax and VAT returns with your accountant',
      'Publish a PDPA privacy notice and cover data transfers to the group',
      'Keep transfer pricing documentation for group transactions',
      'Audit the accounts, hold the AGM and file the PND.50 every year',
      'Renew work permits and send any BOI or license reports',
      'List your company in our Ecosystem directory',
    ],
  },
];

/* ---------------------------------------------------------------------------------- FAQ */

export const FAQ: { q: string; a: string }[] = [
  {
    q: 'Can we keep invoicing Thai clients from France?',
    a: 'Yes. Thai clients may withhold tax on what they pay you, and people working or signing deals for you in Thailand can make your company taxable there. Check both points with your accountant before you put a team on the ground.',
  },
  {
    q: 'Do we need a Thai partner?',
    a: 'No if your activity is BOI-promoted or you get a Foreign Business License (for a branch, representative office or subsidiary). Otherwise foreigners can hold up to 49% of a company in most service activities.',
  },
  {
    q: 'Can we hire before we have an entity?',
    a: 'An employer of record can employ Thai staff for you. It is a good test, but a team working for you in Thailand can still create a taxable presence.',
  },
  {
    q: 'How do we send our first manager?',
    a: 'The Thai entity sponsors a Non-B visa and work permit. If the manager earns USD 80,000 a year or more and your activity is targeted, the LTR Highly-Skilled Professional visa adds a 17% flat tax and a 10-year stay.',
  },
  {
    q: 'How long before we can operate?',
    a: 'Weeks with a distributor, 1 to 2 weeks for a standard Thai company, and about 3 to 6 months when you need BOI promotion or a Foreign Business License.',
  },
  {
    q: 'What can a representative office do?',
    a: 'Research the market, promote the head office’s products, source suppliers and check quality. It cannot sell, invoice or earn any revenue in Thailand.',
  },
  {
    q: 'Can we send Thai customer data to our servers in France?',
    a: 'Thailand’s PDPA allows transfers abroad with safeguards such as contract clauses or group rules. It is close to the GDPR, and fines are now being imposed.',
  },
];

/** Sources listed under the expansion guide's FAQ that its cards do not already cite. */
export const EXTRA_SOURCES: SourceKey[] = ['pdpa', 'pdpc', 'businessFrance', 'ftcc', 'vie', 'dip'];
