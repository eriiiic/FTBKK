/**
 * Pure date logic for the directory lifecycle (unit-tested with a fixed clock).
 * Renewal is yearly; reminders at J-30, J-14 and J0; hidden at J+30; deleted 12 months after.
 */
export const DAY_MS = 86400 * 1000;
export const REMINDER_OFFSETS = [30, 14, 0] as const;
export const EXPIRE_AFTER_DAYS = 30;
export const DELETE_AFTER_EXPIRY_MONTHS = 12;
export const UNVERIFIED_TTL_DAYS = 7;
export const MODERATION_TARGET_DAYS = 5;

export function addMonths(d: Date, months: number) {
  const out = new Date(d);
  const day = out.getUTCDate();
  out.setUTCDate(1);
  out.setUTCMonth(out.getUTCMonth() + months);
  const last = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(day, last));
  return out;
}

/** Dates set on approval or confirmation. */
export function renewalDates(now: Date) {
  return { confirmedAt: now, renewalDueAt: addMonths(now, 12) };
}

/** Whole days from `now` until `due` in Bangkok calendar days (negative once past). */
export function daysUntil(due: Date, now: Date) {
  const bkk = (d: Date) => {
    const t = d.getTime() + 7 * 3600 * 1000;
    return Math.floor(t / DAY_MS);
  };
  return bkk(due) - bkk(now);
}

export interface ReminderCandidate {
  id: number;
  status: string;
  renewalDueAt: Date | null;
  ownerEmails: string[];
}

/**
 * Which reminder (30/14/0) is due today for each listing. A reminder is due when the listing is
 * published, claimed, and today is on or past the offset day but before the next one, so a missed
 * cron run still sends it the next day. `sent` holds kinds already recorded in reminders_sent.
 */
export function remindersDue(orgs: ReminderCandidate[], now: Date, sent: Set<string>) {
  const out: { orgId: number; offset: number; kind: string }[] = [];
  for (const o of orgs) {
    if (o.status !== 'published' || !o.renewalDueAt || o.ownerEmails.length === 0) continue;
    const days = daysUntil(o.renewalDueAt, now);
    const offset = REMINDER_OFFSETS.find(
      (off, i) =>
        days <= off && (i === REMINDER_OFFSETS.length - 1 || days > REMINDER_OFFSETS[i + 1]!),
    );
    if (offset === undefined || days < -EXPIRE_AFTER_DAYS) continue;
    const kind = reminderKind(offset, o.renewalDueAt);
    if (!sent.has(`${o.id}:${kind}`)) out.push({ orgId: o.id, offset, kind });
  }
  return out;
}

export function reminderKind(offset: number, due: Date) {
  return `renewal-${offset}:${due.toISOString().slice(0, 10)}`;
}

export function shouldExpire(o: ReminderCandidate, now: Date) {
  return (
    o.status === 'published' &&
    !!o.renewalDueAt &&
    o.ownerEmails.length > 0 &&
    daysUntil(o.renewalDueAt, now) <= -EXPIRE_AFTER_DAYS
  );
}

export function shouldDelete(o: { status: string; expiredAt: Date | null }, now: Date) {
  return (
    o.status === 'expired' &&
    !!o.expiredAt &&
    now.getTime() >= addMonths(o.expiredAt, DELETE_AFTER_EXPIRY_MONTHS).getTime()
  );
}

export function ageDays(from: Date, now: Date) {
  return Math.floor((now.getTime() - from.getTime()) / DAY_MS);
}
