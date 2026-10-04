import { CATEGORIES } from './directory';
import type { moderationQueue } from './cron-directory';

/** The moderation queue as cards (oldest first), for the To review tab and an organisation's page. */
export function reviewItems(queue: Awaited<ReturnType<typeof moderationQueue>>) {
  return [
    ...queue.pendingOrgs.map((o) => ({
      kind: 'listing' as const,
      id: o.id,
      org: o,
      at: o.submittedAt ?? o.updatedAt,
      title: `New listing: ${o.name}`,
      lines: [
        `${CATEGORIES[o.category].label} · ${o.website ?? 'no website'}`,
        o.pitch ?? '',
        `Submitted by ${o.ownerEmails.join(', ')}`,
      ],
    })),
    ...queue.changes.map(({ change, org }) => ({
      kind: 'change' as const,
      id: change.id,
      org,
      at: change.createdAt,
      title: `Change to ${org.name}`,
      lines: [
        `Asked by ${change.email}`,
        ...Object.entries(change.changes).map(
          ([k, v]) =>
            `${k}: ${String((org as unknown as Record<string, unknown>)[k] ?? '–')} → ${String(v ?? '–')}`,
        ),
      ],
    })),
    ...queue.pendingClaims.map(({ claim, org }) => ({
      kind: 'claim' as const,
      id: claim.id,
      org,
      at: claim.createdAt,
      title: `Claim for ${org.name}`,
      lines: [
        `${claim.name ?? ''} (${claim.role ?? 'no role'}) <${claim.email}>`,
        claim.domainMatches
          ? 'Email domain matches the website.'
          : `Email domain does NOT match the website (${org.website ?? 'none'}).`,
        org.ownerEmails.length
          ? `Current owners: ${org.ownerEmails.join(', ')}`
          : 'Unclaimed until now.',
      ],
    })),
    ...queue.applications.map(({ app, org }) => ({
      kind: 'membership' as const,
      id: app.id,
      org,
      at: app.createdAt,
      title: `Membership: ${org.name}`,
      lines: [`${app.contactName} (${app.contactRole ?? '-'}) <${app.email}>`, app.motivation],
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
}

export type ReviewItem = ReturnType<typeof reviewItems>[number];
