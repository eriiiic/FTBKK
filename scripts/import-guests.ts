/**
 * Imports a Wix Events guest list into an event's registrations, without sending any email.
 *
 *   npm run import:guests -- <Guest_list_….csv>                  # local D1
 *   npm run import:guests -- <Guest_list_….csv> --remote         # the real Cloudflare D1
 *   --event <slug>     the event to import into (default: taken from the file name,
 *                      "Guest_list_<slug>_<date>.csv")
 *   --send-reminders   let the daily cron send the usual reminder email (by default guests are
 *                      marked as already reminded, since Wix sends its own)
 *   --dry-run          print the SQL instead of running it
 *
 * One registration per email, dated with the Wix order date; guests checked in on Wix are marked
 * as attended (checked in at the event start time). LinkedIn URLs and "Anything we
 * should know?" answers go on the person's contact card. Re-running is safe: people already
 * registered for the event are left as they are, and contact cards only get empty fields filled.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { decodeGuestFile, parseWixGuests } from './lib/wix-guests';

const ROOT = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(name);
const option = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const file = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--event');
if (!file) {
  console.error('Usage: npm run import:guests -- <Guest_list_….csv> [--remote] [--event <slug>]');
  process.exit(1);
}
const slug =
  option('--event') ??
  path.basename(file).match(/^Guest[_ ]list[_ ](.+?)[_ ]\d{4}-\d{2}-\d{2}/i)?.[1];
if (!slug) {
  console.error('Could not tell the event from the file name; pass --event <slug>.');
  process.exit(1);
}
const target = flag('--remote') ? '--remote' : '--local';

const q = (v: string | number | null) =>
  v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`;
const token = () => randomBytes(24).toString('base64url');

const guests = parseWixGuests(decodeGuestFile(readFileSync(file)));
const event = `(SELECT id FROM events WHERE slug = ${q(slug)})`;
const reminded = flag('--send-reminders') ? 'NULL' : 'unixepoch()';

const sql: string[] = [];
for (const g of guests) {
  const status = g.checkedIn ? 'attended' : 'registered';
  sql.push(
    `INSERT INTO registrations (event_id, name, email, company, role, photo_consent, walk_in, status, token, created_at, checked_in_at, reminder_sent_at)
     SELECT ${event}, ${q(g.name)}, ${q(g.email)}, ${q(g.company)}, ${q(g.role)}, 0, 0, '${status}', ${q(token())}, ${g.orderedAt}, ${g.checkedIn ? `(SELECT starts_at FROM events WHERE slug = ${q(slug)})` : 'NULL'}, ${reminded}
     WHERE ${event} IS NOT NULL
     ON CONFLICT (event_id, email) DO NOTHING;`,
  );
  if (g.linkedin || g.notes) {
    // A contact card overrides the details taken from registrations, so it carries them too.
    sql.push(
      `INSERT INTO contacts (email, name, company, role, linkedin, notes)
       VALUES (${q(g.email)}, ${q(g.name)}, ${q(g.company)}, ${q(g.role)}, ${q(g.linkedin)}, ${q(g.notes)})
       ON CONFLICT (email) DO UPDATE SET
         company = coalesce(contacts.company, excluded.company),
         role = coalesce(contacts.role, excluded.role),
         linkedin = coalesce(contacts.linkedin, excluded.linkedin),
         notes = CASE
           WHEN excluded.notes IS NULL OR instr(coalesce(contacts.notes, ''), excluded.notes) > 0 THEN contacts.notes
           WHEN contacts.notes IS NULL THEN excluded.notes
           ELSE contacts.notes || char(10) || excluded.notes END,
         updated_at = unixepoch();`,
    );
  }
}

const cards = guests.filter((g) => g.linkedin || g.notes).length;
console.log(
  `${guests.length} guests for "${slug}" (${cards} with a LinkedIn URL or a note for their contact card).`,
);
if (flag('--dry-run')) {
  console.log(sql.join('\n'));
  process.exit(0);
}

const wrangler = (...a: string[]) =>
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'ftbkk', target, ...a], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'inherit'],
  }).toString();
const count = () =>
  JSON.parse(
    wrangler(
      '--json',
      '--command',
      `SELECT (SELECT count(*) FROM events WHERE slug = ${q(slug)}) AS events, (SELECT count(*) FROM registrations WHERE event_id = ${event}) AS registrations`,
    ),
  )[0].results[0] as { events: number; registrations: number };

console.log(`Importing into ${target === '--remote' ? 'REMOTE' : 'local'} D1…`);
const before = count();
if (!before.events) {
  console.error(`No event with the slug "${slug}" in this database.`);
  process.exit(1);
}
const sqlFile = path.join(mkdtempSync(path.join(tmpdir(), 'ftbkk-guests-')), 'guests.sql');
writeFileSync(sqlFile, sql.join('\n') + '\n');
wrangler('--file', sqlFile, '--yes');
const after = count();
console.log(
  `Done: ${after.registrations - before.registrations} new registrations (${after.registrations} in total for the event); ${guests.length - (after.registrations - before.registrations)} were already registered.`,
);
