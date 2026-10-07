import { runDirectoryJobs } from './cron-directory';
import { sendEventReminders, sendFeedbackRequests, weeklyBackup } from './cron-events';
import { runMemberRenewals } from './members';
import { getSettings } from './settings';
import { runSocialPosts } from './social';

/** The daily jobs run at 02:00 UTC = 09:00 Asia/Bangkok. */
export const DAILY_HOUR_UTC = 2;

/**
 * Scheduled jobs. The cron fires every hour (`0 * * * *` in wrangler.jsonc): social media posts
 * go out every hour, the rest once a day at 09:00 Bangkok. Each job is isolated so one failure
 * doesn't stop the others.
 */
export async function runScheduled(_env: Env, now: Date): Promise<void> {
  const hourly: [string, () => Promise<unknown>][] = [['social-posts', () => runSocialPosts(now)]];
  const daily: [string, () => Promise<unknown>][] = [
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
  const jobs = now.getUTCHours() === DAILY_HOUR_UTC ? [...hourly, ...daily] : hourly;
  for (const [name, job] of jobs) {
    try {
      console.log(`[cron] ${name}`, JSON.stringify(await job()));
    } catch (e) {
      console.error(`[cron] ${name} failed`, e);
    }
  }
}
