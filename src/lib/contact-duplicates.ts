import { companyKey, isActiveMember, type Contact } from './contacts';

/**
 * Possible duplicates in Contacts: people who look like the same person under two keys (another
 * email, a walk-in typed differently). Nothing is merged here; the admin reviews each group and
 * merges it on the merge page, or marks it "not the same person".
 */

export const DUPLICATE_REASONS = {
  name: 'Same name',
  email: 'Same email before the @',
  phone: 'Same phone',
  linkedin: 'Same LinkedIn',
  firstNameCompany: 'Same first name and company',
} as const;
export type DuplicateReason = keyof typeof DUPLICATE_REASONS;

export interface DuplicateGroup {
  /** Suggested main contact first, then the others. */
  contacts: Contact[];
  reasons: DuplicateReason[];
}

/** A name for matching: lowercase, no accents or punctuation, words sorted ("Dupont Jean" = "Jean Dupont"). */
export const nameKey = (name: string | null | undefined) =>
  (name ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9฀-๿]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ');

const firstName = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9฀-๿]+/)
    .find(Boolean) ?? '';

/** Shared mailboxes say nothing about who the person is. */
const GENERIC_LOCAL = new Set([
  'admin',
  'contact',
  'hello',
  'info',
  'mail',
  'office',
  'sales',
  'support',
  'team',
  'bonjour',
  'marketing',
  'hr',
  'noreply',
]);

/** The part before the @, without dots or +tag, when it is specific enough to point to one person. */
export const emailLocalKey = (email: string | null | undefined) => {
  const local = (email ?? '').toLowerCase().split('@')[0]!.split('+')[0]!.replace(/\./g, '');
  return local.length >= 5 && !GENERIC_LOCAL.has(local) ? local : '';
};

/** The last 9 digits of a phone number, so +66 81 234 5678 and 081-234-5678 match. */
export const phoneKey = (phone: string | null | undefined) => {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.length >= 8 ? digits.slice(-9) : '';
};

/** The profile name in a LinkedIn URL (linkedin.com/in/<this>). */
export const linkedinKey = (url: string | null | undefined) =>
  /linkedin\.com\/in\/([^/?#\s]+)/i.exec(url ?? '')?.[1]?.toLowerCase() ?? '';

/** The order in which to suggest the main contact: active member, saved card, came most, has an email. */
const mainFirst = (a: Contact, b: Contact) =>
  Number(isActiveMember(b)) - Number(isActiveMember(a)) ||
  Number(!!b.email) - Number(!!a.email) ||
  Number(!!b.savedId) - Number(!!a.savedId) ||
  b.attended - a.attended ||
  b.registrations - a.registrations ||
  (b.lastEvent?.startsAt.getTime() ?? 0) - (a.lastEvent?.startsAt.getTime() ?? 0);

/** The key of a pair of contacts, the same in either order (for "not the same person"). */
export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Groups contacts that share a name, a phone, a LinkedIn profile, the part before the @ of an
 * email, or a first name and company. Pairs in `dismissed` (see pairKey) are never linked. Groups
 * come with the suggested main contact first, the biggest and surest groups at the top.
 */
export function findDuplicates(
  all: Contact[],
  dismissed: ReadonlySet<string> = new Set(),
): DuplicateGroup[] {
  const parent = all.map((_, i) => i);
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i]!)));
  const reasons = new Map<string, Set<DuplicateReason>>(); // pairKey -> why

  const index = (reason: DuplicateReason, keysOf: (c: Contact) => string[]) => {
    const seen = new Map<string, number[]>();
    all.forEach((c, i) => {
      for (const k of new Set(keysOf(c).filter(Boolean))) seen.set(k, [...(seen.get(k) ?? []), i]);
    });
    for (const ids of seen.values()) {
      // A very common value (a shared office phone, "John Smith") is not a person.
      if (ids.length < 2 || ids.length > 6) continue;
      for (let x = 0; x < ids.length; x++)
        for (let y = x + 1; y < ids.length; y++) {
          const [a, b] = [all[ids[x]!]!, all[ids[y]!]!];
          const pair = pairKey(a.key, b.key);
          if (dismissed.has(pair)) continue;
          reasons.set(pair, (reasons.get(pair) ?? new Set()).add(reason));
          parent[root(ids[x]!)] = root(ids[y]!);
        }
    }
  };

  index('name', (c) => [nameKey(c.name).includes(' ') ? nameKey(c.name) : '']);
  index('email', (c) => [c.email, ...c.otherEmails].map(emailLocalKey));
  index('phone', (c) => [phoneKey(c.phone)]);
  index('linkedin', (c) => [linkedinKey(c.linkedin)]);
  index('firstNameCompany', (c) => {
    const company = companyKey(c.company);
    const first = firstName(c.name);
    return [company && first.length >= 2 ? `${first}@${company}` : ''];
  });

  const groups = new Map<number, Contact[]>();
  all.forEach((c, i) => groups.set(root(i), [...(groups.get(root(i)) ?? []), c]));
  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g): DuplicateGroup => {
      const contacts = [...g].sort(mainFirst);
      const why = new Set<DuplicateReason>();
      for (let x = 0; x < contacts.length; x++)
        for (let y = x + 1; y < contacts.length; y++)
          for (const r of reasons.get(pairKey(contacts[x]!.key, contacts[y]!.key)) ?? [])
            why.add(r);
      const order = Object.keys(DUPLICATE_REASONS) as DuplicateReason[];
      return { contacts, reasons: order.filter((r) => why.has(r)) };
    })
    .sort(
      (a, b) =>
        b.reasons.length - a.reasons.length ||
        b.contacts.reduce((n, c) => n + c.attended, 0) -
          a.contacts.reduce((n, c) => n + c.attended, 0) ||
        a.contacts[0]!.name.localeCompare(b.contacts[0]!.name),
    );
}
