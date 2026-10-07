// Browser side of the share images (lib/share.ts): draws the 1200x630 image on a canvas with the
// site fonts and colours, then uploads it to /api/admin/share-image. Runs in the admin only.
import { SHARE_HEIGHT, SHARE_WIDTH, type ShareSpec } from './share-spec';

const words = new Intl.Segmenter(undefined, { granularity: 'word' });
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/**
 * Splits text into lines no wider than maxWidth. A word wider than a line (or Thai, written
 * without spaces) is broken between dictionary words, then between characters.
 */
export function wrapText(measure: (s: string) => number, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = '';
  const add = (piece: string, sep: string) => {
    const next = line ? `${line}${sep}${piece}` : piece;
    if (measure(next) <= maxWidth) {
      line = next;
      return true;
    }
    return false;
  };
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (add(word, ' ')) continue;
    if (line) lines.push(line);
    line = '';
    if (add(word, '')) continue;
    for (const { segment } of words.segment(word)) {
      if (add(segment, '')) continue;
      if (line) lines.push(line);
      line = '';
      if (add(segment, '')) continue;
      for (const { segment: ch } of graphemes.segment(segment)) {
        if (add(ch, '')) continue;
        lines.push(line);
        line = ch;
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Ends the last kept line with an ellipsis when the text needs more than max lines. */
export function clampLines(
  measure: (s: string) => number,
  lines: string[],
  max: number,
  maxWidth: number,
) {
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  let last = kept[max - 1]!;
  while (last && measure(`${last}…`) > maxWidth) last = last.slice(0, -1).trimEnd();
  kept[max - 1] = `${last}…`;
  return kept;
}

const token = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();

/** A #rrggbb token, fully transparent (for gradients). */
function clear(hex: string) {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / 0)`;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

/** Draws img into the box, cropped to fill it (CSS object-fit: cover). */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

const DISPLAY = '"Montserrat Variable", "Noto Sans Thai Variable", sans-serif';
const BODY = '"Inter Variable", "Noto Sans Thai Variable", sans-serif';

/**
 * The share image: navy panel on the left with the official logo (on its white tile, as on the
 * site), the red label, the title and the date or byline; the photo on the right.
 */
export async function drawShareImage(spec: ShareSpec): Promise<Blob> {
  const W = SHARE_WIDTH;
  const H = SHARE_HEIGHT;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  await Promise.all([
    document.fonts.load(`700 56px ${DISPLAY}`, spec.title),
    document.fonts.load(`600 26px ${BODY}`, spec.lines.join(' ')),
    document.fonts.load(`700 22px ${BODY}`, spec.label),
  ]);
  const [photo, logo] = await Promise.all([
    loadImage(spec.photo).catch(() => null),
    loadImage('/brand/logo-lockup.png'),
  ]);
  const navy = token('color-navy');
  const paper = token('color-paper');
  const brand = token('color-brand');
  const soft = token('color-accent-soft');

  ctx.fillStyle = navy;
  ctx.fillRect(0, 0, W, H);
  const split = 640;
  if (photo) drawCover(ctx, photo, split - 80, 0, W - split + 80, H);
  // Blend the photo into the navy panel.
  const fade = ctx.createLinearGradient(split - 80, 0, split + 40, 0);
  fade.addColorStop(0, navy);
  fade.addColorStop(1, clear(navy));
  ctx.fillStyle = navy;
  ctx.fillRect(0, 0, split - 80, H);
  ctx.fillStyle = fade;
  ctx.fillRect(split - 80, 0, 120, H);

  const left = 64;
  const maxWidth = split - left - 40;

  // Logo on a white tile, as in the site header on navy.
  const logoH = 112;
  const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
  ctx.fillStyle = paper;
  roundRect(ctx, left, 48, logoW + 20, logoH + 20, 14);
  ctx.drawImage(logo, left + 10, 58, logoW, logoH);

  // Label pill.
  ctx.font = `700 22px ${BODY}`;
  const labelW = ctx.measureText(spec.label).width + 36;
  ctx.fillStyle = brand;
  roundRect(ctx, left, 220, labelW, 42, 21);
  ctx.fillStyle = paper;
  ctx.textBaseline = 'middle';
  ctx.fillText(spec.label, left + 18, 242);

  // Title: largest size that fits in three lines, or four once the text gets small.
  ctx.textBaseline = 'alphabetic';
  let size = 56;
  let maxLines = 3;
  let lines: string[] = [];
  for (; size >= 34; size -= 2) {
    ctx.font = `700 ${size}px ${DISPLAY}`;
    maxLines = size <= 40 ? 4 : 3;
    lines = wrapText((s) => ctx.measureText(s).width, spec.title, maxWidth);
    if (lines.length <= maxLines) break;
  }
  size = Math.max(size, 34);
  lines = clampLines((s) => ctx.measureText(s).width, lines, maxLines, maxWidth);
  ctx.fillStyle = paper;
  let y = 290 + size;
  for (const line of lines) {
    ctx.fillText(line, left, y);
    y += Math.round(size * 1.15);
  }

  // Date and venue (events), byline (posts).
  y += 14;
  spec.lines.slice(0, 2).forEach((text, i) => {
    ctx.font = `${i === 0 ? 600 : 400} 26px ${BODY}`;
    ctx.fillStyle = i === 0 ? soft : paper;
    const [one] = clampLines(
      (s) => ctx.measureText(s).width,
      wrapText((s) => ctx.measureText(s).width, text, maxWidth),
      1,
      maxWidth,
    );
    if (y < H - 30) ctx.fillText(one ?? '', left, y);
    y += 38;
  });

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))),
      'image/jpeg',
      0.9,
    ),
  );
}

/** Draws and stores the image; returns its public URL. */
export async function makeShareImage(spec: ShareSpec, fingerprint: string): Promise<string> {
  const blob = await drawShareImage(spec);
  const form = new FormData();
  form.set('entity', spec.entity);
  form.set('id', String(spec.id));
  form.set('fingerprint', fingerprint);
  form.set('file', new File([blob], 'share.jpg', { type: 'image/jpeg' }));
  const res = await fetch('/api/admin/share-image', { method: 'POST', body: form });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? `Upload failed (${res.status})`);
  return data.url;
}
