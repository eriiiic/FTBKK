import { env } from 'cloudflare:workers';

/**
 * Fixed-window counter in D1. Returns false when `key` was hit more than `limit` times in the
 * current window. Good enough for low-traffic forms; Turnstile does the heavy lifting.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  db: D1Database = env.DB,
) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSeconds);
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, count, window_start) VALUES (?1, 1, ?2)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN window_start = ?2 THEN count + 1 ELSE 1 END,
         window_start = ?2
       RETURNING count`,
    )
    .bind(key, windowStart)
    .first<{ count: number }>();
  return (row?.count ?? 0) <= limit;
}
