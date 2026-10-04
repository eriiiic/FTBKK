import { env } from 'cloudflare:workers';

export interface EmailAttachment {
  filename: string;
  content: string; // base64
  contentType?: string;
  /** Set to show the attachment inline: <img src="cid:…">. */
  contentId?: string;
}

export interface EmailMessage {
  to: string | string[];
  subject: string;
  /** Short paragraphs (plain text, no HTML). */
  paragraphs: string[];
  /** Optional call-to-action button. */
  action?: { label: string; url: string };
  /** Extra rows rendered as "Label: value" (event date, venue…). */
  details?: [string, string][];
  /** Optional secondary links under the button. */
  links?: { label: string; url: string }[];
  footer?: string;
  /** Event ticket: QR code (an inline attachment with this content id) and its code. */
  ticket?: { code: string; qrCid: string; url: string };
  replyTo?: string;
  attachments?: EmailAttachment[];
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/** One branded template for every email on the site (HTML + plain text). */
export function renderEmail(m: EmailMessage) {
  const navy = '#0b1f3a';
  const brand = '#e4002b';
  const details = m.details?.length
    ? `<table role="presentation" style="margin:16px 0;border-collapse:collapse">${m.details
        .map(
          ([k, v]) =>
            `<tr><td style="padding:4px 12px 4px 0;color:#5b6b80;vertical-align:top">${esc(k)}</td><td style="padding:4px 0;color:#1a2433">${esc(v)}</td></tr>`,
        )
        .join('')}</table>`
    : '';
  const button = m.action
    ? `<p style="margin:24px 0"><a href="${esc(m.action.url)}" style="background:${brand};color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:600;display:inline-block">${esc(m.action.label)}</a></p>`
    : '';
  const links = m.links?.length
    ? `<p style="margin:8px 0;font-size:14px">${m.links
        .map((l) => `<a href="${esc(l.url)}" style="color:#2f5c9e">${esc(l.label)}</a>`)
        .join(' &nbsp;·&nbsp; ')}</p>`
    : '';
  const ticket = m.ticket
    ? `<table role="presentation" style="margin:20px 0;border:1px solid #d9e1ec;border-radius:12px;width:100%"><tr><td align="center" style="padding:20px">
<p style="margin:0 0 8px;font-size:13px;letter-spacing:.08em;color:#5b6b80;text-transform:uppercase">Your ticket</p>
<img src="cid:${esc(m.ticket.qrCid)}" width="200" height="200" alt="QR code for ticket ${esc(m.ticket.code)}" style="display:block;width:200px;height:200px">
<p style="margin:8px 0 0;font-family:'Courier New',monospace;font-size:22px;font-weight:700;letter-spacing:.12em;color:${navy}">${esc(m.ticket.code)}</p>
<p style="margin:8px 0 0;font-size:13px;color:#5b6b80">Show it at the entrance. <a href="${esc(m.ticket.url)}" style="color:#2f5c9e">Open it on your phone</a></p>
</td></tr></table>`
    : '';
  const html = `<!doctype html><html><body style="margin:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" style="background:#eef2f7;padding:24px 0"><tr><td align="center">
<table role="presentation" width="560" style="max-width:560px;width:100%;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:${navy};padding:20px 28px;color:#fff;font-weight:800;letter-spacing:.05em">LA FRENCH TECH <span style="color:${brand}">BANGKOK</span></td></tr>
<tr><td style="padding:28px;color:#1a2433;font-size:16px;line-height:1.6">
${m.paragraphs.map((p) => `<p style="margin:0 0 12px">${esc(p)}</p>`).join('')}
${details}${ticket}${button}${links}
</td></tr>
<tr><td style="padding:16px 28px;background:#f6f8fb;color:#5b6b80;font-size:12px">${esc(m.footer ?? 'La French Tech Bangkok · a volunteer-run community · french-tech-bangkok.com')}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    ...m.paragraphs,
    ...(m.details ?? []).map(([k, v]) => `${k}: ${v}`),
    ...(m.ticket
      ? [`Your ticket: ${m.ticket.code} (show it at the entrance): ${m.ticket.url}`]
      : []),
    ...(m.action ? [`${m.action.label}: ${m.action.url}`] : []),
    ...(m.links ?? []).map((l) => `${l.label}: ${l.url}`),
    '',
    '--',
    m.footer ?? 'La French Tech Bangkok',
  ].join('\n\n');
  return { html, text };
}

/** Sends through Resend. Without RESEND_API_KEY (local dev) the email is logged instead. */
export async function sendEmail(m: EmailMessage): Promise<{ ok: boolean; error?: string }> {
  const { html, text } = renderEmail(m);
  const to = Array.isArray(m.to) ? m.to : [m.to];
  if (!to.length) return { ok: true };
  if (!env.RESEND_API_KEY) {
    console.log(`[email:dev] to=${to.join(',')} subject="${m.subject}"\n${text}`);
    return { ok: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to,
      subject: m.subject,
      html,
      text,
      reply_to: m.replyTo,
      attachments: m.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        content_type: a.contentType,
        content_id: a.contentId,
      })),
    }),
  });
  if (!res.ok) {
    const error = `${res.status} ${await res.text()}`;
    console.error('[email] Resend error', error);
    return { ok: false, error };
  }
  return { ok: true };
}

/**
 * Sends many emails in as few requests as possible (Resend batch API, 100 per call), so a
 * reminder or cancellation for a full event stays well under the Worker's subrequest limit.
 * Batch sends don't support attachments; they are dropped.
 */
export async function sendEmailBatch(messages: EmailMessage[]) {
  if (!messages.length) return { ok: true, sent: 0 };
  if (!env.RESEND_API_KEY) {
    for (const m of messages) await sendEmail({ ...m, attachments: undefined });
    return { ok: true, sent: messages.length };
  }
  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100).map((m) => {
      const { html, text } = renderEmail(m);
      return {
        from: env.EMAIL_FROM,
        to: Array.isArray(m.to) ? m.to : [m.to],
        subject: m.subject,
        html,
        text,
        reply_to: m.replyTo,
      };
    });
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      console.error('[email] Resend batch error', res.status, await res.text());
      return { ok: false, sent };
    }
    sent += chunk.length;
  }
  return { ok: true, sent };
}
