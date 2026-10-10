import { z } from 'zod';
import { DAY_MS } from './lifecycle';

// The time period picked on Reports (?period=…, &from=…&to=… for custom dates), and the time
// buckets its charts use. Bangkok is UTC+7 all year: dates are read as Bangkok days.

export const PERIODS = {
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '12m': 'Last 12 months',
  'this-year': 'This year',
  'last-year': 'Last year',
  all: 'All time',
  custom: 'Custom dates',
} as const;
export type PeriodKey = keyof typeof PERIODS;
export const DEFAULT_PERIOD: PeriodKey = '12m';

export interface Period {
  key: PeriodKey;
  from: Date;
  /** Exclusive end. */
  to: Date;
  /** "Last 90 days", "1 Jan 2025 – 31 Mar 2025"… */
  label: string;
  /** The same length just before, to compare with; null for All time. */
  previous: { from: Date; to: Date; label: string } | null;
  /** The values the filter form shows (YYYY-MM-DD, Bangkok). */
  fromInput: string;
  toInput: string;
}

const OFFSET = 7 * 3600 * 1000;
/** Midnight Bangkok of a UTC calendar date. */
const bkkMidnight = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d) - OFFSET);
const bkk = (d: Date) => new Date(d.getTime() + OFFSET);
export const dayInput = (d: Date) => bkk(d).toISOString().slice(0, 10);
const startOfDay = (d: Date) => {
  const b = bkk(d);
  return bkkMidnight(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
};
const dayLabel = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Bangkok',
});
const rangeLabel = (from: Date, to: Date) =>
  `${dayLabel.format(from)} – ${dayLabel.format(new Date(to.getTime() - 1))}`;

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((s) => new Date(`${s}T00:00:00+07:00`))
  .refine((d) => !Number.isNaN(d.getTime()));
const Query = z.object({
  period: z.enum(Object.keys(PERIODS) as [PeriodKey, ...PeriodKey[]]).catch(DEFAULT_PERIOD),
  from: day.optional().catch(undefined),
  to: day.optional().catch(undefined),
});

/**
 * The period from the query string. `earliest` is where All time starts (the oldest event,
 * registration or member); custom dates missing a side fall back to it and to today.
 */
export function parsePeriod(params: URLSearchParams, now: Date, earliest: Date): Period {
  const q = Query.parse({
    period: params.get('period') ?? undefined,
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
  });
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + DAY_MS);
  const year = bkk(now).getUTCFullYear();
  let from: Date;
  let to = tomorrow;
  switch (q.period) {
    case '30d':
      from = new Date(tomorrow.getTime() - 30 * DAY_MS);
      break;
    case '90d':
      from = new Date(tomorrow.getTime() - 90 * DAY_MS);
      break;
    case '12m': {
      const b = bkk(now);
      from = bkkMidnight(b.getUTCFullYear() - 1, b.getUTCMonth(), b.getUTCDate() + 1);
      break;
    }
    case 'this-year':
      from = bkkMidnight(year, 0, 1);
      break;
    case 'last-year':
      from = bkkMidnight(year - 1, 0, 1);
      to = bkkMidnight(year, 0, 1);
      break;
    case 'all':
      from = startOfDay(earliest < now ? earliest : now);
      break;
    case 'custom': {
      from = q.from ?? startOfDay(earliest < now ? earliest : now);
      to = q.to ? new Date(q.to.getTime() + DAY_MS) : tomorrow;
      if (to <= from)
        [from, to] = [new Date(to.getTime() - DAY_MS), new Date(from.getTime() + DAY_MS)];
      break;
    }
  }
  const len = to.getTime() - from.getTime();
  const previous =
    q.period === 'all'
      ? null
      : q.period === 'this-year' || q.period === 'last-year'
        ? // The same dates one year earlier, so "this year" compares with the same weeks last year.
          (() => {
            const pf = bkk(from);
            const pt = bkk(to);
            const pFrom = bkkMidnight(pf.getUTCFullYear() - 1, pf.getUTCMonth(), pf.getUTCDate());
            const pTo = bkkMidnight(pt.getUTCFullYear() - 1, pt.getUTCMonth(), pt.getUTCDate());
            return { from: pFrom, to: pTo, label: rangeLabel(pFrom, pTo) };
          })()
        : {
            from: new Date(from.getTime() - len),
            to: from,
            label: rangeLabel(new Date(from.getTime() - len), from),
          };
  return {
    key: q.period,
    from,
    to,
    label:
      q.period === 'custom' || q.period === 'last-year' ? rangeLabel(from, to) : PERIODS[q.period],
    previous,
    fromInput: dayInput(from),
    toInput: dayInput(new Date(to.getTime() - 1)),
  };
}

