import type { APIRoute } from 'astro';
import { asc, eq } from 'drizzle-orm';
import { getDb } from '../../../../db';
import { events, registrations } from '../../../../db/schema';
import { toLocalInput } from '../../../../lib/admin';

// Admin only (guarded in middleware).
const cell = (v: unknown) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // no formula injection when opened in Excel
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const GET: APIRoute = async ({ params }) => {
  const db = getDb();
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, Number(params.id)));
  if (!event) return new Response('Not found', { status: 404 });
  const rows = await db
    .select()
    .from(registrations)
    .where(eq(registrations.eventId, event.id))
    .orderBy(asc(registrations.createdAt), asc(registrations.id));
  const header = [
    'Name',
    'Email',
    'Company',
    'Role',
    'How heard',
    'Status',
    'Registered',
    'Checked in',
    'Photo consent',
  ];
  const lines = rows.map((r) =>
    [
      r.name,
      r.email,
      r.company,
      r.role,
      r.howHeard,
      r.status,
      toLocalInput(r.createdAt).replace('T', ' '),
      toLocalInput(r.checkedInAt).replace('T', ' '),
      r.photoConsent ? 'yes' : 'no',
    ]
      .map(cell)
      .join(','),
  );
  const csv = '﻿' + [header.join(','), ...lines].join('\r\n') + '\r\n';
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${event.slug}-registrations.csv"`,
    },
  });
};
