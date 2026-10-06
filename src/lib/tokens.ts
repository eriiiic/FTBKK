import { env } from 'cloudflare:workers';

export type TokenPurpose =
  'verify' | 'manage' | 'confirm' | 'claim' | 'data' | 'newsletter' | 'member_confirm' | 'member';

const DAY = 86400;
/** Lifetimes in seconds. Confirm links double as reactivation links, so they live a year. */
export const TOKEN_TTL: Record<TokenPurpose, number> = {
  verify: 7 * DAY,
  manage: 30 * 60,
  confirm: 365 * DAY,
  claim: 7 * DAY,
  /** "Delete my data" requests made from the public form, without an event email to hand. */
  data: DAY,
  /** Newsletter sign-up from the Join page (double opt-in). */
  newsletter: 7 * DAY,
  /** Confirms a new membership's email. */
  member_confirm: 7 * DAY,
  /** Opens the member page; reusable until it expires. */
  member: 30 * DAY,
};
/** Confirm links can be used again (yearly confirm, reactivation); the rest are single use. */
export const REUSABLE: Record<TokenPurpose, boolean> = {
  verify: false,
  manage: false,
  confirm: true,
  claim: false,
  data: false,
  newsletter: false,
  member_confirm: false,
  member: true,
};

export function randomToken(bytes = 32) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sha256(s: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Creates a token, stores only its hash, returns the raw token for the email link. */
export async function issueToken(
  purpose: TokenPurpose,
  email: string,
  opts: { orgId?: number | null; refId?: number | null; now?: Date } = {},
  db: D1Database = env.DB,
) {
  const token = randomToken();
  const now = Math.floor((opts.now ?? new Date()).getTime() / 1000);
  await db
    .prepare(
      `INSERT INTO magic_tokens (token_hash, purpose, org_id, ref_id, email, expires_at, reusable, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      await sha256(token),
      purpose,
      opts.orgId ?? null,
      opts.refId ?? null,
      email.toLowerCase(),
      now + TOKEN_TTL[purpose],
      REUSABLE[purpose] ? 1 : 0,
      now,
    )
    .run();
  return token;
}

export interface TokenRow {
  id: number;
  purpose: TokenPurpose;
  org_id: number | null;
  ref_id: number | null;
  email: string;
  expires_at: number;
  used_at: number | null;
  reusable: number;
}

/** Returns the token row if valid for `purpose`, without consuming it. */
export async function peekToken(
  token: string | null | undefined,
  purpose: TokenPurpose,
  now = new Date(),
  db: D1Database = env.DB,
): Promise<TokenRow | null> {
  if (!token || token.length > 100) return null;
  const row = await db
    .prepare('SELECT * FROM magic_tokens WHERE token_hash = ? AND purpose = ?')
    .bind(await sha256(token), purpose)
    .first<TokenRow>();
  if (!row) return null;
  if (!isTokenUsable(row, now)) return null;
  return row;
}

export function isTokenUsable(
  row: Pick<TokenRow, 'expires_at' | 'used_at' | 'reusable'>,
  now: Date,
) {
  if (row.expires_at * 1000 < now.getTime()) return false;
  if (row.used_at && !row.reusable) return false;
  return true;
}

/** Validates and consumes a token atomically (single-use tokens can't be replayed). */
export async function consumeToken(
  token: string | null | undefined,
  purpose: TokenPurpose,
  now = new Date(),
  db: D1Database = env.DB,
): Promise<TokenRow | null> {
  const row = await peekToken(token, purpose, now, db);
  if (!row) return null;
  const ts = Math.floor(now.getTime() / 1000);
  const res = await db
    .prepare(
      'UPDATE magic_tokens SET used_at = ? WHERE id = ? AND (used_at IS NULL OR reusable = 1)',
    )
    .bind(ts, row.id)
    .run();
  return res.meta.changes ? row : null;
}