export const inPeriod = (d: Date | null | undefined, p: { from: Date; to: Date }) =>
  !!d && d >= p.from && d < p.to;

export interface Bucket {
  key: string;
  label: string;
  from: Date;
  to: Date;
}

const weekLabel = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Asia/Bangkok',
});
const monthLabel = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  year: '2-digit',
  timeZone: 'Asia/Bangkok',
});

/**
 * Chart buckets covering the period: weeks up to 4 months, months up to 4 years, then years. The
 * first and last bucket can stick out of the period; counts still only use the period's dates.
 */
export function periodBuckets(p: { from: Date; to: Date }): { unit: string; buckets: Bucket[] } {
  const days = (p.to.getTime() - p.from.getTime()) / DAY_MS;
  const buckets: Bucket[] = [];
  if (days <= 124) {
    // Weeks starting on Monday.
    const f = bkk(p.from);
    let start = bkkMidnight(
      f.getUTCFullYear(),
      f.getUTCMonth(),
      f.getUTCDate() - ((f.getUTCDay() + 6) % 7),
    );
    while (start < p.to) {
      const end = new Date(start.getTime() + 7 * DAY_MS);
      buckets.push({ key: dayInput(start), label: weekLabel.format(start), from: start, to: end });
      start = end;
    }
    return { unit: 'week', buckets };
  }
  if (days <= 4 * 366) {
    const f = bkk(p.from);
    let y = f.getUTCFullYear();
    let m = f.getUTCMonth();
    for (;;) {
      const start = bkkMidnight(y, m, 1);
      if (start >= p.to) break;
      const end = bkkMidnight(y, m + 1, 1);
      buckets.push({
        key: dayInput(start).slice(0, 7),
        label: monthLabel.format(new Date(start.getTime() + 14 * DAY_MS)),
        from: start,
        to: end,
      });
      m++;
      if (m === 12) [y, m] = [y + 1, 0];
    }
    return { unit: 'month', buckets };
  }
  for (let y = bkk(p.from).getUTCFullYear(); bkkMidnight(y, 0, 1) < p.to; y++) {
    buckets.push({
      key: String(y),
      label: String(y),
      from: bkkMidnight(y, 0, 1),
      to: bkkMidnight(y + 1, 0, 1),
    });
  }
  return { unit: 'year', buckets };
}

/** The query string that keeps the period (for links and CSV exports). */
export function periodQuery(p: Period): Record<string, string> {
  return p.key === 'custom'
    ? { period: p.key, from: p.fromInput, to: p.toInput }
    : { period: p.key };
}

export interface Delta {
  text: string;
  tone: 'good' | 'bad' | 'flat';
}

/**
 * "+12%" for counts, "+4 pts" for rates (0 to 1), "+0.3" for ratings, against the previous
 * period; null when either side is missing. `upIsGood` = false for no-shows, cancellations…
 */
export function delta(
  now: number | null,
  before: number | null,
  kind: 'count' | 'rate' | 'rating' = 'count',
  upIsGood = true,
): Delta | null {
  if (now === null || before === null) return null;
  let diff: number;
  let text: string;
  if (kind === 'count') {
    if (before === 0) return now === 0 ? { text: 'same', tone: 'flat' } : null;
    diff = (now - before) / before;
    text = `${Math.round(diff * 100)}%`;
  } else if (kind === 'rate') {
    diff = (now - before) * 100;
    text = `${Math.round(diff)} pts`;
  } else {
    diff = now - before;
    text = diff.toFixed(1);
  }
  if (text === '0%' || text === '0 pts' || text === '0.0' || text === '-0%' || text === '-0 pts')
    return { text: 'same', tone: 'flat' };
  return {
    text: `${diff > 0 ? '+' : '−'}${text.replace('-', '')}`,
    tone: diff > 0 === upIsGood ? 'good' : 'bad',
  };
}

export const pct = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)}%`);
