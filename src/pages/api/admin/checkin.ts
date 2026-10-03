import type { APIRoute } from 'astro';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '../../../db';
import { registrations } from '../../../db/schema';

// Admin only (guarded in middleware). Toggles one attendee's check-in from the check-in screen.
export const POST: APIRoute = async ({ request }) => {
  const parsed = z
    .object({ id: z.number().int(), eventId: z.number().int(), undo: z.boolean().default(false) })
    .safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: 'Invalid input.' }, { status: 400 });
  const { id, eventId, undo } = parsed.data;
  const [row] = await getDb()
    .update(registrations)
    .set(
      undo
        ? { status: 'registered', checkedInAt: null }
        : { status: 'attended', checkedInAt: new Date() },
    )
    .where(
      and(
        eq(registrations.id, id),
        eq(registrations.eventId, eventId),
        inArray(registrations.status, undo ? ['attended'] : ['registered', 'waitlist']),
      ),
    )
    .returning({ id: registrations.id, status: registrations.status });
  if (!row) return Response.json({ error: 'Already done or not found.' }, { status: 409 });
  return Response.json(row);
};
