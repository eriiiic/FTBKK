import { env } from 'cloudflare:workers';
import { and, eq, gte, lt } from 'drizzle-orm';
import { getDb } from '../db';
import { events } from '../db/schema';
import { DAY_MS } from './lifecycle';
import { TZ } from './format';
import { sendReminders } from './registrations';

/** Bangkok calendar date (YYYY-MM-DD) of an instant. */
export function bangkokDay(d: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}

/** Reminder email to everyone registered for events happening tomorrow (Bangkok date). */
export async function sendEventReminders(now: Date) {
  const tomorrow = bangkokDay(new Date(now.getTime() + DAY_MS));
  const soon = await getDb()
    .select()
    .from(events)
    .where(
      and(
        eq(events.status, 'published'),
        gte(events.startsAt, now),
        lt(events.startsAt, new Date(now.getTime() + 2 * DAY_MS)),
      ),
    );
  let sent = 0;
  for (const e of soon.filter((e) => bangkokDay(e.startsAt) === tomorrow)) {
    // Mark first so a crash mid-way never sends twice.
    const { results } = await env.DB.prepare(
      `UPDATE registrations SET reminder_sent_at = unixepoch()
       WHERE event_id = ? AND status = 'registered' AND reminder_sent_at IS NULL
       RETURNING name, email, token`,
    )
      .bind(e.id)
      .all<{ name: string; email: string; token: string }>();
    await sendReminders(e, results);
    sent += results.length;
  }
  return { reminders: sent };
}

const BACKUP_TABLES = [
  'events',
  'registrations',
  'posts',
  'categories',
  'post_categories',
  'organisations',
  'org_changes',
  'claims',
  'membership_applications',
  'reminders_sent',
  'audit_log',
  'people',
  'settings',
  'submissions',
  'blocked_senders',
];
const KEEP_BACKUPS = 12;

/** Weekly (Sunday) JSON export of every content table to R2 under backups/. Keeps 12 weeks. */
export async function weeklyBackup(now: Date, force = false) {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(now);
  if (weekday !== 'Sun' && !force) return { backup: 0 };
  const dump: Record<string, unknown[]> = {};
  for (const t of BACKUP_TABLES) {
    dump[t] = (await env.DB.prepare(`SELECT * FROM ${t}`).all()).results;
  }
  const key = `backups/${bangkokDay(now)}.json`;
  await env.MEDIA.put(key, JSON.stringify({ at: now.toISOString(), tables: dump }), {
    httpMetadata: { contentType: 'application/json' },
  });
  const list = await env.MEDIA.list({ prefix: 'backups/' });
  const old = list.objects
    .map((o) => o.key)
    .sort()
    .slice(0, -KEEP_BACKUPS);
  if (old.length) await env.MEDIA.delete(old);
  return { backup: 1, key, pruned: old.length };
}
