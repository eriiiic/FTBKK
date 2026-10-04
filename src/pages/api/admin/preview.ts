import type { APIRoute } from 'astro';
import { z } from 'zod';
import { expandDownloads, renderMarkdown } from '../../../lib/markdown';
import { mediaUrl } from '../../../lib/format';

const Input = z.object({
  md: z.string().max(100_000),
  attachments: z
    .array(
      z.object({
        name: z.string().max(200),
        key: z.string().max(300),
        size: z.number().optional(),
      }),
    )
    .max(200)
    .optional(),
  breaks: z.boolean().optional(),
});

// Admin only (guarded in middleware). Renders Markdown exactly as the public pages do.
export const POST: APIRoute = async ({ request }) => {
  const parsed = Input.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: 'Invalid input.' }, { status: 400 });
  const { md, attachments, breaks } = parsed.data;
  return Response.json({
    html: renderMarkdown(attachments ? expandDownloads(md, attachments, mediaUrl) : md, { breaks }),
  });
};
