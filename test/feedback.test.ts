import { describe, expect, it } from 'vitest';
import { feedbackDue } from '../src/lib/cron-events';
import { renderEmail } from '../src/lib/email';
import { FeedbackSchema, feedbackEmail, feedbackSummary, formatRating } from '../src/lib/feedback';

// The cron runs at 09:00 Bangkok = 02:00 UTC.
const now = new Date('2026-11-05T02:00:00Z'); // Thursday 5 Nov, 09:00 Bangkok
const ev = (startsAt: string, endsAt: string | null = null, status = 'published') => ({
  status,
  startsAt: new Date(startsAt),
  endsAt: endsAt ? new Date(endsAt) : null,
});

describe('feedbackDue', () => {
  it('is due for an event that ended yesterday (Bangkok date)', () => {
    // 4 Nov 18:30 to 21:00 Bangkok.
    expect(feedbackDue(ev('2026-11-04T11:30:00Z', '2026-11-04T14:00:00Z'), now)).toBe(true);
  });

  it('uses the end time, in Bangkok time', () => {
    // Ends 4 Nov 23:59 Bangkok (16:59 UTC): yesterday. Ends 5 Nov 00:30 Bangkok: today.
    expect(feedbackDue(ev('2026-11-04T12:00:00Z', '2026-11-04T16:59:00Z'), now)).toBe(true);
    expect(feedbackDue(ev('2026-11-04T12:00:00Z', '2026-11-04T17:30:00Z'), now)).toBe(false);
    // Starts 3 Nov, ends 4 Nov: due once, the day after it ends.
    expect(feedbackDue(ev('2026-11-03T02:00:00Z', '2026-11-04T10:00:00Z'), now)).toBe(true);
  });

  it('falls back to the start time when there is no end time', () => {
    expect(feedbackDue(ev('2026-11-04T11:30:00Z'), now)).toBe(true);
    // 4 Nov 01:00 Bangkok is still 4 Nov, though it is 3 Nov in UTC.
    expect(feedbackDue(ev('2026-11-03T18:00:00Z'), now)).toBe(true);
  });

  it('is still due two days after, so a failed run is retried the next morning', () => {
    expect(feedbackDue(ev('2026-11-03T11:30:00Z', '2026-11-03T14:00:00Z'), now)).toBe(true);
  });

  it('is not due the day of, three days after, or before the event', () => {
    expect(feedbackDue(ev('2026-11-05T01:00:00Z'), now)).toBe(false); // this morning
    expect(feedbackDue(ev('2026-11-02T11:30:00Z', '2026-11-02T14:00:00Z'), now)).toBe(false);
    expect(feedbackDue(ev('2026-11-05T11:30:00Z'), now)).toBe(false);
  });

  it('skips cancelled and draft events', () => {
    expect(feedbackDue(ev('2026-11-04T11:30:00Z', null, 'cancelled'), now)).toBe(false);
    expect(feedbackDue(ev('2026-11-04T11:30:00Z', null, 'draft'), now)).toBe(false);
  });
});

describe('feedbackSummary', () => {
  it('counts responses, average, distribution and comments', () => {
    const s = feedbackSummary([
      { rating: 5, comment: 'Great talk' },
      { rating: 4, comment: '  ' },
      { rating: 5, comment: null },
      { rating: 3 },
    ]);
    expect(s.responses).toBe(4);
    expect(s.average).toBe(4.25);
    expect(s.distribution).toEqual([0, 0, 1, 1, 2]);
    expect(s.comments).toBe(1);
    expect(formatRating(s.average)).toBe('4.3');
  });

  it('handles no feedback and ignores out-of-range ratings', () => {
    expect(feedbackSummary([])).toEqual({
      responses: 0,
      average: null,
      distribution: [0, 0, 0, 0, 0],
      comments: 0,
    });
    expect(feedbackSummary([{ rating: 0 }, { rating: 6 }, { rating: 2 }]).average).toBe(2);
    expect(formatRating(null)).toBe('–');
  });
});

describe('FeedbackSchema', () => {
  it('accepts a rating with an optional comment', () => {
    expect(FeedbackSchema.parse({ rating: '4', comment: '  Nice  ' })).toEqual({
      rating: 4,
      comment: 'Nice',
    });
    expect(FeedbackSchema.parse({ rating: '1', comment: '' })).toEqual({
      rating: 1,
      comment: null,
    });
  });

  it('rejects bad ratings and long comments', () => {
    for (const rating of ['0', '6', '2.5', 'x', undefined]) {
      expect(FeedbackSchema.safeParse({ rating }).success).toBe(false);
    }
    expect(FeedbackSchema.safeParse({ rating: '3', comment: 'a'.repeat(2001) }).success).toBe(
      false,
    );
  });
});

describe('feedbackEmail', () => {
  it('has five one-click rating links with the registration token', () => {
    const m = feedbackEmail(
      { slug: 'connect-nov', title: 'French Tech Connect' },
      { name: 'Ana', email: 'ana@example.com', token: 'tok123' },
    );
    expect(m.to).toBe('ana@example.com');
    const urls = m.choices!.options.map((o) => o.url);
    expect(urls).toHaveLength(5);
    expect(urls[0]).toMatch(/\/events\/connect-nov\/feedback\?token=tok123&rating=1$/);
    expect(urls[4]).toMatch(/rating=5$/);
    const { html, text } = renderEmail(m);
    expect(html).toContain('feedback?token=tok123&amp;rating=3');
    expect(text).toContain('5: Excellent: ');
  });
});
