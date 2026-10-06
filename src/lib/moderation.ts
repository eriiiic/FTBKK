import { z } from 'zod';
import { moderationQueue } from './cron-directory';
import { approveListing, orgById, rejectListing } from './orgs';
import { decideChange, decideClaim, decideMembership } from './admin';
import { CATEGORIES } from './directory';
import type { Organisation } from '../db/schema';

export type ReviewKind = 'listing' | 'change' | 'claim' | 'membership';

export interface ReviewItem {
  kind: ReviewKind;
  id: number;
  org: Organisation;
  at: Date;
  title: string;
  /** "Label: value" rows describing the request. */
  details: [string, string][];
  /** For a change request: field, current value, requested value. */
  diff?: [string, string, string][];
}

const show = (v: unknown) =>
  v === null || v === undefined || v === ''
    ? '–'
    : Array.isArray(v)
      ? v.join(', ') || '–'
      : String(v);

/** Everything waiting for a moderator, oldest first; only one organisation's when orgId is set. */
export async function reviewItems(orgId?: number): Promise<ReviewItem[]> {
  const q = await moderationQueue();
  const items: ReviewItem[] = [
    ...q.pendingOrgs.map((o) => ({
      kind: 'listing' as const,
      id: o.id,
      org: o,
      at: o.submittedAt ?? o.updatedAt,
      title: `New listing: ${o.name}`,
      details: [
        ['Category', CATEGORIES[o.category].label],
        ['Website', show(o.website)],
        ['Pitch', show(o.pitch)],
        ['Submitted by', show(o.ownerEmails)],
      ] as [string, string][],
    })),
    ...q.changes.map(({ change, org }) => ({
      kind: 'change' as const,
      id: change.id,
      org,
      at: change.createdAt,
      title: `Change to ${org.name}`,
      details: [['Asked by', change.email]] as [string, string][],
      diff: Object.entries(change.changes).map(
        ([k, v]) =>
          [k, show((org as unknown as Record<string, unknown>)[k]), show(v)] as [
            string,
            string,
            string,
          ],
      ),
    })),
    ...q.pendingClaims.map(({ claim, org }) => ({
      kind: 'claim' as const,
      id: claim.id,
      org,
      at: claim.createdAt,
      title: `Claim for ${org.name}`,
      details: [
        ['Name', `${claim.name ?? '–'} (${claim.role ?? 'no role'})`],
        ['Email', claim.email],
        [
          'Email domain',
          claim.domainMatches
            ? 'matches the website'
            : `does NOT match the website (${org.website ?? 'none'})`,
        ],
        ['Current owners', org.ownerEmails.length ? org.ownerEmails.join(', ') : 'unclaimed'],
      ] as [string, string][],
    })),
    ...q.applications.map(({ app, org }) => ({
      kind: 'membership' as const,
      id: app.id,
      org,
      at: app.createdAt,
      title: `Company membership: ${org.name}`,
      details: [
        ['Contact', `${app.contactName} (${app.contactRole ?? '–'})`],
        ['Email', app.email],
        ['Motivation', app.motivation],
      ] as [string, string][],
    })),
  ];
  return items
    .filter((it) => orgId === undefined || it.org.id === orgId)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

export const DecisionForm = z.object({
  action: z.enum(['approve', 'reject']),
  kind: z.enum(['listing', 'change', 'claim', 'membership']),
  id: z.coerce.number().int(),
  reason: z.string().max(2000).optional().default(''),
});

/** Approves or rejects one request (emails the person). Returns an error message, or null. */
export async function decide(input: z.infer<typeof DecisionForm>, actor: string) {
  const { action, kind, id } = input;
  const reason = input.reason.trim();
  const approve = action === 'approve';
  if (!approve && reason.length < 5) {
    return 'Write a short reason when you reject. It is emailed to the person.';
  }
  if (kind === 'listing') {
    const org = await orgById(id);
    if (org?.status === 'pending') {
      if (approve) await approveListing(org, actor);
      else await rejectListing(org, reason, actor);
    }
  } else if (kind === 'change') await decideChange(id, approve, reason, actor);
  else if (kind === 'claim') await decideClaim(id, approve, reason, actor);
  else await decideMembership(id, approve, reason, actor);
  return null;
}
