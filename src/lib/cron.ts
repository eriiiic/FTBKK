import { runDirectoryJobs } from './cron-directory';
import { sendEventReminders, sendFeedbackRequests, weeklyBackup } from './cron-events';
import { runMemberRenewals } from './members';
import { getSettings } from './settings';

/**
 * Daily scheduled job (09:00 Asia/Bangkok, `0 2 * * *` in wrangler.jsonc). Each job is isolated so
 * one failure doesn't stop the others.
 */
export async function runScheduled(_env: Env, now: Date): Promise<void> {
  const jobs: [string, () => Promise<unknown>][] = [
    ['event-reminders', () => sendEventReminders(now)],
    ['event-feedback', () => sendFeedbackRequests(now)],
    ['directory', () => runDirectoryJobs(now)],
    // Yearly reconfirmation, only once membership is open (emails must reach everyone).
    [
      'member-renewals',
      async () => ((await getSettings()).memberSignupOpen ? runMemberRenewals(now) : 'off'),
    ],
    ['backup', () => weeklyBackup(now)],
  ];
  for (const [name, job] of jobs) {
    try {
      console.log(`[cron] ${name}`, JSON.stringify(await job()));
    } catch (e) {
      console.error(`[cron] ${name} failed`, e);
    }
  }
}
