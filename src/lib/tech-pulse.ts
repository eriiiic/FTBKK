import type { Attachment } from '../db/schema';
import { mediaUrl } from './format';

// The /tech-pulse page: every edition of Thailand Tech Pulse, our quarterly report. Editions are
// ordinary blog posts with "Tech Pulse" in their title; the report PDF is the post's first PDF
// attachment, or else the first link to a PDF in its text.

/** Top of /tech-pulse when Site texts > Tech Pulse is empty. */
export const DEFAULT_TECH_PULSE_INTRO = `Thailand Tech Pulse is La French Tech Bangkok's quarterly report on the Thai tech ecosystem: digital infrastructure, AI, investment, startups and talent.

Written for founders, investors and corporates who want a clear picture of where Thailand's tech economy is heading. Free to read and download.`;

export const isTechPulse = (title: string) => /tech\s*pulse/i.test(title);

/** "Q3 2026" from a title such as "Thailand Tech Pulse Q3 2026: …", else null. */
export function editionOf(title: string) {
  const m = title.match(/\bQ([1-4])\b[\s,–-]*((?:19|20)\d{2})\b/i);
  return m ? `Q${m[1]} ${m[2]}` : null;
}

/** The report to download: the first PDF attachment, else the first PDF linked in the text. */
export function reportFile(post: { attachments: Attachment[]; bodyMd: string }) {
  const pdf = post.attachments.find((a) => /\.pdf$/i.test(a.name) || /\.pdf$/i.test(a.key));
  if (pdf) return mediaUrl(pdf.key);
  const link = post.bodyMd.match(/\]\(\s*(\/media\/[^)\s]+\.pdf|https:\/\/[^)\s]+\.pdf)\s*\)/i);
  return link ? link[1]! : null;
}
