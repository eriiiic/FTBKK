import type { APIRoute } from 'astro';
import { z } from 'zod';
import { CONTACT_TAGS, filterContacts, loadContacts, type Contact } from '../../lib/contacts';
import { toDateInput } from '../../lib/admin';

// Admin only (guarded in middleware). The Contacts list as a CSV, with the page's filters.
const cell = (v: unknown) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // no formula injection when opened in Excel
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// GET exports the list with the page's filters; POST exports the rows ticked on the page.
export const GET: APIRoute = async ({ url }) =>
  csvResponse(
    filterContacts(await loadContacts(), {
      q: url.searchParams.get('q') ?? '',
      show: url.searchParams.get('show') ?? 'all',
      event: Number(url.searchParams.get('event')) || 0,
      tag: url.searchParams.get('tag') ?? '',
    }),
  );

export const POST: APIRoute = async ({ request }) => {
  const keys = z
    .array(z.string().max(320))
    .max(2000)
    .safeParse((await request.formData()).getAll('c'));
  if (!keys.success) return new Response('Invalid selection.', { status: 400 });
  const wanted = new Set(keys.data);
  return csvResponse((await loadContacts()).filter((c) => wanted.has(c.key)));
};

function csvResponse(contacts: Contact[]) {
  const header = [
    'Name',
    'Email',
    'Phone',
    'Company',
    'Role',
    'Tags',
    'Newsletter',
    'Newsletter consent date',
    'Attended',
    'Registered',
    'No-shows',
    'Cancelled',
    'Walk-ins',
    'First registration',
    'Last event',
    'Last event date',
    'Events attended',
    'Ecosystem listings',
    'Member company',
    'Membership',
    'LinkedIn',
    'Notes',
  ];
  const lines = contacts.map((c) =>
    [
      c.name,
      c.email,
      c.phone,
      c.company,
      c.role,
      c.tags.map((t) => CONTACT_TAGS[t]).join('; '),
      c.newsletter.agreed ? 'yes' : 'no',
      c.newsletter.agreed ? toDateInput(c.newsletter.at) : '',
      c.attended,
      c.registrations,
      c.noShows,
      c.cancelled,
      c.walkIns,
      toDateInput(c.firstSeen),
      c.lastEvent?.title,
      toDateInput(c.lastEvent?.startsAt),
      c.history
        .filter((r) => r.status === 'attended')
        .map((r) => `${toDateInput(r.event.startsAt)} ${r.event.title}`)
        .join('; '),
      c.organisations
        .map((o) => `${o.name} (${o.relation === 'owner' ? 'manages' : 'contact'})`)
        .join('; '),
      c.organisations.some((o) => o.memberStatus === 'member') ? 'yes' : 'no',
      c.member?.status ?? '',
      c.linkedin,
      c.notes,
    ]
      .map(cell)
      .join(','),
  );
  const csv = '﻿' + [header.join(','), ...lines].join('\r\n') + '\r\n';
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="contacts-${toDateInput(new Date())}.csv"`,
    },
  });
}
