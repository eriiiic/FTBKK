// Who owns what: the organising team, their roles, and each event's checklist of steps with an
// owner and a due date (from the event circuit agreed by the team). See docs/admin.md.
import { z } from 'zod';
import { and, asc, eq, gte, inArray, isNull, ne } from 'drizzle-orm';
import { getDb } from '../db';
import { eventTasks, events, teamMembers, type TeamMember } from '../db/schema';
import { DAY_MS } from './lifecycle';
import { TZ, formatDate } from './format';
import { sendEmail } from './email';
import { siteUrl } from './orgs';

export const TEAM_ROLES = {
  lead: 'Event lead',
  board: 'Board go/no-go',
  comms: 'Communication',
  door: 'Check-in at the door',
  directory: 'Directory reviews',
  messages: 'Messages and contacts',
} as const;
export type TeamRole = keyof typeof TEAM_ROLES;
export const ROLE_KEYS = Object.keys(TEAM_ROLES) as TeamRole[];

export interface EventStep {
  key: string;
  title: string;
  /** Days from the event's start: -45 is 45 days before, 7 is a week after. */
  offset: number;
  /** Whose step it is by default: the first team member with this role. */
  role: TeamRole;
  /** Where the site helps, shown under the step. */
  hint?: string;
}

/**
 * The event circuit, in order. The reminder (D-1) and the feedback email (D+1) are sent by the
 * site, so they are not steps anyone owns.
 */
export const EVENT_STEPS: EventStep[] = [
  {
    key: 'propose',
    title: 'Propose the event: topic, format, date, budget',
    offset: -45,
    role: 'lead',
  },
  { key: 'validate', title: 'Board go/no-go', offset: -40, role: 'board' },
  {
    key: 'venue',
    title: 'Venue, host and sponsors confirmed',
    offset: -30,
    role: 'lead',
    hint: 'Add them under Hosts and sponsors on the event.',
  },
  {
    key: 'speakers',
    title: 'Speakers confirmed, with bios and photos',
    offset: -25,
    role: 'lead',
    hint: 'Add them under Speakers on the event.',
  },
  {
    key: 'page',
    title: 'Event page written, registration open',
    offset: -21,
    role: 'comms',
  },
  {
    key: 'proofread',
    title: 'Page proofread by a second person, then published',
    offset: -21,
    role: 'board',
  },
  {
    key: 'announce',
    title: 'Announce: LinkedIn, WhatsApp, newsletter, partners',
    offset: -21,
    role: 'comms',
    hint: 'Then a reminder post a week before and the day before.',
  },
  {
    key: 'registrations',
    title: 'Follow registrations and the waitlist, adjust capacity',
    offset: -2,
    role: 'lead',
  },
  {
    key: 'door',
    title: 'Check-in at the door and walk-ins',
    offset: 0,
    role: 'door',
    hint: 'Check-in screen on a phone; the day-before reminder is sent automatically.',
  },
  { key: 'photos', title: 'Photos during the event', offset: 0, role: 'comms' },
  {
    key: 'recap',
    title: 'Recap on the event page and blog write-up',
    offset: 7,
    role: 'comms',
    hint: 'The feedback email goes out automatically the day after.',
  },
  { key: 'thanks', title: 'Thank speakers, hosts and sponsors', offset: 10, role: 'lead' },
  {
    key: 'debrief',
    title: 'Debrief: numbers, feedback, what to change',
    offset: 14,
    role: 'lead',
    hint: 'Event stats and the Feedback page have the numbers.',
  },
];
const STEP_KEYS = new Set(EVENT_STEPS.map((s) => s.key));
export const stepByKey = (key: string) => EVENT_STEPS.find((s) => s.key === key);

/** Steps of events that started more than this long ago are no longer chased. */
const FOLLOW_DAYS = 15;

/** A step's due date: the Bangkok calendar day `offset` days from the event's start. */
export function dueDate(startsAt: Date, offset: number) {
  return new Date(startsAt.getTime() + offset * DAY_MS);
}

export type TaskState = 'done' | 'late' | 'soon' | 'later';
/** Done; late (due day passed); soon (due within 7 days); later. */
export function taskState(due: Date, doneAt: Date | null, now: Date): TaskState {
  if (doneAt) return 'done';
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
  if (day(due) < day(now)) return 'late';
  return due.getTime() - now.getTime() <= 7 * DAY_MS ? 'soon' : 'later';
}

/** The default owner for each role: the first team member (by name) who has it. */
export function defaultOwners(team: Pick<TeamMember, 'email' | 'roles'>[]) {
  const out = new Map<TeamRole, string>();
  for (const m of team)
    for (const r of m.roles) if (!out.has(r as TeamRole)) out.set(r as TeamRole, m.email);
  return out;
}

export async function loadTeam() {
  return getDb().select().from(teamMembers).orderBy(asc(teamMembers.name));
}

/** "Name" for a team email, or the email itself for someone not (or no longer) in the team. */
export function teamName(team: Pick<TeamMember, 'email' | 'name'>[], email: string | null) {
  if (!email) return '';
  return team.find((m) => m.email === email)?.name ?? email;
}

/**
 * Creates the missing checklist rows of these events, each owned by the default owner of its role
 * (rows that already exist, and their owners, are left alone).
 */
