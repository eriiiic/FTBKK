import type { APIRoute } from 'astro';
import { filterContacts, loadContacts } from '../../lib/contacts';
import { toDateInput } from '../../lib/admin';

// Admin only (guarded in middleware). The Contacts list as a CSV, with the page's filters.
const cell = (v: unknown) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // no formula injection when opened in Excel
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const GET: APIRoute = async ({ url }) => {
  const contacts = filterContacts(await loadContacts(), {
    q: url.searchParams.get('q') ?? '',
    show: url.searchParams.get('show') ?? 'all',
    event: Number(url.searchParams.get('event')) || 0,
  });
  const header = [
    'Name',
    'Email',
    'Phone',
    'Company',
    'Role',
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
    'Member',
  ];
  const lines = contacts.map((c) =>
    [
      c.name,
      c.email,
      c.phone,
      c.company,
      c.role,
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
};
