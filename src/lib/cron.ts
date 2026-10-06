import { runDirectoryJobs } from './cron-directory';
import { sendEventReminders, sendFeedbackRequests, weeklyBackup } from './cron-events';
import { sendOwnerDigests } from './ownership';
import { sendBoardMemberDigest } from './members';
import { TZ } from './format';

/**
 * Daily scheduled job (09:00 Asia/Bangkok, `0 2 * * *` in wrangler.jsonc). Each job is isolated so
 * one failure doesn't stop the others.
 */
export async function runScheduled(_env: Env, now: Date): Promise<void> {
  const jobs: [string, () => Promise<unknown>][] = [
    ['event-reminders', () => sendEventReminders(now)],
    ['event-feedback', () => sendFeedbackRequests(now)],
    ['directory', () => runDirectoryJobs(now)],
    ['backup', () => weeklyBackup(now)],
    ['owner-digest', () => (isMonday(now) ? sendOwnerDigests(now) : Promise.resolve(0))],
    ['member-digest', () => (isMonday(now) ? sendBoardMemberDigest() : Promise.resolve(0))],
  ];
  for (const [name, job] of jobs) {
    try {
      console.log(`[cron] ${name}`, JSON.stringify(await job()));
    } catch (e) {
      console.error(`[cron] ${name} failed`, e);
    }
  }
}

/** Monday in Bangkok: the day of the weekly emails. */
export const isMonday = (now: Date) =>
  new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(now) === 'Mon';
