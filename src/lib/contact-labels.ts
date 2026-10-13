// Contacts > Tags and groups: the tags the team puts on contacts (short labels shown next to their
// name, such as Speaker or Investor) and groups (named lists of people, such as "Sponsors 2027
// prospects"). Contact cards store tag keys and group ids; both filter Contacts and Members, can
// be put on people in bulk, and can be picked as the audience in Email the community.
import { env } from 'cloudflare:workers';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db';
import { contactGroups, contactTags } from '../db/schema';
import { slugify } from './format';
import { audit } from './orgs';

export interface Tag {
  key: string;
  name: string;
}
export interface Group {
  id: number;
  name: string;
  description: string | null;
}
export interface Labels {
  tags: Tag[];
  groups: Group[];
  tagName: Map<string, string>;
  groupName: Map<number, string>;
}

const byName = <T extends { name: string }>(a: T, b: T) =>
  a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

/** Lookups for a list of tags and groups (sorted by name). */
export function labelsOf(tags: Tag[], groups: Group[]): Labels {
  const t = [...tags].sort(byName);
  const g = [...groups].sort(byName);
  return {
    tags: t,
    groups: g,
    tagName: new Map(t.map((x) => [x.key, x.name])),
    groupName: new Map(g.map((x) => [x.id, x.name])),
  };
}

/** Every tag and group, sorted by name. */
export async function loadLabels(): Promise<Labels> {
  const db = getDb();
  const [tags, groups] = await Promise.all([
    db.select({ key: contactTags.key, name: contactTags.name }).from(contactTags),
    db
      .select({
        id: contactGroups.id,
        name: contactGroups.name,
        description: contactGroups.description,
      })
      .from(contactGroups)
      .orderBy(asc(contactGroups.name)),
  ]);
  return labelsOf(tags, groups);
}

/** The tags and groups that still exist, from what a form posted (ids of deleted ones dropped). */
export const knownLabelsOnly = <T extends { tags: string[]; groups: number[] }>(
  input: T,
  labels: Labels,
): T => ({
  ...input,
  tags: input.tags.filter((t) => labels.tagName.has(t)),
  groups: input.groups.filter((g) => labels.groupName.has(g)),
});

/** Names of a contact's tags or groups, unknown ones left out. */
export const tagNames = (keys: string[], labels: Labels) =>
  keys.flatMap((k) => labels.tagName.get(k) ?? []);
export const groupNames = (ids: number[], labels: Labels) =>
  ids.flatMap((id) => labels.groupName.get(id) ?? []);

/** A tag key from its name: lowercase letters, digits and dashes, unique among `taken`. */
export function tagKey(name: string, taken: Set<string>) {
  const base = slugify(name).slice(0, 40) || 'tag';
  let key = base;
  for (let n = 2; taken.has(key); n++) key = `${base}-${n}`;
  return key;
}

export const TagNameSchema = z
  .string()
  .trim()
  .min(1, 'Give the tag a name.')
  .max(40, 'Keep the tag name under 40 characters.');

export const GroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Give the group a name.')
    .max(80, 'Keep the group name under 80 characters.'),
  description: z
    .string()
    .max(500)
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : null)),
});

const sameName = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base' }) === 0;

type Done = { ok: true } | { ok: false; error: string };

export async function createTag(name: string, actor: string): Promise<Done> {
  const { tags } = await loadLabels();
  if (tags.some((t) => sameName(t.name, name)))
    return { ok: false, error: `There is already a tag “${name}”.` };
  const key = tagKey(name, new Set(tags.map((t) => t.key)));
  await getDb().insert(contactTags).values({ key, name });
  await audit(actor, 'contact_tag_create', 'contact_tag', null, null, { key, name });
  return { ok: true };
}

export async function renameTag(key: string, name: string, actor: string): Promise<Done> {
  const { tags } = await loadLabels();
  const tag = tags.find((t) => t.key === key);
  if (!tag) return { ok: false, error: 'This tag no longer exists.' };
  if (tags.some((t) => t.key !== key && sameName(t.name, name)))
    return { ok: false, error: `There is already a tag “${name}”.` };
  await getDb().update(contactTags).set({ name }).where(eq(contactTags.key, key));
  await audit(actor, 'contact_tag_rename', 'contact_tag', null, tag, { key, name });
  return { ok: true };
}

/** Deletes a tag and takes it off every contact. */
export async function deleteTag(key: string, actor: string) {
  const [tag] = await getDb().select().from(contactTags).where(eq(contactTags.key, key));
  if (!tag) return;
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE contacts SET tags = (SELECT json_group_array(value) FROM json_each(contacts.tags) WHERE value <> ?)
       WHERE EXISTS (SELECT 1 FROM json_each(contacts.tags) WHERE value = ?)`,
    ).bind(key, key),
    env.DB.prepare('DELETE FROM contact_tags WHERE key = ?').bind(key),
  ]);
  await audit(actor, 'contact_tag_delete', 'contact_tag', null, tag, null);
}

export async function createGroup(input: z.infer<typeof GroupSchema>, actor: string) {
  const [row] = await getDb()
    .insert(contactGroups)
    .values(input)
    .returning({ id: contactGroups.id });
  await audit(actor, 'contact_group_create', 'contact_group', row!.id, null, input);
  return row!.id;
}

export async function updateGroup(id: number, input: z.infer<typeof GroupSchema>, actor: string) {
  const [before] = await getDb().select().from(contactGroups).where(eq(contactGroups.id, id));
  if (!before) return;
  await getDb()
    .update(contactGroups)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(contactGroups.id, id));
  await audit(actor, 'contact_group_update', 'contact_group', id, before, input);
}

/** Deletes a group and takes everyone out of it (the people stay in Contacts). */
export async function deleteGroup(id: number, actor: string) {
  const [group] = await getDb().select().from(contactGroups).where(eq(contactGroups.id, id));
  if (!group) return;
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE contacts SET groups = (SELECT json_group_array(value) FROM json_each(contacts.groups) WHERE value <> ?)
       WHERE EXISTS (SELECT 1 FROM json_each(contacts.groups) WHERE value = ?)`,
    ).bind(id, id),
    env.DB.prepare('DELETE FROM contact_groups WHERE id = ?').bind(id),
  ]);
  await audit(actor, 'contact_group_delete', 'contact_group', id, group, null);
}
