import { z } from 'zod';
import type { EventRecap, RecapSlide } from '../db/schema';
import { optionalText, optionalUrl } from './forms';

// Recap of a past event: photos, slides, a video and the blog write-up. Pure helpers (no
// bindings) so they can be unit tested; uploads happen in the admin event editor.

export const MAX_RECAP_PHOTOS = 120;
export const MAX_RECAP_SLIDES = 20;
/** Files per upload, so one request stays well under the Worker's body and memory limits. */
export const MAX_FILES_PER_UPLOAD = 20;

export function hasRecap(r: EventRecap | null | undefined): r is EventRecap {
  return !!r && (r.photos.length > 0 || r.slides.length > 0 || !!r.videoUrl || !!r.postId);
}

const list = (max: number, len = 600) => z.array(z.string().max(len)).max(max).default([]);

/** The recap form (repeated fields are arrays: use formToObject(form, RECAP_ARRAYS)). */
export const RecapFormSchema = z.object({
  photoKey: list(MAX_RECAP_PHOTOS),
  photoAlt: list(MAX_RECAP_PHOTOS, 300),
  photoRemove: list(MAX_RECAP_PHOTOS),
  slideRef: list(MAX_RECAP_SLIDES),
  slideLabel: list(MAX_RECAP_SLIDES, 200),
  slideRemove: list(MAX_RECAP_SLIDES),
  newSlideUrl: optionalUrl(500),
  newSlideLabel: optionalText(200),
  videoUrl: optionalUrl(500),
  postId: z
    .union([z.literal(''), z.coerce.number().int().positive()])
    .optional()
    .transform((v) => (v ? v : null)),
});
export type RecapForm = z.infer<typeof RecapFormSchema>;
export const RECAP_ARRAYS = [
  'photoKey',
  'photoAlt',
  'photoRemove',
  'slideRef',
  'slideLabel',
  'slideRemove',
];

/** Stable identifier of a slide row in the form. */
export const slideRef = (s: RecapSlide) => (s.key ? `k:${s.key}` : `u:${s.url ?? ''}`);

/** "Pitch deck-v2.pdf" -> "Pitch deck v2". */
export function labelFromFileName(name: string) {
  const base = name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (base || 'Slides').slice(0, 200);
}

/**
 * Builds the new recap from the form and the freshly uploaded files. Only photos and slides
 * already in the recap are kept (a form can't point the page at an arbitrary R2 key), in the
 * order the form lists them. Returns the photo keys that were removed, to delete from R2.
 */
export function buildRecap(
  prev: EventRecap | null | undefined,
  form: RecapForm,
  uploaded: { photos: string[]; slides: { key: string; label: string }[] },
): { recap: EventRecap; removedPhotos: string[] } {
  const prevPhotos = new Map((prev?.photos ?? []).map((p) => [p.key, p]));
  const removed = new Set(form.photoRemove);
  const photos: EventRecap['photos'] = [];
  const seen = new Set<string>();
  form.photoKey.forEach((key, i) => {
    if (!prevPhotos.has(key) || seen.has(key)) return;
    seen.add(key);
    if (removed.has(key)) return;
    const alt = form.photoAlt[i]?.trim();
    photos.push(alt ? { key, alt } : { key });
  });
  // Photos missing from the form (another admin's upload, a truncated form) are kept.
  for (const p of prevPhotos.values()) if (!seen.has(p.key) && !removed.has(p.key)) photos.push(p);
  photos.push(...uploaded.photos.map((key) => ({ key })));
  const removedPhotos = [...prevPhotos.keys()].filter((k) => removed.has(k));

  const prevSlides = new Map((prev?.slides ?? []).map((s) => [slideRef(s), s]));
  const slideRemoved = new Set(form.slideRemove);
  const slides: RecapSlide[] = [];
  const seenSlides = new Set<string>();
  form.slideRef.forEach((ref, i) => {
    const s = prevSlides.get(ref);
    if (!s || seenSlides.has(ref)) return;
    seenSlides.add(ref);
    if (slideRemoved.has(ref)) return;
    slides.push({ ...s, label: form.slideLabel[i]?.trim() || s.label });
  });
  for (const [ref, s] of prevSlides)
    if (!seenSlides.has(ref) && !slideRemoved.has(ref)) slides.push(s);
  slides.push(...uploaded.slides.map((s) => ({ label: s.label, key: s.key })));
  if (form.newSlideUrl && !slides.some((s) => s.url === form.newSlideUrl))
    slides.push({ label: form.newSlideLabel ?? 'Slides', url: form.newSlideUrl });

  return {
    recap: { photos, slides, videoUrl: form.videoUrl, postId: form.postId },
    removedPhotos,
  };
}

/**
 * A privacy-friendly embed URL for YouTube (youtube-nocookie.com) and Vimeo (dnt=1) links, or
 * null for any other site (shown as a plain link).
 */
export function videoEmbed(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m)\./, '');
  let yt: string | null | undefined = null;
  if (host === 'youtu.be') yt = u.pathname.split('/')[1];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    yt =
      u.pathname === '/watch'
        ? u.searchParams.get('v')
        : u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/]+)/)?.[1];
  }
  if (yt && /^[\w-]{11}$/.test(yt)) return `https://www.youtube-nocookie.com/embed/${yt}`;
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = u.pathname.match(/^\/(?:video\/)?(\d+)(?:\/([\da-f]+))?\/?$/);
    if (m) {
      const hash = m[2] ?? u.searchParams.get('h');
      return `https://player.vimeo.com/video/${m[1]}?dnt=1${hash && /^[\da-f]+$/.test(hash) ? `&h=${hash}` : ''}`;
    }
  }
  return null;
}

/** "YouTube", "Vimeo" or the site's host name, for the "Watch on …" link. */
export function videoSite(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^(www|m)\./, '');
    if (host === 'youtu.be' || host.endsWith('youtube.com')) return 'YouTube';
    if (host.endsWith('vimeo.com')) return 'Vimeo';
    return host;
  } catch {
    return 'the video site';
  }
}
