import { z } from 'zod';
import { optionalText, optionalUrl } from './forms';

// Speakers of an event: people (any group) linked to the event with an optional talk title.
// Pure helpers (no bindings) so they can be unit tested; queries are in queries.ts.

export const MAX_SPEAKERS = 30;
/** How many people "Speakers we've hosted" on About lists. */
export const HOSTED_SPEAKERS_LIMIT = 24;

const list = (len: number) => z.array(z.string().max(len)).max(MAX_SPEAKERS).default([]);
const optionalId = z
  .union([z.literal(''), z.coerce.number().int().positive()])
  .optional()
  .transform((v) => (v ? v : null));

/** The speakers form of the event editor (use formToObject(form, SPEAKER_ARRAYS)). */
export const SpeakersFormSchema = z
  .object({
    speakerId: list(12),
    speakerTalk: list(200),
    speakerRemove: list(12),
    /** Link someone already in People... */
    addPersonId: optionalId,
    /** ...or create a new person in the Speakers group. */
    newName: z
      .string()
      .max(120)
      .optional()
      .transform((s) => (s ? s : null))
      .refine((s) => s === null || s.length >= 2, 'Enter a name.'),
    newTitle: optionalText(120),
    newCompany: optionalText(120),
    newLinkedin: optionalUrl(),
    addTalkTitle: optionalText(200),
  })
  .refine((d) => !(d.addPersonId && d.newName), {
    message: 'Pick someone from the list or add a new speaker, not both.',
    path: ['addPersonId'],
  });
export type SpeakersForm = z.infer<typeof SpeakersFormSchema>;
export const SPEAKER_ARRAYS = ['speakerId', 'speakerTalk', 'speakerRemove'];

export interface SpeakerLink {
  personId: number;
  talkTitle: string | null;
  sortOrder: number;
}

/**
 * The event's new speaker list from the form: the current speakers in the order the form lists
 * them (with their edited talk titles, minus the removed ones), then the one being added. Only
 * people who exist are linked, each once. Speakers missing from the form (added by another admin
 * meanwhile) are kept at the end.
 */
export function planSpeakers(
  prev: { personId: number; talkTitle: string | null }[],
  form: SpeakersForm,
  exists: (personId: number) => boolean,
  added: number | null = form.addPersonId,
): SpeakerLink[] {
  const prevIds = new Set(prev.map((s) => s.personId));
  const removed = new Set(form.speakerRemove.map(Number));
  const seen = new Set<number>();
  const out: { personId: number; talkTitle: string | null }[] = [];
  form.speakerId.forEach((raw, i) => {
    const personId = Number(raw);
    if (!prevIds.has(personId) || seen.has(personId)) return;
    seen.add(personId);
    if (removed.has(personId)) return;
    out.push({ personId, talkTitle: form.speakerTalk[i]?.trim() || null });
  });
  for (const s of prev) {
    if (seen.has(s.personId) || removed.has(s.personId)) continue;
    seen.add(s.personId);
    out.push(s);
  }
  if (added && exists(added)) {
    const talkTitle = form.addTalkTitle;
    const already = out.find((s) => s.personId === added);
    if (already) already.talkTitle = talkTitle ?? already.talkTitle;
    else out.push({ personId: added, talkTitle });
  }
  return out
    .filter((s) => exists(s.personId))
    .slice(0, MAX_SPEAKERS)
    .map((s, sortOrder) => ({ ...s, sortOrder }));
}

/** "Head of Growth, Acme" for the speaker picker and the event page. */
export function personLine(p: { title: string | null; organisationName: string | null }) {
  return [p.title, p.organisationName].filter(Boolean).join(', ');
}
