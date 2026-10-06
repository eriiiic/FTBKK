import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { getDb } from '../db';
import {
  claims,
  magicTokens,
  membershipApplications,
  orgChanges,
  organisations,
  remindersSent,
} from '../db/schema';
import {
  DAY_MS,
  MODERATION_TARGET_DAYS,
  UNVERIFIED_TTL_DAYS,
  ageDays,
  daysUntil,
  remindersDue,
  shouldDelete,
  shouldExpire,
} from './lifecycle';
import { audit, moderatorEmails, sendExpiredNotice, sendRenewalReminder, siteUrl } from './orgs';
import { sendEmail } from './email';
import { TZ, formatDate } from './format';

/** Daily directory maintenance. Returns a summary for the logs. */
export async function runDirectoryJobs(now: Date) {
  const db = getDb();
  const summary: Record<string, number> = {};

  // 1. Renewal reminders at J-30, J-14, J0.
  const published = await db
    .select()
    .from(organisations)
    .where(eq(organisations.status, 'published'));
  const sentRows = await db
    .select({ orgId: remindersSent.orgId, kind: remindersSent.kind })
    .from(remindersSent);
  const sent = new Set(sentRows.map((r) => `${r.orgId}:${r.kind}`));
  const due = remindersDue(published, now, sent);
  for (const r of due) {
    const org = published.find((o) => o.id === r.orgId)!;
    // Record first so a crash mid-send never causes a duplicate tomorrow.
    const ins = await db
      .insert(remindersSent)
      .values({ orgId: org.id, kind: r.kind })
      .onConflictDoNothing()
      .returning();
    if (ins.length) await sendRenewalReminder(org, r.offset);
  }
  summary.reminders = due.length;

  // 2. Expire listings 30 days after the renewal date.
  let expired = 0;
  for (const org of published.filter((o) => shouldExpire(o, now))) {
    await db
      .update(organisations)
      .set({
        status: 'expired',
        expiredAt: now,
        memberStatus: org.memberStatus === 'member' ? 'lapsed' : org.memberStatus,
        updatedAt: now,
      })
      .where(eq(organisations.id, org.id));
    await audit(
      'cron',
      'expire',
      'organisation',
      org.id,
      { status: 'published' },
      { status: 'expired' },
    );
    await sendExpiredNotice(org);
    expired++;
  }
  summary.expired = expired;

  // 3. Delete listings 12 months after expiry.
  const expiredRows = await db
    .select()
    .from(organisations)
    .where(eq(organisations.status, 'expired'));
  const toDelete = expiredRows.filter((o) => shouldDelete(o, now));
  for (const org of toDelete) {
    await db.delete(organisations).where(eq(organisations.id, org.id));
    await audit('cron', 'delete', 'organisation', org.id, { name: org.name }, null);
  }
  summary.deleted = toDelete.length;

  // 4. Drop unverified submissions after 7 days, and dead tokens.
  const cutoff = new Date(now.getTime() - UNVERIFIED_TTL_DAYS * DAY_MS);
  const stale = await db
    .delete(organisations)
    .where(and(eq(organisations.status, 'unverified'), lt(organisations.createdAt, cutoff)))
    .returning({ id: organisations.id });
  summary.unverifiedDeleted = stale.length;
  await db.delete(claims).where(and(eq(claims.status, 'unverified'), lt(claims.createdAt, cutoff)));
  await db.delete(magicTokens).where(lt(magicTokens.expiresAt, now));

  // 5. Monday digest for moderators.
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(now);
  if (weekday === 'Mon') {
    await sendModeratorDigest(now);
    summary.digest = 1;
  }
  return summary;
}

export async function moderationQueue() {
  const db = getDb();
  const [pendingOrgs, changes, pendingClaims, applications] = await Promise.all([
    db.select().from(organisations).where(eq(organisations.status, 'pending')),
    db
      .select({ change: orgChanges, org: organisations })
      .from(orgChanges)
      .innerJoin(organisations, eq(organisations.id, orgChanges.orgId))
      .where(eq(orgChanges.status, 'pending')),
    db
      .select({ claim: claims, org: organisations })
      .from(claims)
      .innerJoin(organisations, eq(organisations.id, claims.orgId))
      .where(eq(claims.status, 'pending')),
    db
      .select({ app: membershipApplications, org: organisations })
      .from(membershipApplications)
      .innerJoin(organisations, eq(organisations.id, membershipApplications.orgId))
      .where(eq(membershipApplications.status, 'pending')),
  ]);
  return { pendingOrgs, changes, pendingClaims, applications };
}

export async function sendModeratorDigest(now: Date) {
  const q = await moderationQueue();
  const ages = [
    ...q.pendingOrgs.map((o) => o.submittedAt ?? o.updatedAt),
    ...q.changes.map((c) => c.change.createdAt),
    ...q.pendingClaims.map((c) => c.claim.createdAt),
    ...q.applications.map((a) => a.app.createdAt),
  ].map((d) => ageDays(d, now));
  const oldest = ages.length ? Math.max(...ages) : 0;
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const expiring = await getDb()
    .select({
      name: organisations.name,
      renewalDueAt: organisations.renewalDueAt,
      owners: organisations.ownerEmails,
    })
    .from(organisations)
    .where(
      and(
        inArray(organisations.status, ['published']),
        sql`${organisations.renewalDueAt} IS NOT NULL`,
        lt(organisations.renewalDueAt, monthEnd),
      ),
    );
  const unclaimedDue = expiring.filter((o) => o.owners.length === 0).length;
  const total = ages.length;
  if (!total && !expiring.length) return;
  await sendEmail({
    to: await moderatorEmails(),
    subject: `Directory: ${total} item${total === 1 ? '' : 's'} to review${oldest > MODERATION_TARGET_DAYS ? ` (oldest ${oldest} days)` : ''}`,
    paragraphs: [
      `Weekly summary of the ecosystem directory. Target: answer within ${MODERATION_TARGET_DAYS} days.`,
      ...expiring
        .slice(0, 20)
        .map((o) =>
          `Renewal due: ${o.name}, ${o.renewalDueAt ? formatDate(o.renewalDueAt) : ''}${o.owners.length ? '' : ' (unclaimed, invite someone to claim it)'} ${o.renewalDueAt && daysUntil(o.renewalDueAt, now) < 0 ? '(overdue)' : ''}`.trim(),
        ),
    ],
    details: [
      ['New listings', String(q.pendingOrgs.length)],
      ['Owner changes', String(q.changes.length)],
      ['Claims', String(q.pendingClaims.length)],
      ['Company membership applications', String(q.applications.length)],
      ['Oldest item', `${oldest} days`],
      ['Renewals due this month', `${expiring.length} (${unclaimedDue} unclaimed)`],
    ],
    action: { label: 'Open the moderation queue', url: siteUrl('/admin/ecosystem') },
  });
}
