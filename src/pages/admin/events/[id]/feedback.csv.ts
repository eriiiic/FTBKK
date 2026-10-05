import type { APIRoute } from 'astro';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../../../db';
import { eventFeedback, events, registrations } from '../../../../db/schema';
import { toLocalInput } from '../../../../lib/admin';

// Admin only (guarded in middleware). ?anon=1 leaves out names and emails (to share with sponsors).
const cell = (v: unknown) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // no formula injection when opened in Excel
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const Query = z.object({
  id: z.coerce.number().int().positive(),
  anon: z.enum(['0', '1']).optional(),
});

export const GET: APIRoute = async ({ params, url }) => {
  const q = Query.safeParse({ id: params.id, anon: url.searchParams.get('anon') ?? undefined });
  if (!q.success) return new Response('Bad request', { status: 400 });
  const anon = q.data.anon === '1';
  const db = getDb();
  const [event] = await db.select().from(events).where(eq(events.id, q.data.id));
  if (!event) return new Response('Not found', { status: 404 });
  const rows = await db
    .select({
      rating: eventFeedback.rating,
      comment: eventFeedback.comment,
      updatedAt: eventFeedback.updatedAt,
      name: registrations.name,
      email: registrations.email,
      company: registrations.company,
    })
    .from(eventFeedback)
    .innerJoin(registrations, eq(registrations.id, eventFeedback.registrationId))
    .where(eq(eventFeedback.eventId, event.id))
    .orderBy(desc(eventFeedback.updatedAt));
  const header = ['Rating', 'Comment', 'Date', ...(anon ? [] : ['Name', 'Email', 'Company'])];
  const lines = rows.map((r) =>
    [
      r.rating,
      r.comment,
      toLocalInput(r.updatedAt).replace('T', ' '),
      ...(anon ? [] : [r.name, r.email, r.company]),
    ]
      .map(cell)
      .join(','),
  );
  const csv = '﻿' + [header.join(','), ...lines].join('\r\n') + '\r\n';
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${event.slug}-feedback${anon ? '-anonymous' : ''}.csv"`,
    },
  });
};
