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
  /** Short paragraphs (plain text, no HTML; a line break shows as one). */
  paragraphs: string[];
  /** A row of one-click choices, such as a 1 to 5 rating, shown before the button. */
  choices?: {
    question: string;
    options: { label: string; url: string; title?: string }[];
    hint?: string;
  };
  /** Optional call-to-action button. */
  action?: { label: string; url: string };
  /** Extra rows rendered as "Label: value" (event date, venue…). */
  details?: [string, string][];
  /** A row of logos (hosts, sponsors) under the details: absolute image URLs, alt = name. */
  logos?: { src: string; alt: string; url?: string }[];
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
  // Inline copies of the theme tokens (src/styles/global.css): email clients ignore stylesheets.
  const navy = '#160b47';
  const brand = '#d6223d';
  const details = m.details?.length
    ? `<table role="presentation" style="margin:16px 0;border-collapse:collapse">${m.details
        .map(
          ([k, v]) =>
            `<tr><td style="padding:4px 12px 4px 0;color:#5c5a73;vertical-align:top">${esc(k)}</td><td style="padding:4px 0;color:#1a1530">${esc(v)}</td></tr>`,
        )
        .join('')}</table>`
    : '';
  const logos = m.logos?.length
    ? `<p style="margin:0 0 16px">${m.logos
        .map((l) => {
          const img = `<img src="${esc(l.src)}" alt="${esc(l.alt)}" height="40" style="height:40px;width:auto;max-width:140px;vertical-align:middle;border:0;margin:0 16px 8px 0">`;
          return l.url ? `<a href="${esc(l.url)}">${img}</a>` : img;
        })
        .join('')}</p>`
    : '';
  const choices = m.choices
    ? `<p style="margin:20px 0 8px;font-weight:600;color:${navy}">${esc(m.choices.question)}</p>
<table role="presentation" style="border-collapse:separate;border-spacing:0 0"><tr>${m.choices.options
        .map(
          (o) =>
            `<td style="padding:0 8px 0 0"><a href="${esc(o.url)}"${o.title ? ` title="${esc(o.title)}"` : ''} style="display:inline-block;width:44px;height:44px;line-height:44px;text-align:center;border:2px solid ${navy};border-radius:10px;color:${navy};font-weight:700;font-size:18px;text-decoration:none">${esc(o.label)}</a></td>`,
        )
        .join('')}</tr></table>${
        m.choices.hint
          ? `<p style="margin:8px 0 0;font-size:13px;color:#5c5a73">${esc(m.choices.hint)}</p>`
          : ''
      }`
    : '';
  const button = m.action
    ? `<p style="margin:24px 0"><a href="${esc(m.action.url)}" style="background:${brand};color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:600;display:inline-block">${esc(m.action.label)}</a></p>`
    : '';
  const links = m.links?.length
    ? `<p style="margin:8px 0;font-size:14px">${m.links
        .map((l) => `<a href="${esc(l.url)}" style="color:#0062ff">${esc(l.label)}</a>`)
        .join(' &nbsp;·&nbsp; ')}</p>`
    : '';
  const ticket = m.ticket
    ? `<table role="presentation" style="margin:20px 0;border:1px solid #e0dfe8;border-radius:12px;width:100%"><tr><td align="center" style="padding:20px">
<p style="margin:0 0 8px;font-size:13px;letter-spacing:.08em;color:#5c5a73;text-transform:uppercase">Your ticket</p>
<img src="cid:${esc(m.ticket.qrCid)}" width="200" height="200" alt="QR code for ticket ${esc(m.ticket.code)}" style="display:block;width:200px;height:200px">
<p style="margin:8px 0 0;font-family:'Courier New',monospace;font-size:22px;font-weight:700;letter-spacing:.12em;color:${navy}">${esc(m.ticket.code)}</p>
<p style="margin:8px 0 0;font-size:13px;color:#5c5a73">Show it at the entrance. <a href="${esc(m.ticket.url)}" style="color:#0062ff">Open it on your phone</a></p>
</td></tr></table>`
    : '';
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" style="background:#f5f5f5;padding:24px 0"><tr><td align="center">
<table role="presentation" width="560" style="max-width:560px;width:100%;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:${navy};padding:20px 28px;color:#fff;font-weight:700;font-size:18px">La French Tech Bangkok</td></tr>
<tr><td style="padding:28px;color:#1a1530;font-size:16px;line-height:1.6">
${m.paragraphs.map((p) => `<p style="margin:0 0 12px">${esc(p).replace(/\n/g, '<br>')}</p>`).join('')}
${details}${logos}${ticket}${choices}${button}${links}
</td></tr>
<tr><td style="padding:16px 28px;background:#f5f5f5;color:#5c5a73;font-size:12px">${esc(m.footer ?? 'La French Tech Bangkok · a volunteer-run community · french-tech-bangkok.com')}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    ...m.paragraphs,
    ...(m.details ?? []).map(([k, v]) => `${k}: ${v}`),
    ...(m.ticket
      ? [`Your ticket: ${m.ticket.code} (show it at the entrance): ${m.ticket.url}`]
      : []),
    ...(m.choices
      ? [
          [
            `${m.choices.question}${m.choices.hint ? ` (${m.choices.hint})` : ''}:`,
            ...m.choices.options.map((o) => `${o.title ?? o.label}: ${o.url}`),
          ].join('\n'),
        ]
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
