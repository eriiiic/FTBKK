import { describe, expect, it } from 'vitest';
import { isTokenUsable, randomToken, sha256, TOKEN_TTL } from '../src/lib/tokens';

describe('tokens', () => {
  it('are random, url-safe and long', () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it('are stored as sha-256 hashes', async () => {
    expect(await sha256('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
  it('expire', () => {
    const now = new Date('2026-10-03T00:00:00Z');
    const t = Math.floor(now.getTime() / 1000);
    expect(isTokenUsable({ expires_at: t + 60, used_at: null, reusable: 0 }, now)).toBe(true);
    expect(isTokenUsable({ expires_at: t - 1, used_at: null, reusable: 0 }, now)).toBe(false);
  });
  it('single-use tokens cannot be reused, confirm tokens can', () => {
    const now = new Date('2026-10-03T00:00:00Z');
    const t = Math.floor(now.getTime() / 1000);
    expect(isTokenUsable({ expires_at: t + 60, used_at: t - 5, reusable: 0 }, now)).toBe(false);
    expect(isTokenUsable({ expires_at: t + 60, used_at: t - 5, reusable: 1 }, now)).toBe(true);
  });
  it('manage links last 30 minutes, verify links 7 days', () => {
    expect(TOKEN_TTL.manage).toBe(1800);
    expect(TOKEN_TTL.verify).toBe(7 * 86400);
  });
});
