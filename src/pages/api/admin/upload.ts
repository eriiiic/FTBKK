import type { APIRoute } from 'astro';
import { IMAGE_TYPES, storeUpload } from '../../../lib/uploads';
import { mediaUrl } from '../../../lib/format';
import { audit } from '../../../lib/orgs';

// Admin only (guarded in middleware). Stores an image or PDF and returns its public URL,
// used by the Markdown editor to insert images and file links.
export const POST: APIRoute = async ({ request, locals }) => {
  const form = await request.formData();
  const kind = form.get('kind') === 'file' ? 'file' : 'image';
  const res = await storeUpload(form.get('file'), {
    prefix: kind === 'file' ? 'files' : 'images',
    maxBytes: (kind === 'file' ? 20 : 5) * 1024 * 1024,
    types: kind === 'file' ? [...IMAGE_TYPES, 'application/pdf'] : IMAGE_TYPES,
  });
  if (res.error || !res.key) {
    return Response.json({ error: res.error ?? 'No file received.' }, { status: 400 });
  }
  await audit(locals.adminEmail ?? 'admin', 'upload', 'media', null, null, { key: res.key });
  return Response.json({ key: res.key, url: mediaUrl(res.key) });
};