export async function ensureEventTasks(eventIds: number[], team?: TeamMember[]) {
  if (!eventIds.length) return;
  const db = getDb();
  const existing = await db
    .select({ eventId: eventTasks.eventId, step: eventTasks.step })
    .from(eventTasks)
    .where(inArray(eventTasks.eventId, eventIds));
  const have = new Set(existing.map((t) => `${t.eventId}:${t.step}`));
  const owners = defaultOwners(team ?? (await loadTeam()));
  const rows = eventIds.flatMap((eventId) =>
    EVENT_STEPS.filter((s) => !have.has(`${eventId}:${s.key}`)).map((s) => ({
      eventId,
      step: s.key,
      owner: owners.get(s.role) ?? null,
    })),
  );
  // D1 allows 100 bound values per statement: 3 per row.
  for (let i = 0; i < rows.length; i += 30)
    await db
      .insert(eventTasks)
      .values(rows.slice(i, i + 30))
      .onConflictDoNothing();
}

/**
 * Gives open, unowned steps of current events to the default owner of their role. Run when the
 * team changes, so checklists created before someone had the role get an owner.
 */
export async function fillUnownedTasks(now = new Date()) {
  const db = getDb();
  const owners = defaultOwners(await loadTeam());
  const rows = await db
    .select({ id: eventTasks.id, step: eventTasks.step })
    .from(eventTasks)
    .innerJoin(events, eq(events.id, eventTasks.eventId))
    .where(
      and(
        isNull(eventTasks.owner),
        isNull(eventTasks.doneAt),
        gte(events.startsAt, new Date(now.getTime() - FOLLOW_DAYS * DAY_MS)),
      ),
    );
  let n = 0;
  for (const r of rows) {
    const owner = owners.get(stepByKey(r.step)?.role as TeamRole);
    if (!owner) continue;
    await db.update(eventTasks).set({ owner, updatedAt: now }).where(eq(eventTasks.id, r.id));
    n++;
  }
  return n;
}

export interface OpenTask {
  id: number;
  step: string;
  title: string;
  owner: string | null;
  due: Date;
  state: TaskState;
  eventId: number;
  eventTitle: string;
}

/**
 * Open steps of current events (not cancelled, started at most FOLLOW_DAYS ago), soonest first.
 * With `owner`, only that person's.
 */
export async function openTasks(now: Date, owner?: string): Promise<OpenTask[]> {
  const db = getDb();
  const current = await db
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        ne(events.status, 'cancelled'),
        gte(events.startsAt, new Date(now.getTime() - FOLLOW_DAYS * DAY_MS)),
      ),
    );
  const ids = current.map((e) => e.id);
  if (!ids.length) return [];
  await ensureEventTasks(ids);
  const rows = await db
    .select({
      id: eventTasks.id,
      step: eventTasks.step,
      owner: eventTasks.owner,
      eventId: events.id,
      eventTitle: events.title,
      startsAt: events.startsAt,
    })
    .from(eventTasks)
    .innerJoin(events, eq(events.id, eventTasks.eventId))
    .where(
      and(
        inArray(eventTasks.eventId, ids),
        isNull(eventTasks.doneAt),
        owner ? eq(eventTasks.owner, owner) : undefined,
      ),
    );
  return rows
    .filter((r) => STEP_KEYS.has(r.step))
    .map((r) => {
      const step = stepByKey(r.step)!;
      const due = dueDate(r.startsAt, step.offset);
      return {
        id: r.id,
        step: r.step,
        title: step.title,
        owner: r.owner,
        due,
        state: taskState(due, null, now),
        eventId: r.eventId,
        eventTitle: r.eventTitle,
      };
    })
    .sort((a, b) => a.due.getTime() - b.due.getTime());
}

export const TaskAction = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('owner'),
    id: z.coerce.number().int().positive(),
    owner: z
      .string()
      .trim()
      .toLowerCase()
      .max(254)
      .transform((s) => s || null),
  }),
  z.object({ action: z.enum(['done', 'undo']), id: z.coerce.number().int().positive() }),
  z.object({
    action: z.literal('note'),
    id: z.coerce.number().int().positive(),
    note: z
      .string()
      .trim()
      .max(500)
      .transform((s) => s || null),
  }),
]);

/** Applies a checklist change on one event's step. */
export async function applyTaskAction(
  eventId: number,
  input: z.infer<typeof TaskAction>,
  actor: string,
) {
  const where = and(eq(eventTasks.id, input.id), eq(eventTasks.eventId, eventId));
  const now = new Date();
  const set =
    input.action === 'owner'
      ? { owner: input.owner }
      : input.action === 'note'
        ? { note: input.note }
        : input.action === 'done'
          ? { doneAt: now, doneBy: actor }
          : { doneAt: null, doneBy: null };
  await getDb()
    .update(eventTasks)
    .set({ ...set, updatedAt: now })
    .where(where);
}

/**
 * Monday morning: each team member gets their steps that are late or due in the coming week.
 * Returns how many emails went out.
 */
export async function sendOwnerDigests(now: Date) {
  const [team, tasks] = await Promise.all([loadTeam(), openTasks(now)]);
  let sent = 0;
  for (const m of team) {
    const mine = tasks.filter((t) => t.owner === m.email && t.state !== 'later');
    if (!mine.length) continue;
    const late = mine.filter((t) => t.state === 'late').length;
    await sendEmail({
      to: m.email,
      subject: `Your French Tech Bangkok tasks this week: ${mine.length}${late ? ` (${late} late)` : ''}`,
      paragraphs: [
        `Hi ${m.name.split(' ')[0]}, here is what is on your plate for the coming week.`,
        ...mine.map(
          (t) =>
            `${t.state === 'late' ? 'LATE: ' : ''}${t.eventTitle}: ${t.title} (due ${formatDate(t.due, { year: undefined })})`,
        ),
        'Tick a step as done on the event checklist in the admin, or hand it to someone else there.',
      ],
      action: { label: 'Open my tasks', url: siteUrl('/admin') },
    });
    sent++;
  }
  return sent;
}
