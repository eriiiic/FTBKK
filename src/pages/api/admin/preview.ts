import type { APIRoute } from 'astro';
import { z } from 'zod';
import { renderMarkdown } from '../../../lib/markdown';

// Admin only (guarded in middleware). Renders Markdown exactly as the public pages do.
export const POST: APIRoute = async ({ request }) => {
  const parsed = z.object({ md: z.string().max(100_000) }).safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: 'Invalid input.' }, { status: 400 });
  return Response.json({ html: renderMarkdown(parsed.data.md) });
};
