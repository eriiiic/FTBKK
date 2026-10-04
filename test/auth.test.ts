import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import { checkAccessJwt, requireAdmin, verifyAccessJwt } from '../src/lib/auth';

const TEAM = 'ftbkk.cloudflareaccess.com';
const AUD = 'aud-123';
let keys: CryptoKeyPair;
let jwk: JsonWebKey;

const b64url = (b: ArrayBuffer | Uint8Array | string) =>
  Buffer.from(typeof b === 'string' ? b : new Uint8Array(b as ArrayBuffer))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

async function sign(payload: Record<string, unknown>, kid = 'k1', key = keys.privateKey) {
  const head = b64url(JSON.stringify({ alg: 'RS256', kid }));
  const body = b64url(JSON.stringify(payload));
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${head}.${body}`),
  );
  return `${head}.${body}.${b64url(sig)}`;
}

const valid = () => ({
  aud: [AUD],
  iss: `https://${TEAM}`,
  exp: Math.floor(Date.now() / 1000) + 600,
  email: 'eric@example.com',
});

beforeAll(async () => {
  keys = (await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  jwk = await crypto.subtle.exportKey('jwk', keys.publicKey);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ keys: [{ ...jwk, kid: 'k1' }] })),
  );
});

afterEach(() => {
  for (const k of Object.keys(env)) delete (env as unknown as Record<string, unknown>)[k];
});

describe('verifyAccessJwt', () => {
  it('accepts a valid token', async () => {
    expect(await verifyAccessJwt(await sign(valid()), TEAM, AUD)).toBe('eric@example.com');
  });
  it('rejects the wrong audience, issuer or an expired token', async () => {
    expect(await verifyAccessJwt(await sign({ ...valid(), aud: ['other'] }), TEAM, AUD)).toBeNull();
    expect(
      await verifyAccessJwt(await sign({ ...valid(), iss: 'https://evil.com' }), TEAM, AUD),
    ).toBeNull();
    expect(await verifyAccessJwt(await sign({ ...valid(), exp: 1000 }), TEAM, AUD)).toBeNull();
  });
  it('rejects a bad signature or unknown key', async () => {
    const other = (await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair;
    expect(
      await verifyAccessJwt(await sign(valid(), 'k1', other.privateKey), TEAM, AUD),
    ).toBeNull();
    expect(await verifyAccessJwt(await sign(valid(), 'nope'), TEAM, AUD)).toBeNull();
    expect(await verifyAccessJwt('garbage', TEAM, AUD)).toBeNull();
  });
});

describe('requireAdmin', () => {
  it('fails closed in production without a token', async () => {
    Object.assign(env, { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, DEV_ADMIN_EMAIL: 'x@y.z' });
    expect(await requireAdmin(new Request('https://site/admin'))).toBeNull();
  });
  it('reads the Access header or cookie', async () => {
    Object.assign(env, { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD });
    const token = await sign(valid());
    expect(
      await requireAdmin(
        new Request('https://site/admin', { headers: { 'cf-access-jwt-assertion': token } }),
      ),
    ).toBe('eric@example.com');
    expect(
      await requireAdmin(
        new Request('https://site/admin', {
          headers: { cookie: `a=b; CF_Authorization=${token}` },
        }),
      ),
    ).toBe('eric@example.com');
  });
  it('denies when Access is not configured and no dev email is set', async () => {
    expect(await requireAdmin(new Request('https://site/admin'))).toBeNull();
  });
  it('uses DEV_ADMIN_EMAIL locally', async () => {
    Object.assign(env, { DEV_ADMIN_EMAIL: 'admin@example.com' });
    expect(await requireAdmin(new Request('http://localhost:4321/admin'))).toBe(
      'admin@example.com',
    );
    expect(await requireAdmin(new Request('https://site/admin'))).toBeNull();
  });
});

describe('checkAccessJwt reasons', () => {
  it('names the audience when the login belongs to another Access app', async () => {
    const res = await checkAccessJwt(await sign({ ...valid(), aud: ['other'] }), TEAM, AUD);
    expect('reason' in res && res.reason).toContain('audience other');
  });
  it('flags a token signed by another team', async () => {
    const res = await checkAccessJwt(await sign(valid(), 'unknown-kid'), TEAM, AUD);
    expect('reason' in res && res.reason).toContain('ACCESS_TEAM_DOMAIN');
  });
});
