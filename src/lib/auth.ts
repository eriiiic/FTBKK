import { env } from 'cloudflare:workers';

/**
 * Cloudflare Access protects /admin and /api/admin at the edge. The Worker also verifies the
 * Access JWT so a misconfigured Access policy can never expose the admin.
 * Locally (ACCESS_AUD empty) DEV_ADMIN_EMAIL from .dev.vars is used instead.
 */
interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
}
let jwksCache: { at: number; keys: Jwk[] } | null = null;

function b64urlToBytes(s: string) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/**
 * ACCESS_TEAM_DOMAIN may list several comma-separated domains: a renamed Zero Trust team serves
 * its signing keys under the new name while tokens can still carry the old one as issuer.
 */
export const teamDomains = (value: string) =>
  value
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);

async function getKeys(teamDomain: string) {
  if (jwksCache && Date.now() - jwksCache.at < 3600_000) return jwksCache.keys;
  const keys: Jwk[] = [];
  const failures: string[] = [];
  for (const domain of teamDomains(teamDomain)) {
    const res = await fetch(`https://${domain}/cdn-cgi/access/certs`);
    if (res.ok) keys.push(...((await res.json()) as { keys: Jwk[] }).keys);
    else failures.push(`${domain} ${res.status}`);
  }
  if (!keys.length) throw new Error(`Access certs ${failures.join(', ')}`);
  jwksCache = { at: Date.now(), keys };
  return keys;
}

export type AccessCheck = { email: string } | { reason: string };

/** Verifies a Cloudflare Access JWT, and says why when it is refused. */
export async function checkAccessJwt(
  token: string,
  teamDomain: string,
  aud: string,
): Promise<AccessCheck> {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) return { reason: 'The Access token is malformed.' };
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h))) as {
    kid: string;
    alg: string;
  };
  if (header.alg !== 'RS256') return { reason: `Unexpected token algorithm ${header.alg}.` };
  const jwk = (await getKeys(teamDomain)).find((k) => k.kid === header.kid);
  if (!jwk) {
    return {
      reason: `The token was not signed by ${teamDomain}. Check ACCESS_TEAM_DOMAIN in wrangler.jsonc.`,
    };
  }
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64urlToBytes(s),
    new TextEncoder().encode(`${h}.${p}`),
  );
  if (!ok) return { reason: 'The token signature is invalid.' };
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p))) as {
    aud: string | string[];
    exp: number;
    iss: string;
    email?: string;
  };
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(aud)) {
    // Audience tags are not secret (they sit in wrangler.jsonc), so naming them is safe.
    return {
      reason: `The login belongs to another Access application (audience ${auds.join(', ')}). ACCESS_AUD in wrangler.jsonc is ${aud}.`,
    };
  }
  if (payload.exp * 1000 < Date.now()) return { reason: 'The Access login has expired.' };
  if (!teamDomains(teamDomain).some((d) => payload.iss === `https://${d}`)) {
    return { reason: `The token was issued by ${payload.iss}, not ${teamDomain}.` };
  }
  if (!payload.email) return { reason: 'The Access login carries no email address.' };
  return { email: payload.email };
}

export async function verifyAccessJwt(token: string, teamDomain: string, aud: string) {
  const res = await checkAccessJwt(token, teamDomain, aud);
  return 'email' in res ? res.email : null;
}

/** The admin's email, or why the request is not an authenticated admin. */
export async function checkAdmin(request: Request): Promise<AccessCheck> {
  if (!env.ACCESS_AUD || !env.ACCESS_TEAM_DOMAIN) {
    // Local development only: DEV_ADMIN_EMAIL lives in .dev.vars and is never deployed, and the
    // bypass only answers on localhost so a stray variable can never open the live admin.
    const host = new URL(request.url).hostname;
    const local = host === 'localhost' || host === '127.0.0.1';
    if (local && env.DEV_ADMIN_EMAIL) return { email: env.DEV_ADMIN_EMAIL };
    return { reason: 'ACCESS_AUD or ACCESS_TEAM_DOMAIN is missing from this deployment.' };
  }
  const token =
    request.headers.get('cf-access-jwt-assertion') ??
    request.headers.get('cookie')?.match(/CF_Authorization=([^;]+)/)?.[1];
  if (!token) {
    return {
      reason:
        'No Cloudflare Access login came with this request, so Access is not covering this path.',
    };
  }
  try {
    return await checkAccessJwt(token, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD);
  } catch (e) {
    console.error('[auth]', e);
    return { reason: `The Access check failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Returns the admin's email, or null when the request is not an authenticated admin. */
export async function requireAdmin(request: Request): Promise<string | null> {
  const res = await checkAdmin(request);
  return 'email' in res ? res.email : null;
}
