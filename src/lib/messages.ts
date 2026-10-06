// Contact-form messages: folders (status), actions from the admin, and blocked senders.
import { z } from 'zod';
import { asc, eq, inArray } from 'drizzle-orm';
import { getDb } from '../db';
import { blockedSenders, messageNotes, submissions, type Submission } from '../db/schema';

export type MessageStatus = Submission['status'];

export const FOLDERS: { status: MessageStatus; label: string }[] = [
  { status: 'new', label: 'Inbox' },
  { status: 'answered', label: 'Answered' },
  { status: 'handled', label: 'Handled' },
  { status: 'spam', label: 'Spam' },
  { status: 'deleted', label: 'Deleted' },
];

/** Webmail domains are shared by everyone, so they can only be blocked address by address. */
const SHARED_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'hotmail.fr',
  'live.com',
  'msn.com',
  'yahoo.com',
  'yahoo.fr',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'gmx.fr',
  'orange.fr',
  'free.fr',
  'laposte.net',
  'wanadoo.fr',
  'aol.com',
]);

export const domainOf = (email: string) => email.trim().toLowerCase().split('@')[1] ?? '';
export const canBlockDomain = (email: string) => {
  const d = domainOf(email);
  return d.includes('.') && !SHARED_DOMAINS.has(d);
};

/** The blocked pattern that matches this address, if any. */
export async function blockedBy(email: string) {
  const e = email.trim().toLowerCase();
  const patterns = [e, `@${domainOf(e)}`];
  const [hit] = await getDb()
    .select({ pattern: blockedSenders.pattern })
    .from(blockedSenders)
    .where(inArray(blockedSenders.pattern, patterns));
  return hit?.pattern ?? null;
}

const Pattern = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .regex(
    /^([^@\s]+@|@)[^@\s]+\.[^@\s]+$/,
    'Enter an address (name@example.com) or a domain (@example.com).',
  )
  .refine((p) => !p.startsWith('@') || !SHARED_DOMAINS.has(p.slice(1)), {
    message: 'That domain is shared by many people: block the address instead.',
  });

export const MessageAction = z.discriminatedUnion('action', [
  z.object({
    action: z.enum(['new', 'answered', 'handled', 'deleted']),
    ids: z.array(z.coerce.number().int().positive()).min(1).max(200),
  }),
  z.object({
    action: z.literal('spam'),
    ids: z.array(z.coerce.number().int().positive()).min(1).max(200),
    /** Also block the sender: 'address', 'domain' or nothing. */
    block: z.enum(['none', 'address', 'domain']).default('address'),
  }),
  z.object({
    action: z.literal('note'),
    ids: z.array(z.coerce.number().int().positive()).length(1),
    body: z.string().trim().min(1, 'Write a note first.').max(4000),
    /** Optionally file the message at the same time. */
    move: z.enum(['answered', 'handled']).optional(),
  }),
  z.object({
    action: z.literal('assign'),
    ids: z.array(z.coerce.number().int().positive()).min(1).max(200),
    /** A team member's email; empty = nobody. */
    assignee: z
      .string()
      .trim()
      .toLowerCase()
      .max(254)
      .transform((s) => s || null),
  }),
  z.object({ action: z.literal('block'), pattern: Pattern }),
  z.object({ action: z.literal('unblock'), pattern: z.string().trim().toLowerCase().max(254) }),
]);
export type MessageAction = z.infer<typeof MessageAction>;

const emailOf = (s: Pick<Submission, 'payload'>) =>
  typeof s.payload.email === 'string' ? s.payload.email.trim().toLowerCase() : '';

