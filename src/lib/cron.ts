import { runDirectoryJobs } from './cron-directory';

/**
 * Daily scheduled job (09:00 Asia/Bangkok, `0 2 * * *` in wrangler.jsonc). Each job is isolated so
 * one failure doesn't stop the others.
 */
export async function runScheduled(_env: Env, now: Date): Promise<void> {
  const jobs: [string, () => Promise<unknown>][] = [['directory', () => runDirectoryJobs(now)]];
  for (const [name, job] of jobs) {
    try {
      console.log(`[cron] ${name}`, JSON.stringify(await job()));
    } catch (e) {
      console.error(`[cron] ${name} failed`, e);
    }
  }
}
