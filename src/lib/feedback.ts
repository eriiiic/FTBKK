// Day-after event feedback: the email, the public form's validation and the numbers for the admin.
import { z } from 'zod';
import type { Event } from '../db/schema';
import type { EmailMessage } from './email';
import { myDataUrl, siteUrl } from './registrations';
import { EMAIL_TEMPLATES, applyTemplate, type EmailText } from './email-templates';

export const RATINGS = [1, 2, 3, 4, 5] as const;
export const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very good',
  5: 'Excellent',
};
export const COMMENT_MAX = 2000;

export const RatingSchema = z.coerce
  .number({ error: 'Choose a rating from 1 to 5.' })
  .int('Choose a rating from 1 to 5.')
  .min(1, 'Choose a rating from 1 to 5.')
  .max(5, 'Choose a rating from 1 to 5.');

export const FeedbackSchema = z.object({
  rating: RatingSchema,
  comment: z
    .string()
    .trim()
    .max(COMMENT_MAX, `Keep it under ${COMMENT_MAX} characters.`)
    .optional()
    .transform((v) => v || null),
});
export type FeedbackInput = z.infer<typeof FeedbackSchema>;

export const feedbackUrl = (e: Pick<Event, 'slug'>, token: string, rating?: number) =>
  siteUrl(
    `/events/${e.slug}/feedback?token=${encodeURIComponent(token)}${rating ? `&rating=${rating}` : ''}`,
  );

/**
 * The day-after email: five one-click ratings, then a page to add a comment. `text` is the edited
 * wording (loadTemplateText('event.feedback')); null = the default.
 */
export function feedbackEmail(
  e: Pick<Event, 'slug' | 'title'>,
  r: { name: string; email: string; token: string },
  text: EmailText | null = null,
): EmailMessage {
  const w = applyTemplate(EMAIL_TEMPLATES['event.feedback'], text, {
    name: r.name,
    event: e.title,
  });
  return {
    to: r.email,
    subject: w.subject,
    paragraphs: w.paragraphs,
    choices: {
      question: 'Your rating',
      options: RATINGS.map((n) => ({
        label: String(n),
        title: `${n}: ${RATING_LABELS[n]}`,
        url: feedbackUrl(e, r.token, n),
      })),
      hint: '1 = poor · 5 = excellent',
    },
    dataUrl: myDataUrl(r.token),
  };
}

export interface FeedbackSummary {
  responses: number;
  /** Null when nobody answered. */
  average: number | null;
  /** How many gave 1, 2, 3, 4 and 5 (index 0 = rating 1). */
  distribution: [number, number, number, number, number];
  comments: number;
}

export function feedbackSummary(
  rows: { rating: number; comment?: string | null }[],
): FeedbackSummary {
  const distribution: FeedbackSummary['distribution'] = [0, 0, 0, 0, 0];
  let sum = 0;
  let n = 0;
  for (const r of rows) {
    if (!Number.isInteger(r.rating) || r.rating < 1 || r.rating > 5) continue;
    distribution[r.rating - 1]!++;
    sum += r.rating;
    n++;
  }
  return {
    responses: n,
    average: n ? sum / n : null,
    distribution,
    comments: rows.filter((r) => r.comment?.trim()).length,
  };
}

/** "4.3" (one decimal), or "–" when there is no rating. */
export const formatRating = (v: number | null) => (v === null ? '–' : v.toFixed(1));
