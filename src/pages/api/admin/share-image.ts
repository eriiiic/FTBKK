import { z } from 'zod';
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../db';
import { events, posts } from '../../../db/schema';
import { getSettings } from '../../../lib/settings';
import { eventShareSpec, postShareSpec, shareFingerprint, shareImageKey } from '../../../lib/share';
import { mediaUrl } from '../../../lib/format';

const Input = z.object({
  entity: z.enum(['event', 'post']),
  id: z.coerce.number().int().positive(),
  fingerprint: z.string().regex(/^[0-9a-f]{10}$/),
});

// Admin only (guarded in middleware). Stores the share image drawn in the admin's browser
// (lib/share-image-client.ts) and points the event or post at it.
export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const parsed = Input.safeParse(Object.fromEntries(form));
  const file = form.get('file');
  if (!parsed.success || !(file instanceof File) || file.type !== 'image/jpeg')
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  if (file.size > 2 * 1024 * 1024)
    return Response.json({ error: 'Image too large.' }, { status: 400 });
  const { entity, id, fingerprint } = parsed.data;
  const db = getDb();
  const table = entity === 'event' ? events : posts;
  const [row] = await db.select().from(table).where(eq(table.id, id)).limit(1);
  if (!row) return Response.json({ error: 'Not found.' }, { status: 404 });
  const spec =
    entity === 'event'
      ? eventShareSpec(row as typeof events.$inferSelect, (await getSettings()).eventCovers)
      : postShareSpec(row as typeof posts.$inferSelect);
  // Drawn from an older version of the page: the text or photo changed since.
  if ((await shareFingerprint(spec)) !== fingerprint)
    return Response.json({ error: 'Changed since: reload the page.' }, { status: 409 });
  const key = shareImageKey(spec, fingerprint);
  await env.MEDIA.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: 'image/jpeg' },
  });
  if (row.shareImageKey !== key) {
    await db.update(table).set({ shareImageKey: key }).where(eq(table.id, id));
    if (row.shareImageKey) await env.MEDIA.delete(row.shareImageKey);
  }
  return Response.json({ url: mediaUrl(key) });
};
