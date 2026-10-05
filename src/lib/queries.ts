import { and, asc, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { getDb } from '../db';
import {
  categories,
  eventSpeakers,
  eventSponsors,
  events,
  organisations,
  people,
  postCategories,
  posts,
  type PostAuthor,
} from '../db/schema';
import { type SponsorWithOrg } from './sponsors';

const nowDate = () => new Date();

// ---------- events ----------

export async function upcomingEvents(limit?: number) {
  const q = getDb()
    .select()
    .from(events)
    .where(
      and(
        inArray(events.status, ['published', 'cancelled']),
        gte(sql`coalesce(${events.endsAt}, ${events.startsAt})`, Math.floor(Date.now() / 1000)),
      ),
    )
    .orderBy(asc(events.startsAt));
  return limit ? q.limit(limit) : q;
}

export async function pastEvents() {
  return getDb()
    .select()
    .from(events)
    .where(
      and(
        inArray(events.status, ['published', 'cancelled']),
        lt(sql`coalesce(${events.endsAt}, ${events.startsAt})`, Math.floor(Date.now() / 1000)),
      ),
    )
    .orderBy(desc(events.startsAt));
}

export async function eventBySlug(slug: string) {
  const [e] = await getDb()
    .select()
    .from(events)
    .where(and(eq(events.slug, slug), inArray(events.status, ['published', 'cancelled'])))
    .limit(1);
  return e ?? null;
}

export function isUpcoming(e: { startsAt: Date; endsAt: Date | null }) {
  return (e.endsAt ?? e.startsAt) >= nowDate();
}

// ---------- blog ----------

const publishedPost = () =>
  and(eq(posts.status, 'published'), lt(posts.publishedAt, new Date(Date.now() + 1000)));

export async function latestPosts(limit = 3) {
  return getDb()
    .select()
    .from(posts)
    .where(publishedPost())
    .orderBy(desc(posts.publishedAt))
    .limit(limit);
}

export async function allPosts(categorySlug?: string) {
  const db = getDb();
  if (!categorySlug) {
    return db.select().from(posts).where(publishedPost()).orderBy(desc(posts.publishedAt));
  }
  const rows = await db
    .select({ post: posts })
    .from(posts)
    .innerJoin(postCategories, eq(postCategories.postId, posts.id))
    .innerJoin(categories, eq(categories.id, postCategories.categoryId))
    .where(and(publishedPost(), eq(categories.slug, categorySlug)))
    .orderBy(desc(posts.publishedAt));
  return rows.map((r) => r.post);
}

export async function postBySlug(slug: string) {
  const [p] = await getDb()
    .select()
    .from(posts)
    .where(and(eq(posts.slug, slug), publishedPost()))
    .limit(1);
  return p ?? null;
}

export async function publishedPostById(id: number) {
  const [p] = await getDb()
    .select()
    .from(posts)
    .where(and(eq(posts.id, id), publishedPost()))
    .limit(1);
  return p ?? null;
}

/** The ids among `ids` of posts that are published (for recaps that link a write-up). */
export async function publishedPostIds(ids: number[]) {
  if (!ids.length) return new Set<number>();
  const rows = await getDb()
    .select({ id: posts.id })
    .from(posts)
    .where(and(inArray(posts.id, ids), publishedPost()));
  return new Set(rows.map((r) => r.id));
}

export async function categoriesWithCounts() {
  return getDb()
    .select({
      slug: categories.slug,
      name: categories.name,
      count: sql<number>`count(${posts.id})`,
    })
    .from(categories)
    .leftJoin(postCategories, eq(postCategories.categoryId, categories.id))
    .leftJoin(posts, and(eq(posts.id, postCategories.postId), eq(posts.status, 'published')))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function categoriesForPost(postId: number) {
  return getDb()
    .select({ slug: categories.slug, name: categories.name, id: categories.id })
    .from(categories)
    .innerJoin(postCategories, eq(postCategories.categoryId, categories.id))
    .where(eq(postCategories.postId, postId));
}

/** Category names of every post, in menu order, for post cards. */
export async function postCategoryNames() {
  const rows = await getDb()
    .select({ postId: postCategories.postId, name: categories.name })
    .from(postCategories)
    .innerJoin(categories, eq(categories.id, postCategories.categoryId))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  const byPost = new Map<number, string[]>();
  for (const r of rows) byPost.set(r.postId, [...(byPost.get(r.postId) ?? []), r.name]);
  return byPost;
}

/** Posts sharing a category first, then the latest ones. */
export async function relatedPosts(postId: number, categoryIds: number[], limit = 3) {
  const db = getDb();
  const same = categoryIds.length
    ? (
        await db
          .selectDistinct({ post: posts })
          .from(posts)
          .innerJoin(postCategories, eq(postCategories.postId, posts.id))
          .where(and(publishedPost(), inArray(postCategories.categoryId, categoryIds)))
          .orderBy(desc(posts.publishedAt))
          .limit(limit + 1)
      ).map((r) => r.post)
    : [];
  const out = same.filter((p) => p.id !== postId);
  if (out.length < limit) {
    for (const p of await latestPosts(limit + 1)) {
      if (p.id !== postId && !out.some((o) => o.id === p.id)) out.push(p);
    }
  }
  return out.slice(0, limit);
}

// ---------- directory ----------

export async function publishedOrganisations() {
  return getDb()
    .select()
    .from(organisations)
    .where(eq(organisations.status, 'published'))
    .orderBy(asc(organisations.name));
}

export async function organisationCounts() {
  const rows = await getDb()
    .select({ category: organisations.category, n: sql<number>`count(*)` })
    .from(organisations)
    .where(eq(organisations.status, 'published'))
    .groupBy(organisations.category);
  return Object.fromEntries(rows.map((r) => [r.category, r.n])) as Record<string, number>;
}

/** Sponsors and board companies with a logo first, for the home page. */
export async function featuredOrganisations(limit = 6) {
  const all = await publishedOrganisations();
  const score = (o: (typeof all)[number]) =>
    (o.memberStatus === 'member' ? 4 : 0) +
    (o.badges.includes('sponsor') ? 3 : 0) +
    (o.badges.includes('board') ? 2 : 0) +
    (o.logoKey ? 1 : 0);
  return all
    .filter((o) => o.category !== 'institution')
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit);
}

// ---------- people ----------

export async function peopleByGroup(group: 'board' | 'institutional' | 'speaker') {
  return getDb()
    .select()
    .from(people)
    .where(eq(people.group, group))
    .orderBy(asc(people.sortOrder), asc(people.name));
}

/** An event's speakers, in the order set in the admin. */
export async function speakersForEvent(eventId: number) {
  return getDb()
    .select({
      id: people.id,
      name: people.name,
      title: people.title,
      organisationName: people.organisationName,
      linkedin: people.linkedin,
      photoKey: people.photoKey,
      group: people.group,
      talkTitle: eventSpeakers.talkTitle,
    })
    .from(eventSpeakers)
    .innerJoin(people, eq(people.id, eventSpeakers.personId))
    .where(eq(eventSpeakers.eventId, eventId))
    .orderBy(asc(eventSpeakers.sortOrder), asc(people.name));
}

/** Hosts, sponsors and partners of an event, in page order, with their linked organisation. */
export async function sponsorsForEvent(eventId: number): Promise<SponsorWithOrg[]> {
  return getDb()
    .select({
      id: eventSponsors.id,
      role: eventSponsors.role,
      organisationId: eventSponsors.organisationId,
      name: eventSponsors.name,
      logoKey: eventSponsors.logoKey,
      url: eventSponsors.url,
      orgName: organisations.name,
      orgSlug: organisations.slug,
      orgLogoKey: organisations.logoKey,
      orgWebsite: organisations.website,
      orgStatus: organisations.status,
    })
    .from(eventSponsors)
    .leftJoin(organisations, eq(organisations.id, eventSponsors.organisationId))
    .where(eq(eventSponsors.eventId, eventId))
    .orderBy(asc(eventSponsors.sortOrder), asc(eventSponsors.id));
}

/**
 * People who spoke at past published events, each once, most recent talk first, with the event
 * of that talk ("Speakers we've hosted" on About).
 */
export async function hostedSpeakers(limit: number) {
  const now = Math.floor(Date.now() / 1000);
  const rows = await getDb()
    .select({
      id: people.id,
      name: people.name,
      title: people.title,
      organisationName: people.organisationName,
      linkedin: people.linkedin,
      photoKey: people.photoKey,
      eventTitle: events.title,
      eventSlug: events.slug,
      startsAt: events.startsAt,
    })
    .from(eventSpeakers)
    .innerJoin(people, eq(people.id, eventSpeakers.personId))
    .innerJoin(events, eq(events.id, eventSpeakers.eventId))
    .where(
      and(
        eq(events.status, 'published'),
        lt(sql`coalesce(${events.endsAt}, ${events.startsAt})`, now),
      ),
    )
    .orderBy(desc(events.startsAt), asc(eventSpeakers.sortOrder));
  const seen = new Set<number>();
  return rows.filter((r) => !seen.has(r.id) && seen.add(r.id)).slice(0, limit);
}

/** Post authors matched with the board or institutional people of the same name (photo, LinkedIn). */
export async function peopleFor(authors: PostAuthor[]) {
  if (!authors.length) return [];
  const all = await getDb().select().from(people);
  return authors.map((a) => {
    const person = all.find((p) => p.name.toLowerCase() === a.name.toLowerCase()) ?? null;
    return {
      name: a.name,
      role: a.role ?? null,
      url: a.url || person?.linkedin || null,
      photoKey: person?.photoKey ?? null,
    };
  });
}