/** Applies an admin action. Returns a short confirmation for the page. */
export async function applyMessageAction(input: MessageAction, actor: string) {
  const db = getDb();
  if (input.action === 'block') {
    await db
      .insert(blockedSenders)
      .values({ pattern: input.pattern, createdBy: actor })
      .onConflictDoNothing();
    const moved = await moveBlockedToSpam(input.pattern, actor);
    return `Blocked ${input.pattern}${moved ? `; ${moved} message${moved === 1 ? '' : 's'} moved to Spam` : ''}.`;
  }
  if (input.action === 'unblock') {
    await db.delete(blockedSenders).where(eq(blockedSenders.pattern, input.pattern));
    return `Unblocked ${input.pattern}. Messages already in Spam stay there.`;
  }
  if (input.action === 'assign') {
    await db
      .update(submissions)
      .set({ assignee: input.assignee })
      .where(inArray(submissions.id, input.ids));
    const body = input.assignee ? `Assigned to ${input.assignee}` : 'Unassigned';
    await db.insert(messageNotes).values(
      input.ids.map((submissionId) => ({
        submissionId,
        kind: 'status' as const,
        body,
        author: actor,
      })),
    );
    const n = input.ids.length;
    return `${n} message${n === 1 ? '' : 's'} ${input.assignee ? `assigned to ${input.assignee}` : 'unassigned'}.`;
  }
  if (input.action === 'note') {
    await db
      .insert(messageNotes)
      .values({ submissionId: input.ids[0]!, body: input.body, author: actor });
    if (!input.move) return 'Note added.';
    await setStatus(input.ids, input.move, actor);
    return `Note added; message moved to ${folderLabel(input.move)}.`;
  }
  const status = input.action;
  const n = input.ids.length;
  const what = `${n} message${n === 1 ? '' : 's'}`;
  if (input.action !== 'spam' || input.block === 'none') {
    await setStatus(input.ids, status, actor);
    return `${what} moved to ${folderLabel(status)}.`;
  }
  const rows = await db
    .select({ payload: submissions.payload })
    .from(submissions)
    .where(inArray(submissions.id, input.ids));
  const patterns = new Set<string>();
  for (const r of rows) {
    const e = emailOf(r);
    if (!e.includes('@')) continue;
    patterns.add(input.block === 'domain' && canBlockDomain(e) ? `@${domainOf(e)}` : e);
  }
  await setStatus(
    input.ids,
    'spam',
    actor,
    patterns.size ? `blocked ${[...patterns].join(', ')}` : undefined,
  );
  for (const pattern of patterns) {
    await db.insert(blockedSenders).values({ pattern, createdBy: actor }).onConflictDoNothing();
    await moveBlockedToSpam(pattern, actor);
  }
  return `${what} moved to Spam${patterns.size ? `; blocked ${[...patterns].join(', ')}` : ''}.`;
}

/** Moves open messages from a newly blocked sender to Spam. Returns how many moved. */
async function moveBlockedToSpam(pattern: string, actor: string) {
  const db = getDb();
  const open = await db
    .select({ id: submissions.id, payload: submissions.payload })
    .from(submissions)
    .where(eq(submissions.status, 'new'));
  const ids = open
    .filter((s) => {
      const e = emailOf(s);
      return pattern.startsWith('@') ? e.endsWith(pattern) : e === pattern;
    })
    .map((s) => s.id);
  if (ids.length) await setStatus(ids, 'spam', actor, `sender ${pattern} blocked`);
  return ids.length;
}

export const folderLabel = (s: MessageStatus) => FOLDERS.find((f) => f.status === s)!.label;

/** Files messages in a folder and logs the move in each message's history. */
async function setStatus(ids: number[], status: MessageStatus, actor: string, why?: string) {
  const db = getDb();
  await db
    .update(submissions)
    .set({ status, handled: status !== 'new', statusAt: new Date(), statusBy: actor })
    .where(inArray(submissions.id, ids));
  const body = `Moved to ${folderLabel(status)}${why ? ` (${why})` : ''}`;
  await db
    .insert(messageNotes)
    .values(
      ids.map((submissionId) => ({ submissionId, kind: 'status' as const, body, author: actor })),
    );
}

/** Notes and moves for these messages, oldest first, grouped by message. */
export async function notesFor(ids: number[]) {
  const out = new Map<number, (typeof messageNotes.$inferSelect)[]>();
  if (!ids.length) return out;
  const rows = await getDb()
    .select()
    .from(messageNotes)
    .where(inArray(messageNotes.submissionId, ids))
    .orderBy(asc(messageNotes.createdAt), asc(messageNotes.id));
  for (const r of rows) out.set(r.submissionId, [...(out.get(r.submissionId) ?? []), r]);
  return out;
}

/** A mailto: link that opens a reply with the original message quoted. */
export function replyLink(s: Pick<Submission, 'payload' | 'createdAt'>) {
  const p = s.payload;
  const name = typeof p.name === 'string' ? p.name : '';
  const topic = typeof p.topic === 'string' && p.topic !== 'general' ? ` (${p.topic})` : '';
  const quoted = String(p.message ?? '')
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n');
  const date = s.createdAt.toISOString().slice(0, 10);
  const body = `Hello ${name.split(' ')[0] ?? ''},\n\n\n\nOn ${date}, ${name} wrote:\n${quoted}`;
  const subject = `Re: your message to La French Tech Bangkok${topic}`;
  return `mailto:${encodeURIComponent(emailOf(s))}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
