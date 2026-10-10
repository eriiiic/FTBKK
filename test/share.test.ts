import { describe, expect, it } from 'vitest';
import {
  defaultLaunchAt,
  defaultReminderAt,
  eventLaunchText,
  eventReminderText,
  eventShareSpec,
  linkedinText,
  postLaunchText,
  postShareSpec,
  ScheduleSchema,
  shareFingerprint,
  shareImageFor,
  shareImageKey,
  whatsappLink,
} from '../src/lib/share';
import { clampLines, wrapText } from '../src/lib/share-image-client';
import { linkedinVersion, reminderStillValid } from '../src/lib/social';

const event = {
  id: 7,
  title: 'French Tech Connect #53',
  series: 'French Tech Connect',
  startsAt: new Date('2026-11-05T11:30:00Z'), // 18:30 Bangkok
  venue: 'True Digital Park',
  coverKey: null,
  summary: 'Meet the French tech community.',
};
const covers = { connect: null, talk: null, select: null };

describe('share image spec', () => {
  it('describes an event: label, date line, venue, default cover', () => {
    expect(eventShareSpec(event, covers)).toEqual({
      entity: 'event',
      id: 7,
      label: 'French Tech Connect',
      title: 'French Tech Connect #53',
      lines: ['Thu, 5 November 2026 · 18:30', 'True Digital Park'],
      photo: '/brand/events/connect.jpg',
    });
    const other = eventShareSpec({ ...event, series: 'Other', venue: null }, covers);
    expect(other.label).toBe('Event');
    expect(other.lines).toHaveLength(1);
    expect(other.photo).toBe('/brand/hero-bangkok.jpg');
  });

  it('describes a post: Blog label, byline and date', () => {
    const spec = postShareSpec({
      id: 3,
      title: 'Tech Pulse #4',
      authorName: 'Camille',
      publishedAt: new Date('2026-10-01T03:00:00Z'),
      coverKey: 'posts/a b.jpg',
    });
    expect(spec.label).toBe('Blog');
    expect(spec.lines).toEqual(['Camille · 1 October 2026']);
    expect(spec.photo).toBe('/media/posts/a%20b.jpg');
  });

  it('changes the fingerprint when anything drawn changes', async () => {
    const a = await shareFingerprint(eventShareSpec(event, covers));
    expect(a).toMatch(/^[0-9a-f]{10}$/);
    expect(await shareFingerprint(eventShareSpec(event, covers))).toBe(a);
    const moved = { ...event, startsAt: new Date('2026-11-06T11:30:00Z') };
    expect(await shareFingerprint(eventShareSpec(moved, covers))).not.toBe(a);
    const spec = eventShareSpec(event, covers);
    const key = shareImageKey(spec, a);
    expect(key).toBe(`share/event-7-${a}.jpg`);
    expect(shareImageFor(key, a)).toBe(`/media/share/event-7-${a}.jpg`);
    expect(shareImageFor(key, '0000000000')).toBeNull();
    expect(shareImageFor(null, a)).toBeNull();
  });
});

describe('social post texts', () => {
  const url = 'https://x.test/events/c53';
  it('builds the announcement, the reminder and the blog post', () => {
    expect(eventLaunchText(event, url)).toBe(
      `French Tech Connect #53\nThu, 5 November 2026 · 18:30, True Digital Park\n\nMeet the French tech community.\n\nRegister: ${url}`,
    );
    expect(eventReminderText(event, url)).toBe(
      `Tomorrow: French Tech Connect #53\n18:30, True Digital Park\n\nNot registered yet? ${url}`,
    );
    expect(postLaunchText({ title: 'T', excerpt: null }, url)).toBe(
      `New on our blog: T\n\nRead it: ${url}`,
    );
  });

  it('escapes LinkedIn markup characters', () => {
    expect(linkedinText('Connect #53 (Bangkok) @hub')).toBe('Connect \\#53 \\(Bangkok\\) \\@hub');
  });

  it('opens WhatsApp with the text', () => {
    expect(whatsappLink('a b&c')).toBe('https://wa.me/?text=a%20b%26c');
  });
});

describe('schedule', () => {
  it('defaults to the next full hour and 09:00 Bangkok the day before', () => {
    expect(defaultLaunchAt(new Date('2026-10-07T08:44:00Z')).toISOString()).toBe(
      '2026-10-07T09:00:00.000Z',
    );
    expect(defaultLaunchAt(new Date('2026-10-07T08:59:30Z')).toISOString()).toBe(
      '2026-10-07T10:00:00.000Z',
    );
    // Event on 5 Nov 00:30 Bangkok: reminder on 4 Nov 09:00 Bangkok = 02:00 UTC.
    expect(defaultReminderAt(new Date('2026-11-04T17:30:00Z')).toISOString()).toBe(
      '2026-11-04T02:00:00.000Z',
    );
    expect(defaultReminderAt(event.startsAt).toISOString()).toBe('2026-11-04T02:00:00.000Z');
  });

  it('keeps a reminder only while the event is within 36 hours', () => {
    const now = new Date('2026-11-04T02:00:00Z');
    expect(reminderStillValid(event.startsAt, now)).toBe(true);
    expect(reminderStillValid(new Date('2026-11-12T11:30:00Z'), now)).toBe(false);
    expect(reminderStillValid(new Date('2026-11-03T11:30:00Z'), now)).toBe(false);
  });

  it('validates the form', () => {
    const ok = ScheduleSchema.safeParse({
      networks: ['linkedin', 'whatsapp'],
      launch: true,
      launchAt: '2026-10-10T09:00',
      launchText: ' Hello ',
      reminder: false,
    });
    expect(ok.success && ok.data).toEqual({
      networks: ['linkedin', 'whatsapp'],
      posts: [{ kind: 'launch', at: new Date('2026-10-10T02:00:00Z'), text: 'Hello' }],
    });
    const bad = ScheduleSchema.safeParse({
      networks: [],
      launch: true,
      launchAt: '',
      launchText: '',
    });
    expect(bad.success).toBe(false);
    const paths = bad.error!.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(['networks', 'launchAt', 'launchText']));
    expect(ScheduleSchema.safeParse({ networks: ['facebook'] }).success).toBe(false);
  });

  it('uses a LinkedIn API version from two months ago', () => {
    expect(linkedinVersion(new Date('2026-10-07T00:00:00Z'))).toBe('202608');
    expect(linkedinVersion(new Date('2026-01-15T00:00:00Z'))).toBe('202511');
  });
});

describe('share image text layout', () => {
  const measure = (s: string) => s.length * 10;
  it('wraps words, and cuts words longer than a line', () => {
    expect(wrapText(measure, 'one two three four', 90)).toEqual(['one two', 'three', 'four']);
    // Thai has no spaces: broken between words, never inside a syllable's marks.
    const thai = wrapText(measure, 'สวัสดีครับทุกคน', 60);
    expect(thai.join('')).toBe('สวัสดีครับทุกคน');
    expect(thai.length).toBeGreaterThan(1);
    expect(thai.every((l) => !/^[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/.test(l))).toBe(true);
    expect(wrapText(measure, 'abcdefghij', 40)).toEqual(['abcd', 'efgh', 'ij']);
  });

  it('ends the last kept line with an ellipsis', () => {
    expect(clampLines(measure, ['aaaa', 'bbbb', 'cccc'], 2, 50)).toEqual(['aaaa', 'bbbb…']);
    expect(clampLines(measure, ['aaaa'], 2, 50)).toEqual(['aaaa']);
  });
});
