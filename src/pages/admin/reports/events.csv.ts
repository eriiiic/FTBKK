import type { APIRoute } from 'astro';
import { toDateInput } from '../../../lib/admin';
import { csvCell } from '../../../lib/csv';
import { KIND_LABELS, type EventRow } from '../../../lib/event-stats';
import { loadEventReport } from '../../../lib/reports';

// Admin only (guarded in middleware). Reports > Events and attendance as a CSV, with the page's
// period and type: one line per event, or one event's figures and comments with ?event=.
const rate = (v: number | null) => (v === null ? '' : `${Math.round(v * 100)}%`);
const rating = (v: number | null) => (v === null ? '' : v.toFixed(1));
const csv = (lines: unknown[][]) =>
  '﻿' + lines.map((l) => l.map(csvCell).join(',')).join('\r\n') + '\r\n';
const file = (body: string, name: string) =>
  new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
    },
  });

const header = [
  'Event',
  'Type',
  'Date',
  'Capacity',
  'Registered',
  'Checked in',
  'Show-up rate',
  'No-shows',
  'Seats filled',
  'Waitlist',
  'Cancelled',
  'Walk-ins',
  'Guests',
  'First-timers',
  'Returning',
  'Members',
  'Feedback emailed',
  'Feedback answers',
  'Average rating',
  'Comments',
];
const line = (r: EventRow) => [
  r.event.title,
  KIND_LABELS[r.kind],
  toDateInput(r.event.startsAt),
  r.event.capacity,
  r.registered,
  r.showUp === null ? '' : r.attended,
  rate(r.showUp),
  r.noShows,
  rate(r.fill),
  r.waitlist,
  r.cancelled,
  r.walkIns,
  r.guests,
  r.past ? r.firstTimers : '',
  r.past ? r.returning : '',
  r.past ? r.members : '',
  r.feedback.emailed,
  r.feedback.responses,
  rating(r.feedback.average),
  r.feedback.comments,
];

export const GET: APIRoute = async ({ url }) => {
  const { period, report, detail } = await loadEventReport(url);
  if (detail) {
    const r = detail.row;
    const body = csv([
      header,
      line(r),
      [],
      ['Rating', 'Comment', 'Date'],
      ...detail.comments.map((c) => [c.rating, c.comment, toDateInput(c.createdAt)]),
    ]);
    return file(body, `event-report-${toDateInput(r.event.startsAt)}.csv`);
  }
  return file(
    csv([header, ...report.rows.map(line)]),
    `events-report-${period.fromInput}-to-${period.toInput}.csv`,
  );
};
