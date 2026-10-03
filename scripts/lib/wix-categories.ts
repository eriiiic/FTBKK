import type { Category, Sector } from '../../src/lib/directory';

/** Map a Wix sponsor category (e.g. "Hospitality & Hotels") to a directory category. */
export function mapWixCategory(wix: string): Category {
  const s = wix.toLowerCase();
  if (/invest|venture|capital|fund|\bvc\b|angel/.test(s)) return 'investor';
  if (/cowork|incubat|accelerat/.test(s)) return 'incubator_coworking';
  if (/school|universit|education|academ|training/.test(s)) return 'school';
  if (/chamber|embassy|government|institution|business france|treasury/.test(s))
    return 'institution';
  if (/startup|start-up/.test(s)) return 'french_startup';
  if (
    /law|legal|account|consult|agency|insurance|bank|recruit|hr\b|real estate|visa|relocation|marketing|service/.test(
      s,
    )
  )
    return 'service_provider';
  return 'french_company';
}

const SECTOR_RULES: [RegExp, Sector][] = [
  [/\bai\b|artificial intelligence|machine learning|data/i, 'AI'],
  [/fintech|payment|bank|finance|insurance/i, 'Fintech'],
  [/e-?commerce|retail|marketplace/i, 'E-commerce'],
  [/hotel|hospitality|travel|tourism|restaurant/i, 'Travel and hospitality'],
  [/mobility|automotive|transport|logistic|tyre|tire/i, 'Mobility'],
  [/health|medical|pharma|wellness/i, 'Health'],
  [/climate|energy|solar|sustainab|green/i, 'Climate and energy'],
  [/agri|food|beverage|wine/i, 'Agritech and food'],
  [/industr|manufactur|engineering/i, 'Industry'],
  [/media|gaming|game|entertainment|advertis/i, 'Media and gaming'],
  [/cyber|security/i, 'Cybersecurity'],
  [/saas|software|platform|cloud/i, 'SaaS'],
];

export function sectorsFor(text: string): Sector[] {
  return [...new Set(SECTOR_RULES.filter(([re]) => re.test(text)).map(([, s]) => s))].slice(0, 3);
}
