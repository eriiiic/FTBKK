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

async function getKeys(teamDomain: string) {
  if (jwksCache && Date.now() - jwksCache.at < 3600_000) return jwksCache.keys;
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`Access certs ${res.status}`);
  const { keys } = (await res.json()) as { keys: Jwk[] };
  jwksCache = { at: Date.now(), keys };
  return keys;
}

export async function verifyAccessJwt(token: string, teamDomain: string, aud: string) {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) return null;
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h))) as {
    kid: string;
    alg: string;
  };
  if (header.alg !== 'RS256') return null;
  const jwk = (await getKeys(teamDomain)).find((k) => k.kid === header.kid);
  if (!jwk) return null;
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
  if (!ok) return null;
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p))) as {
    aud: string | string[];
    exp: number;
    iss: string;
    email?: string;
  };
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(aud)) return null;
  if (payload.exp * 1000 < Date.now()) return null;
  if (payload.iss !== `https://${teamDomain}`) return null;
  return payload.email ?? null;
}

/** Returns the admin's email, or null when the request is not an authenticated admin. */
export async function requireAdmin(request: Request): Promise<string | null> {
  if (!env.ACCESS_AUD || !env.ACCESS_TEAM_DOMAIN) {
    // Local development only: DEV_ADMIN_EMAIL lives in .dev.vars and is never deployed, and the
    // bypass only answers on localhost so a stray variable can never open the live admin.
    const host = new URL(request.url).hostname;
    const local = host === 'localhost' || host === '127.0.0.1';
    return local ? env.DEV_ADMIN_EMAIL || null : null;
  }
  const token =
    request.headers.get('cf-access-jwt-assertion') ??
    request.headers.get('cookie')?.match(/CF_Authorization=([^;]+)/)?.[1];
  if (!token) return null;
  try {
    return await verifyAccessJwt(token, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD);
  } catch (e) {
    console.error('[auth]', e);
    return null;
  }
}
