import type { APIRoute } from 'astro';
import { toDateInput } from '../../lib/admin';
import { csvCell } from '../../lib/csv';
import { filterMembers, joinedAt, loadMemberList, parseMemberFilters } from '../../lib/member-list';
import { MEMBER_STATUSES, PROFILE_TYPES } from '../../lib/members';
import { groupNames, loadLabels, tagNames } from '../../lib/contact-labels';

// Admin only (guarded in middleware). Members > All members as a CSV, with the page's filters.
export const GET: APIRoute = async ({ url }) => {
  const [all, labels] = await Promise.all([loadMemberList(), loadLabels()]);
  const list = filterMembers(all, parseMemberFilters(url.searchParams));
  const header = [
    'Name',
    'Email',
    'Phone',
    'Company',
    'Job title',
    'Profile',
    'Sectors of interest',
    'Status',
    'Joined',
    'Renewal due',
    'Events attended',
    'No-shows',
    'No-show rate',
    'Newsletter',
    'Tags',
    'Groups',
    'How they heard of us',
    'LinkedIn',
    'Notes',
  ];
  const lines = list.map((m) =>
    [
      m.name,
      m.email,
      m.phone,
      m.company,
      m.jobTitle,
      PROFILE_TYPES[m.profileType as keyof typeof PROFILE_TYPES] ?? m.profileType,
      m.interests.join('; '),
      MEMBER_STATUSES[m.status],
      toDateInput(joinedAt(m)),
      toDateInput(m.renewalDueAt),
      m.stats.attended,
      m.stats.noShows,
      m.stats.noShowRate === null ? '' : `${Math.round(m.stats.noShowRate * 100)}%`,
      m.stats.newsletter ? 'yes' : 'no',
      tagNames(m.tags, labels).join('; '),
      groupNames(m.groups, labels).join('; '),
      m.howHeard,
      m.linkedin,
      m.notes,
    ]
      .map(csvCell)
      .join(','),
  );
  const csv = '﻿' + [header.join(','), ...lines].join('\r\n') + '\r\n';
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="members-${toDateInput(new Date())}.csv"`,
    },
  });
};
