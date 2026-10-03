import { env } from 'cloudflare:workers';
import { randomToken } from './tokens';

const TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

/** Validates and stores an uploaded file in R2. Returns the key, null when no file, or an error. */
export async function storeUpload(
  file: FormDataEntryValue | null,
  opts: { prefix: string; maxBytes: number; types: string[] },
): Promise<{ key: string | null; error?: string }> {
  if (!(file instanceof File) || file.size === 0) return { key: null };
  if (!opts.types.includes(file.type)) {
    return {
      key: null,
      error: `File type not allowed (${opts.types.map((t) => TYPES[t]).join(', ')}).`,
    };
  }
  if (file.size > opts.maxBytes) {
    return {
      key: null,
      error: `File too large (max ${Math.round(opts.maxBytes / 1024 / 1024)} MB).`,
    };
  }
  const base = file.name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40);
  const key = `${opts.prefix.replace(/\/$/, '')}/${base || 'file'}-${randomToken(6)}.${TYPES[file.type]}`;
  await env.MEDIA.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });
  return { key };
}
