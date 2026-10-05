import type { APIRoute } from 'astro';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../../../db';
import { events, registrations } from '../../../db/schema';
import { email, optionalText } from '../../../lib/forms';
import { audit } from '../../../lib/orgs';
import { earlierAttendance, earlierFor, greeting } from '../../../lib/regulars';
import { normalizeCode, ticketCode } from '../../../lib/ticket';
import { randomToken } from '../../../lib/tokens';

const WalkInSchema = z
  .object({
    eventId: z.number().int(),
    name: z.string().trim().min(2, 'Enter their name.').max(120),
    email: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined),
      email.optional(),
    ),
    phone: z
      .string()
      .max(40)
      .regex(/^[+\d\s().-]*$/, 'Enter a phone number (digits, spaces, +).')
      .optional()
      .transform((s) => (s?.trim() ? s.trim() : null)),
    company: optionalText(120),
    /** They said yes to the newsletter at the door (opt-in: unticked means not asked). */
    newsletter: z.boolean().optional().default(false),
  })
  .refine((d) => !d.newsletter || d.email, {
    message: 'Add their email to sign them up for the newsletter.',
    path: ['newsletter'],
  });

// Admin only (guarded in middleware). Adds someone who turns up without registering and checks
// them in at once. Capacity is not checked: they are already in the room. If the email is already
// registered for this event, that registration is checked in instead of creating a second one.
export const POST: APIRoute = async ({ request, locals }) => {
  const parsed = WalkInSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Response.json(
      { error: issue?.path[0] === 'eventId' ? 'Invalid input.' : issue?.message },
      { status: 400 },
    );
  }
  const { eventId, name, email: mail, phone, company, newsletter } = parsed.data;
  const db = getDb();
  const [event] = await db
    .select({ id: events.id, startsAt: events.startsAt })
    .from(events)
    .where(eq(events.id, eventId));
  if (!event) return Response.json({ error: 'Event not found.' }, { status: 404 });

  const now = new Date();
  // Only a tick is recorded: an unticked box may just mean nobody asked.
  const consent = newsletter ? { newsletterConsent: true, newsletterConsentAt: now } : {};
  const [existing] = mail
    ? await db
        .select()
        .from(registrations)
        .where(and(eq(registrations.eventId, eventId), eq(registrations.email, mail)))
    : [];
  if (existing?.status === 'attended') {
    // Still record a newsletter yes given at the door (e.g. at the bar, after check-in).
    if (newsletter) {
      await db.update(registrations).set(consent).where(eq(registrations.id, existing.id));
      await audit(
        locals.adminEmail ?? 'admin',
        'registration_newsletter',
        'registration',
        existing.id,
        { newsletter: existing.newsletterConsent },
        { newsletter: true },
      );
    }
    return Response.json(
      {
        error: `${existing.name} is already checked in${newsletter ? '. Newsletter yes recorded.' : '.'}`,
        id: existing.id,
      },
      { status: 409 },
    );
  }

  const [row] = existing
    ? await db
        .update(registrations)
        .set({
          status: 'attended',
          checkedInAt: now,
          ...consent,
          // A cancelled registration is reused as a walk-in with what was typed at the door.
          ...(existing.status === 'cancelled'
            ? { name, phone, company, walkIn: true, reminderSentAt: null }
            : {}),
        })
        .where(and(eq(registrations.id, existing.id), eq(registrations.status, existing.status)))
        .returning()
    : await db
        .insert(registrations)
        .values({
          eventId,
          name,
          email: mail ?? null,
          phone,
          company,
          walkIn: true,
          status: 'attended',
          token: randomToken(24),
          checkedInAt: now,
          ...consent,
        })
        .onConflictDoNothing()
        .returning();
  if (!row) {
    return Response.json({ error: 'Someone else just checked this person in.' }, { status: 409 });
  }

  await audit(
    locals.adminEmail ?? 'admin',
    existing && existing.status !== 'cancelled' ? 'registration_attended' : 'registration_walk_in',
    'registration',
    row.id,
    existing ? { status: existing.status } : null,
    null,
  );
  return Response.json({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    code: normalizeCode(await ticketCode(row.token)),
    // "First time" or "Regular" badge for the check-in list (none without an email).
    greeting: greeting(
      earlierFor(row.email ? await earlierAttendance(event, row.email) : new Map(), row.email),
    ),
    // True when the person had registered: the screen already lists them.
    existing: Boolean(existing && existing.status !== 'cancelled'),
  });
};
