import { z } from 'zod';
import type { APIRoute } from 'astro';
import { IMAGE_TYPES, storeUpload } from '../../../lib/uploads';
import { mediaUrl } from '../../../lib/format';
import { audit } from '../../../lib/orgs';

// Admin only (guarded in middleware). Stores an image or a file and returns its public URL,
// used by the Markdown editor and the post attachments panel.
// kind: image (default), pdf (PDF only) or file (PDF or image).
export const POST: APIRoute = async ({ request, locals }) => {
  const form = await request.formData();
  const kind = z.enum(['image', 'pdf', 'file']).catch('image').parse(form.get('kind'));
  const types = {
    image: IMAGE_TYPES,
    pdf: ['application/pdf'],
    file: [...IMAGE_TYPES, 'application/pdf'],
  }[kind];
  const res = await storeUpload(form.get('file'), {
    prefix: kind === 'image' ? 'images' : 'files',
    maxBytes: (kind === 'image' ? 5 : 20) * 1024 * 1024,
    types,
  });
  if (res.error || !res.key) {
    return Response.json({ error: res.error ?? 'No file received.' }, { status: 400 });
  }
  await audit(locals.adminEmail ?? 'admin', 'upload', 'media', null, null, { key: res.key });
  return Response.json({ key: res.key, url: mediaUrl(res.key) });
};
