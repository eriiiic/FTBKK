import { z } from 'zod';
import { optionalText, optionalUrl } from './forms';

// Speakers of an event: people (any group) linked to the event with an optional talk title, role
// on stage (speaker, moderator...) and a short bio written for this event.
// Pure helpers (no bindings) so they can be unit tested; queries are in queries.ts.

export const MAX_SPEAKERS = 30;
export const MAX_SPEAKER_BIO = 400;

/** Role on stage, shown as a label on the speaker card. Empty means "Speaker". */
export const SPEAKER_ROLES = ['speaker', 'keynote', 'moderator', 'panelist', 'host'] as const;
export type SpeakerRole = (typeof SPEAKER_ROLES)[number];
export const SPEAKER_ROLE_LABELS: Record<SpeakerRole, string> = {
  speaker: 'Speaker',
  keynote: 'Keynote speaker',
  moderator: 'Moderator',
  panelist: 'Panelist',
  host: 'Host',
};
export function speakerRoleLabel(role: string | null | undefined) {
  return SPEAKER_ROLE_LABELS[role as SpeakerRole] ?? SPEAKER_ROLE_LABELS.speaker;
}
const role = z
  .union([z.literal(''), z.enum(SPEAKER_ROLES)])
  .optional()
  .transform((v) => (v && v !== 'speaker' ? v : null));
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
    speakerRole: z
      .array(z.union([z.literal(''), z.enum(SPEAKER_ROLES)]))
      .max(MAX_SPEAKERS)
      .default([]),
    speakerBio: list(MAX_SPEAKER_BIO),
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
    addRole: role,
    addBio: optionalText(MAX_SPEAKER_BIO),
  })
  .refine((d) => !(d.addPersonId && d.newName), {
    message: 'Pick someone from the list or add a new speaker, not both.',
    path: ['addPersonId'],
  });
export type SpeakersForm = z.infer<typeof SpeakersFormSchema>;
export const SPEAKER_ARRAYS = [
  'speakerId',
  'speakerTalk',
  'speakerRole',
  'speakerBio',
  'speakerRemove',
];

/** What the event stores about one of its speakers. */
export interface SpeakerDetails {
  personId: number;
  talkTitle: string | null;
  role: SpeakerRole | null;
  bio: string | null;
}
export interface SpeakerLink extends SpeakerDetails {
  sortOrder: number;
}

/**
 * The event's new speaker list from the form: the current speakers in the order the form lists
 * them (with their edited talk titles, roles and bios, minus the removed ones), then the one being added. Only
 * people who exist are linked, each once. Speakers missing from the form (added by another admin
 * meanwhile) are kept at the end.
 */
export function planSpeakers(
  prev: SpeakerDetails[],
  form: SpeakersForm,
  exists: (personId: number) => boolean,
  added: number | null = form.addPersonId,
): SpeakerLink[] {
  const prevIds = new Set(prev.map((s) => s.personId));
  const removed = new Set(form.speakerRemove.map(Number));
  const seen = new Set<number>();
  const out: SpeakerDetails[] = [];
  form.speakerId.forEach((raw, i) => {
    const personId = Number(raw);
    if (!prevIds.has(personId) || seen.has(personId)) return;
    seen.add(personId);
    if (removed.has(personId)) return;
    const r = form.speakerRole[i];
    out.push({
      personId,
      talkTitle: form.speakerTalk[i]?.trim() || null,
      role: r && r !== 'speaker' ? r : null,
      bio: form.speakerBio[i]?.trim() || null,
    });
  });
  for (const s of prev) {
    if (seen.has(s.personId) || removed.has(s.personId)) continue;
    seen.add(s.personId);
    out.push(s);
  }
  if (added && exists(added)) {
    const { addTalkTitle: talkTitle, addRole: role, addBio: bio } = form;
    const already = out.find((s) => s.personId === added);
    if (already) {
      already.talkTitle = talkTitle ?? already.talkTitle;
      already.role = role ?? already.role;
      already.bio = bio ?? already.bio;
    } else out.push({ personId: added, talkTitle, role, bio });
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
