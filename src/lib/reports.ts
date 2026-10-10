import { eq, isNotNull } from 'drizzle-orm';
import { getDb } from '../db';
import { eventFeedback, events, members, registrations } from '../db/schema';
import { COVER_KINDS, type EventKind } from './event-covers';
import {
  eventDetail,
  eventReport,
  eventRows,
  KIND_LABELS,
  type StatRegistration,
} from './event-stats';
import { memberReports } from './member-reports';
import { parsePeriod } from './report-period';

// Loads what the two Reports tabs (and their CSV exports) need, with the filters in the URL.

const KINDS = [...COVER_KINDS, 'other'] as const;
export const kindOptions = KINDS.map((k) => ({ value: k, label: KIND_LABELS[k] }));

const earliestOf = (dates: (Date | null | undefined)[], now: Date) =>
  dates.reduce<Date>((min, d) => (d && d < min ? d : min), now);

export async function loadEventReport(url: URL, now = new Date()) {
  const db = getDb();
  const [eventList, regs, feedback, memberList] = await Promise.all([
    db
      .select({
        id: events.id,
        title: events.title,
        series: events.series,
        startsAt: events.startsAt,
        capacity: events.capacity,
        status: events.status,
      })
      .from(events),
    db
      .select({
        eventId: registrations.eventId,
        email: registrations.email,
        status: registrations.status,
        createdAt: registrations.createdAt,
        checkedInAt: registrations.checkedInAt,
        howHeard: registrations.howHeard,
        guests: registrations.guests,
        walkIn: registrations.walkIn,
        company: registrations.company,
        feedbackSentAt: registrations.feedbackSentAt,
      })
      .from(registrations) as Promise<StatRegistration[]>,
    db
      .select({
        eventId: eventFeedback.eventId,
        rating: eventFeedback.rating,
        comment: eventFeedback.comment,
        createdAt: eventFeedback.createdAt,
      })
      .from(eventFeedback),
    db
      .select({
        email: members.email,
        status: members.status,
        confirmedAt: members.confirmedAt,
        createdAt: members.createdAt,
      })
      .from(members),
  ]);
  const period = parsePeriod(
    url.searchParams,
    now,
    earliestOf(
      eventList.filter((e) => e.status !== 'draft').map((e) => e.startsAt),
      now,
    ),
  );
  const type = url.searchParams.get('type');
  const kind = (KINDS as readonly string[]).includes(type ?? '') ? (type as EventKind) : null;
  const rows = eventRows(eventList, regs, feedback, memberList, now);
  const report = eventReport(
    rows,
    regs,
    feedback,
    { period, previous: period.previous, kind },
    now,
  );
  const eventId = Number(url.searchParams.get('event')) || null;
  const row = eventId ? rows.find((r) => r.event.id === eventId) : undefined;
  return {
    now,
    period,
    kind,
    rows,
    report,
    detail: row ? eventDetail(row, rows, regs, feedback, now) : null,
  };
}

export async function loadMemberReport(url: URL, now = new Date()) {
  const db = getDb();
  const [memberRows, eventRowsList, regRows, feedbackRows] = await Promise.all([
    db
      .select({
        email: members.email,
        name: members.name,
        status: members.status,
        profileType: members.profileType,
        interests: members.interests,
        howHeard: members.howHeard,
        confirmedAt: members.confirmedAt,
        createdAt: members.createdAt,
        renewalDueAt: members.renewalDueAt,
      })
      .from(members),
    db
      .select({
        id: events.id,
        title: events.title,
        startsAt: events.startsAt,
        status: events.status,
      })
      .from(events),
    db
      .select({
        eventId: registrations.eventId,
        email: registrations.email,
        status: registrations.status,
      })
      .from(registrations),
    db
      .select({
        eventId: eventFeedback.eventId,
        email: registrations.email,
        rating: eventFeedback.rating,
      })
      .from(eventFeedback)
      .innerJoin(registrations, eq(registrations.id, eventFeedback.registrationId))
      .where(isNotNull(eventFeedback.rating)),
  ]);
  const period = parsePeriod(
    url.searchParams,
    now,
    earliestOf(
      [
        ...memberRows.map((m) => m.confirmedAt ?? m.createdAt),
        ...eventRowsList.filter((e) => e.status !== 'draft').map((e) => e.startsAt),
      ],
      now,
    ),
  );
  return {
    now,
    period,
    report: memberReports(
      memberRows,
      eventRowsList,
      regRows,
      feedbackRows,
      period,
      period.previous,
      now,
    ),
  };
}
