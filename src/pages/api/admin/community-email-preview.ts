import type { APIRoute } from 'astro';
import { z } from 'zod';
import {
  COMMUNITY_AUDIENCE_KEYS,
  communityMessage,
  loadCards,
} from '../../../lib/community-emails';
import { renderEmail } from '../../../lib/email';

const Input = z.object({
  audience: z.enum(COMMUNITY_AUDIENCE_KEYS).catch('members'),
  subject: z.string().max(150).catch(''),
  body: z.string().max(20000).catch(''),
  actionLabel: z.string().max(60).catch(''),
  actionUrl: z.string().max(500).catch(''),
});

// Admin only (guarded in middleware). The live preview of Email the community: the whole email
// as the first recipient would get it, with {name} filled in and the cards built.
export const POST: APIRoute = async ({ request }) => {
  const parsed = Input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid input.' }, { status: 400 });
  const d = parsed.data;
  const url = /^https?:\/\/\S+$/.test(d.actionUrl.trim()) ? d.actionUrl.trim() : null;
  const msg = communityMessage(
    d.audience,
    {
      subject: d.subject,
      body: d.body,
      actionLabel: url ? d.actionLabel.trim() : '',
      actionUrl: url,
    },
    { cards: await loadCards(d.body) },
  );
  const email = msg.to({ name: 'Camille Martin', email: 'camille@example.com' });
  return Response.json({
    subject: email.subject,
    html: renderEmail(email).html,
    missing: msg.missing,
  });
};
