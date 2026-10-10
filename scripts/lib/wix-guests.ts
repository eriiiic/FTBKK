// Parses a Wix Events guest list export ("Guest_list_<event>_<date>.csv") into one guest per
// email. Wix exports it as UTF-16, tab-separated. Ticketed events have one row per ticket, often
// twice (numbers ending in 1P and 1Q); RSVP events have one row per answer, with repeat RSVPs.
// The registration questions are event-specific columns, so they are found by keyword.

export interface WixGuest {
  name: string;
  email: string;
  company: string | null;
  role: string | null;
  linkedin: string | null;
  notes: string | null;
  checkedIn: boolean;
  /** Wix order date (site time zone, Bangkok) as a unix timestamp. */
  orderedAt: number;
}

// Shared with the admin's CSV import of registrants.
import { parseDelimited } from '../../src/lib/csv';
export { decodeGuestFile, parseDelimited } from '../../src/lib/csv';

/**
 * A LinkedIn profile URL, or null when the answer isn't one (people sometimes type their name).
 * Mistyped links ("https/LinkedIn.com/in/x", "linkedin/in/x", "/in/x") are rebuilt.
 */
export function linkedinUrl(v: string): string | null {
  const m = v
    .replace(/\s+/g, '')
    .match(/(?:^|([a-z]{2,3}\.)?linkedin(?:\.com)?)\/((?:in|pub|company)\/[^/?#][^?#]*)/i);
  // Share-link tracking (?utm_source=…, ?locale=fr) is left out.
  return m ? `https://${(m[1] ?? 'www.').toLowerCase()}linkedin.com/${m[2]}` : null;
}

/** "octave despointes" -> "Octave Despointes"; names typed with capitals are kept as typed. */
export function tidyName(v: string): string {
  return v === v.toLowerCase() ? v.replace(/(^|[\s'-])\p{L}/gu, (c) => c.toUpperCase()) : v;
}

/** "2026-06-28 18:22:39" in Bangkok time -> unix seconds. */
export function bangkokTimestamp(v: string): number | null {
  const m = v.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)$/);
  if (!m) return null;
  const t = Date.parse(`${m[1]}T${m[2].length === 5 ? `${m[2]}:00` : m[2]}+07:00`);
  return Number.isNaN(t) ? null : Math.floor(t / 1000);
}

const clean = (v: string | undefined) => v?.replace(/\s+/g, ' ').trim() || null;
/** Placeholder answers people type to get past a required question ("-", "NA", "nope"). */
const answer = (v: string | undefined) => {
  const s = clean(v);
  return s && !/^['"]?(-+|\.+|n\/?a|none|no|nope|nothing|ok|not yet)['".!]*$/i.test(s) ? s : null;
};
/** Profile choices start with an emoji ("🚀 Startup Founder"). */
const unEmoji = (v: string | null) => v?.replace(/^[^\p{L}\p{N}]+/u, '') || null;

export function parseWixGuests(text: string): WixGuest[] {
  const [header, ...rows] = parseDelimited(text);
  if (!header) return [];
  const h = header.map((c) => c.trim().toLowerCase());
  const col = (test: (c: string) => boolean) => h.findIndex(test);
  const idx = {
    first: col((c) => c === 'guest first name' || c === 'first name'),
    last: col((c) => c === 'guest last name' || c === 'last name'),
    email: col((c) => c === 'email'),
    date: col((c) => c === 'order date' || c === 'timestamp'),
    checkedIn: col((c) => c === 'checked in' || c === 'checked-in'),
    response: col((c) => c === 'response'),
    company: col((c) => c.includes('company')),
    role: col((c) => c.includes('job title') || c === 'position'),
    // RSVP forms ask for a profile ("Founder / Co-founder") instead of a job title.
    profile: col((c) => c.includes('best describes you')),
    linkedin: col((c) => c.includes('linkedin')),
    notes: col((c) => c.startsWith('anything') || c.includes('additional information')),
    // Bilingual forms repeat the question in French.
    notesFr: col((c) => c.startsWith('souhaitez-vous partager')),
    comment: col((c) => c.includes('add a comment')),
  };
  if (idx.email < 0 || idx.first < 0) throw new Error('Not a Wix guest list: no Email column');

  const byEmail = new Map<string, WixGuest>();
  for (const r of rows) {
    const get = (i: number) => (i >= 0 ? r[i] : undefined);
    const email = clean(get(idx.email))?.toLowerCase();
    if (!email || !email.includes('@')) continue;
    // RSVP "No" answers are people who said they won't come.
    if (/^no$/i.test(get(idx.response)?.trim() ?? '')) continue;
    const name = [clean(get(idx.first)), clean(get(idx.last))].filter(Boolean).join(' ');
    const guest: WixGuest = {
      name: tidyName(name) || email,
      email,
      company: answer(get(idx.company)),
      role: answer(get(idx.role)) ?? unEmoji(answer(get(idx.profile))),
      linkedin: linkedinUrl(get(idx.linkedin) ?? ''),
      notes:
        [answer(get(idx.notes)), answer(get(idx.notesFr)), answer(get(idx.comment))]
          .filter(Boolean)
          .join('\n') || null,
      // RSVP exports count the people checked in (2 = the guest and a +1).
      checkedIn: /^(yes|true|checked in|[1-9]\d*)$/i.test(get(idx.checkedIn)?.trim() ?? ''),
      orderedAt: bangkokTimestamp(get(idx.date) ?? '') ?? Math.floor(Date.now() / 1000),
    };
    const prev = byEmail.get(email);
    if (!prev) {
      byEmail.set(email, guest);
      continue;
    }
    // Same person again (duplicate ticket row or a second order): keep the first order date and
    // fill in anything the earlier row left empty.
    byEmail.set(email, {
      name: prev.name,
      email,
      company: prev.company ?? guest.company,
      role: prev.role ?? guest.role,
      linkedin: prev.linkedin ?? guest.linkedin,
      notes: prev.notes ?? guest.notes,
      checkedIn: prev.checkedIn || guest.checkedIn,
      orderedAt: Math.min(prev.orderedAt, guest.orderedAt),
    });
  }
  return [...byEmail.values()];
}
