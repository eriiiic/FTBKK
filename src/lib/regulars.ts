import { and, eq, inArray, lt, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { getDb } from '../db';
import { events, registrations } from '../db/schema';

// Newcomers and regulars: how many earlier events someone came to. Used by the check-in screen
// (so volunteers can greet newcomers) and the "Suggest for membership" filter on Contacts.

/** Someone who came to at least this many events is a regular. */
export const REGULAR_MIN_EVENTS = 3;

export type Greeting = { kind: 'first' | 'regular'; label: string };

/**
 * The check-in badge for someone who came to `earlier` earlier events. null when we can't tell
 * (a walk-in without an email) or they are neither new nor a regular.
 */
export function greeting(earlier: number | null | undefined): Greeting | null {
  if (earlier == null) return null;
  if (earlier === 0) return { kind: 'first', label: 'First time' };
  if (earlier >= REGULAR_MIN_EVENTS)
    return { kind: 'regular', label: `Regular · ${earlier} events` };
  return null;
}

/** "Say hello to the 3 newcomers", or '' when there are none. */
export const newcomersHint = (n: number) =>
  n === 0 ? '' : n === 1 ? 'Say hello to the 1 newcomer' : `Say hello to the ${n} newcomers`;

/**
 * Earlier events each person came to, by lowercased email: published events that started before
 * this one where they were checked in. Without `email`, for everyone registered for this event
 * (one query); with it, for that person only. People who never came are missing from the map.
 */
export async function earlierAttendance(
  event: { id: number; startsAt: Date },
  email?: string | null,
) {
  const db = getDb();
  const here = alias(registrations, 'here');
  const key = sql<string>`lower(${registrations.email})`;
  const rows = await db
    .select({ email: key, n: sql<number>`count(distinct ${registrations.eventId})` })
    .from(registrations)
    .innerJoin(events, eq(events.id, registrations.eventId))
    .where(
      and(
        eq(registrations.status, 'attended'),
        eq(events.status, 'published'),
        lt(events.startsAt, event.startsAt),
        ne(events.id, event.id),
        email
          ? sql`${key} = ${email.trim().toLowerCase()}`
          : inArray(
              key,
              db
                .select({ email: sql`lower(${here.email})` })
                .from(here)
                .where(eq(here.eventId, event.id)),
            ),
      ),
    )
    .groupBy(key);
  return new Map(rows.map((r) => [r.email, Number(r.n)]));
}

/** How many earlier events this registration's person came to; null without an email. */
export const earlierFor = (counts: Map<string, number>, email: string | null) =>
  email ? (counts.get(email.trim().toLowerCase()) ?? 0) : null;
