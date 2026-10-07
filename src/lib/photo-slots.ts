import { IMAGE_TYPES, storeUpload } from './uploads';
import type { Photo } from './settings';

// One-photo slots in the admin (home header, About us, community, default event covers): a file
// field `<name>File`, an optional description `<name>Alt` and a "back to default" box `<name>Reset`.

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = IMAGE_TYPES.filter((t) => t !== 'image/svg+xml');

/** True when the slot's form fields carry a new file. */
export function hasNewFile(form: FormData, name: string) {
  const f = form.get(`${name}File`);
  return f instanceof File && f.size > 0;
}

/**
 * The slot's new value: null when reset to the default, the uploaded file, or the current photo
 * with its edited description. Uploads only when `upload` is true (the rest of the form is valid).
 */
export async function readPhotoSlot(
  form: FormData,
  name: string,
  current: Photo | null,
  opts: { prefix: string; upload: boolean },
): Promise<{ photo: Photo | null; error?: string }> {
  const alt = String(form.get(`${name}Alt`) ?? '')
    .trim()
    .slice(0, 200);
  if (form.get(`${name}Reset`)) return { photo: null };
  if (hasNewFile(form, name)) {
    if (!opts.upload)
      return { photo: current, error: 'Choose the photo again after fixing the other fields.' };
    const up = await storeUpload(form.get(`${name}File`), {
      prefix: opts.prefix,
      maxBytes: PHOTO_MAX_BYTES,
      types: PHOTO_TYPES,
    });
    if (up.error || !up.key) return { photo: current, error: up.error ?? 'Upload failed.' };
    return { photo: { key: up.key, alt } };
  }
  return { photo: current ? { ...current, alt } : null };
}
