import { env } from 'cloudflare:workers';

/** Verifies a Turnstile token. Uses Cloudflare's always-pass test secret when none is configured. */
export async function verifyTurnstile(token: string | null | undefined, ip?: string | null) {
  // Offline development only (never set in production): skip the network call.
  if ((env as unknown as Record<string, string>).DEV_SKIP_TURNSTILE === '1') return true;
  if (!token) return false;
  const secret = env.TURNSTILE_SECRET || '1x0000000000000000000000000000000AA';
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    const data = (await res.json()) as { success: boolean };
    return data.success;
  } catch (e) {
    console.error('[turnstile]', e);
    return false;
  }
}
