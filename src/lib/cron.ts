/**
 * Daily scheduled job (09:00 Asia/Bangkok). Jobs are added in later phases:
 * directory reminders and expiry (phase 5), event reminders and backups (phase 7).
 */
export async function runScheduled(_env: Env, now: Date): Promise<void> {
  console.log(`[cron] run at ${now.toISOString()}`);
}
