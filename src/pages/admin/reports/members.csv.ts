import type { APIRoute } from 'astro';
import { toDateInput } from '../../../lib/admin';
import { csvCell } from '../../../lib/csv';
import { loadMemberReport } from '../../../lib/reports';

// Admin only (guarded in middleware). Reports > Membership as a CSV, with the page's period:
// ?table=growth (new members and total per week, month or year) or ?table=events (members at
// each event).
const rate = (part: number, of: number) => (of ? `${Math.round((part / of) * 100)}%` : '');

export const GET: APIRoute = async ({ url }) => {
  const { period, report: r } = await loadMemberReport(url);
  const growth = url.searchParams.get('table') === 'growth';
  const lines: unknown[][] = growth
    ? [
        [
          r.growth.unit[0]!.toUpperCase() + r.growth.unit.slice(1),
          'New members',
          'Members in total',
        ],
        ...r.growth.rows.map((g) => [g.key, g.added, g.total]),
      ]
    : [
        [
          'Event',
          'Date',
          'People',
          'Counted',
          'Members on the day',
          'Share',
          'Members today',
          'Share',
        ],
        ...r.perEvent.map((e) => [
          e.event.title,
          toDateInput(e.event.startsAt),
          e.people,
          e.counted,
          e.membersThen,
          rate(e.membersThen, e.people),
          e.membersNow,
          rate(e.membersNow, e.people),
        ]),
      ];
  const body = '﻿' + lines.map((l) => l.map(csvCell).join(',')).join('\r\n') + '\r\n';
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="membership-${growth ? 'growth' : 'events'}-${period.fromInput}-to-${period.toInput}.csv"`,
    },
  });
};
