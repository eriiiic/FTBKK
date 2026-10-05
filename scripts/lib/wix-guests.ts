// Parses a Wix Events guest list export ("Guest_list_<event>_<date>.csv") into one guest per
// email. Wix exports it as UTF-16, tab-separated, one row per ticket, and often lists the same
// ticket twice (numbers ending in 1P and 1Q). The registration questions are event-specific
// columns, so they are found by keyword.

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

/** Decodes the file whatever its encoding (Wix uses UTF-16 LE with a BOM). */
export function decodeGuestFile(buf: Uint8Array): string {
  if (buf[0] === 0xff && buf[1] === 0xfe)
    return new TextDecoder('utf-16le').decode(buf.subarray(2));
  if (buf[0] === 0xfe && buf[1] === 0xff)
    return new TextDecoder('utf-16be').decode(buf.subarray(2));
  return new TextDecoder('utf-8').decode(buf).replace(/^﻿/, '');
}

/** Splits CSV/TSV text, honouring double quotes (fields may contain line breaks). */
export function parseDelimited(text: string): string[][] {
  const firstLine = text.slice(0, text.indexOf('\n') >>> 0);
  const sep = firstLine.includes('\t') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const endRow = () => {
    row.push(field);
    if (row.some((f) => f.trim())) rows.push(row);
    row = [];
    field = '';
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === sep) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      endRow();
    } else field += c;
  }
  endRow();
  return rows;
}

/** A LinkedIn profile URL, or null when the answer isn't one (people sometimes type their name). */
export function linkedinUrl(v: string): string | null {
  const s = v.trim();
  if (!/linkedin\.com\//i.test(s)) return null;
  const url = /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, '')}`;
  // Drop share-link tracking (?utm_source=…, ?locale=fr).
  return url.replace(/[?#].*$/, '');
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

export function parseWixGuests(text: string): WixGuest[] {
  const [header, ...rows] = parseDelimited(text);
  if (!header) return [];
  const h = header.map((c) => c.trim().toLowerCase());
  const col = (test: (c: string) => boolean) => h.findIndex(test);
  const idx = {
    first: col((c) => c === 'guest first name'),
    last: col((c) => c === 'guest last name'),
    email: col((c) => c === 'email'),
    date: col((c) => c === 'order date'),
    checkedIn: col((c) => c === 'checked in'),
    company: col((c) => c.includes('company')),
    role: col((c) => c.includes('job title') || c === 'position'),
    linkedin: col((c) => c.includes('linkedin')),
    notes: col((c) => c.startsWith('anything')),
  };
  if (idx.email < 0 || idx.first < 0) throw new Error('Not a Wix guest list: no Email column');

  const byEmail = new Map<string, WixGuest>();
  for (const r of rows) {
    const get = (i: number) => (i >= 0 ? r[i] : undefined);
    const email = clean(get(idx.email))?.toLowerCase();
    if (!email || !email.includes('@')) continue;
    const name = [clean(get(idx.first)), clean(get(idx.last))].filter(Boolean).join(' ');
    const guest: WixGuest = {
      name: tidyName(name) || email,
      email,
      company: clean(get(idx.company)),
      role: clean(get(idx.role)),
      linkedin: linkedinUrl(get(idx.linkedin) ?? ''),
      notes: clean(get(idx.notes)),
      checkedIn: /^(yes|true|checked in)$/i.test(get(idx.checkedIn)?.trim() ?? ''),
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
