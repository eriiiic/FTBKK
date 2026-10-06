# La French Tech Bangkok website

The new website of La French Tech Bangkok, replacing the Wix site at
https://www.french-tech-bangkok.com/. It runs as one Cloudflare Worker and is live at
https://ft-bkk-site.edelattre.workers.dev until the domain moves over.

## What the site does

Public pages:

- **Home** and **About**: the community, the board, "Speakers we've hosted" (everyone who spoke
  at a past event, most recent first), institutional partners, "You can join us" cards and the
  contact form. Texts are edited in the admin (Site texts).
- **Join the community** at `/join`, opened by the header's button and linked from Home and the
  footer: why join, free membership (a "coming soon" text until individual membership is built),
  the WhatsApp community, listing a company in the directory, ways to get involved (volunteer,
  host an event, become a partner, speak), the newsletter and the contact form. The WhatsApp group
  is for members, so its invite link is never shown publicly (not in the header, footer or Home
  any more): people ask for it with the contact form's "Join the WhatsApp group" topic, and the
  team sends it. Links like `/join?topic=host#contact` open the form with that topic picked. The
  page's texts are edited in Site texts.
- **Newsletter sign-up** on `/join` with double opt-in: name and email (Turnstile and rate limits)
  send a confirmation link (a single-use `newsletter` code in `magic_tokens`, valid 7 days); the
  `/newsletter` page asks for one click (so link scanners can't subscribe anyone) and records the
  consent, dated, on the person's contact card (created if needed).
- **Ecosystem**: a directory of French startups, companies, service providers, investors,
  incubators, schools and institutions in Thailand. Anyone can request a listing; owners manage
  it through one-time email links (no accounts) and confirm it once a year. Free membership with
  a Member badge, validated by the board.
- **Events**: upcoming and past events with built-in registration: capacity, waitlist with
  automatic promotion, an optional **"Anything we should know?"** question (dietary needs,
  accessibility, who they'd like to meet; shown to organisers in Registrations, the CSV, the
  check-in screen and the contact's event history), confirmation email with a calendar invite, reminder the day before, QR
  ticket and cancel link, **speakers** (photo, title, company, talk title, LinkedIn; picked from
  People and reused across events), **hosts, sponsors and partners** with their logo (linked to
  their ecosystem listing or website, shown on the event page, "Hosted by" next to the venue, and
  named in the confirmation and reminder emails), and a **feedback email** the day after (one-click 1 to 5 rating, then
  an optional comment; results on the admin's event stats). Past events can show a **recap**: a
  photo gallery (with a lightbox), slides to download, the video (YouTube and Vimeo play on the
  page, cookie-free) and a card linking to the blog write-up. Past events with a recap get a
  "Recap" badge in the events list.
- **Blog**: posts with categories, authors, images and PDF downloads. RSS at `/rss.xml`.
- **Code of conduct** at `/code-of-conduct`: how everyone is expected to behave at events, in our
  online groups (WhatsApp, LinkedIn) and on the website, and how to report a problem. Linked in
  the footer, on every event page and in the registration form. The text is edited in the admin.
- **Privacy** (Thailand's PDPA): a privacy notice at `/privacy` (what we collect, why, who sees
  it, how long we keep it, people's rights), linked in the footer and under the registration form,
  editable in the admin. Every email sent to registrants (confirmation, waitlist promotion,
  reminder, feedback request, event cancelled, "Email registrants") has a **Manage or delete my
  data** link to `/my-data?token=…` (the registration's own token, kept when someone registers
  again after cancelling, so older links keep working). That page shows what we hold about the
  person (details, events with their own answers and feedback, tags), lets them unsubscribe from
  the newsletter, and lets them delete all their data after a confirmation step (the same as
  "Delete this contact" in the admin: freed seats go to the waitlist). Deleting a contact also
  strips their details from the admin change history (the deletion itself is logged under a short
  hash, not their email). Opening the link never deletes anything. People without an event email
  to hand use **Delete my data** in the footer (also offered on `/privacy`): `/my-data` asks for
  their email (with Turnstile and a rate limit) and, only if the site holds data for it, emails a
  link that works for 24 hours (`/my-data?code=…`, a single-use `data` code in `magic_tokens`). The
  page always answers the same way, so it doesn't reveal whether an address is known.
- Old Wix URLs redirect to their new pages; `sitemap.xml` and `robots.txt` are generated.

Private admin at `/admin` (behind Cloudflare Access). Its menu is grouped: **Events** (all
events, registrations, check-in, stats), **Community** (contacts, messages, board and speakers),
**Ecosystem** (to review, all listings, renewals), **Content** (posts, files, site texts, emails)
and **Team** (team and roles, settings). See [docs/admin.md](docs/admin.md).

**Emails** (`/admin/emails`) lists the emails the site sends on its own, grouped (Events,
Ecosystem, Community, Privacy, Team, Admin notifications), each with who receives it, when it goes out and whether its text is the
default or edited (when, by whom). Opening one edits its subject, message and button label, with
placeholders such as `{name}`, `{event}`, `{date}` and `{venue}`, a preview in the real email
layout with sample values, **Send me a test** and **Back to the default text**. Only the words
are editable: dates, venue, logos, the ticket, links and attachments stay in the code. Edits are
rows in the `email_templates` table; without a row (or if the table can't be read) the built-in
default from `src/lib/email-templates.ts` is used. Every automatic email is a template: the
event emails (registration confirmed, waitlist, seat freed, reminder, cancelled, feedback request),
the directory emails to listing owners (listing request, published, declined, manage link, yearly
check and last day, hidden, claim invitation, claim confirm/approved/declined, changes
published/declined, membership approved/declined), the newsletter confirmation, the "your data"
link, the team's weekly tasks, and the notifications to the team (contact form message, new
listing, claim, listing change and membership application to review, weekly directory summary).
Lists built by the site (the steps of the weekly tasks, the renewals of the directory summary) are
placeholders (`{tasks}`, `{renewals}`) that must stay in the text, like a rejection `{reason}` or
the contact form `{message}`. "Email registrants" is written each time, so it is listed but not a
template.

**Who owns what.** Team and roles lists the organising team (name, the email they sign in with,
roles: event lead, board go/no-go, communication, check-in at the door, directory reviews,
messages and contacts). Every event has a **checklist** of the event circuit, from proposing it
(45 days before) to the debrief (14 days after): 13 steps, each with an owner (by default the
first team member with the step's role), a due date counted from the event date, a note, and
"Mark done" with who and when. The reminder and feedback emails are automatic, so they are not
steps. The Events list shows each upcoming event's progress, the Dashboard shows **My tasks**
(the signed-in person's steps that are late or due this week, messages assigned to them, and the
directory queue for directory reviewers), and every Monday each owner gets an email with what is
late or due that week. Contact messages get an **assignee** (new ones go to the person with the
Messages role, who is also emailed) and Messages has an "Assigned to me" filter.

Check-in at the door works from a phone: volunteers bookmark `/checkin`, which opens a list of
today's and upcoming events (after the Access login). Tapping one opens its check-in screen. On
that screen they can search by name, email or phone, scan the QR ticket, and add walk-in guests
who didn't register. People coming for the first time get a "First time" badge (with "Say hello
to the N newcomers" above the list) and people who came to 3 or more earlier events a "Regular"
badge, so volunteers know whom to welcome.

Organisers can **email an event's registrants** from the admin (venue change, slides after the
talk, last-minute reminder): pick the audience (registered, checked in, waitlist or everyone not
cancelled, with counts), write a subject and message with an optional button, send a test to
themselves, then send. Each message sent is kept in the event's email history (and in the weekly
backup); a second send of the same message within 10 minutes, even from another tab, is refused.

**Contacts** in the admin lists everyone who ever registered for an event or walked in, one line
per person (grouped by email), with no sign-up needed. For each person it shows how many events
they attended, registered for and missed, which events those were, their company, and the
ecosystem listings they manage or are the contact for. The list can be filtered (regulars, never
came, linked to the ecosystem, by event, by tag, and "Suggest for membership": people who came to
3 or more events with no ecosystem listing and no member company, for the board) and exported to CSV, and "Copy emails" copies
the filtered addresses for the Bcc field of an email. Contacts can carry tags (speaker, sponsor,
volunteer, board, press), shown next to their name. Tick several contacts to copy their emails,
export them to CSV, add or remove a tag, or delete them at once. Contacts can be added by hand,
edited (with tags, team notes and LinkedIn), contacted by email, WhatsApp or phone, and deleted. The dashboard shows
the total number of contacts.

**Newsletter consent** (Thailand's PDPA: explicit, opt-in, dated). The registration form has an
unticked box "Send me the La French Tech Bangkok newsletter"; a tick is stored with its date
(`newsletter_consent`, `newsletter_consent_at`). An unticked box is not recorded, so it never
withdraws an earlier yes (people withdraw on `/my-data` or by telling the team). The walk-in dialog has the
same optional box (only a tick is recorded, and it needs an email). When someone tells the team
in person, an admin sets "Subscribed" or "Not subscribed" with the date on their contact card
(`contacts.newsletter`, `newsletter_at`). A person's consent is their most recent explicit choice;
people never asked (Wix imports) have none. Contacts can be filtered on "Agreed to the newsletter"
and the CSV has "Newsletter" and "Newsletter consent date" columns, to import into a newsletter
tool. The site doesn't send newsletters itself.

The design follows the French Tech usage charter: its palette, the official La French Tech
Bangkok logo and the full name "La French Tech Bangkok".

## Stack

- [Astro 7](https://astro.build) with `@astrojs/cloudflare` (server output), TypeScript, Tailwind
  CSS v4.
- Cloudflare Worker `ft-bkk-site` (entry `src/worker.ts`), with a daily cron at 09:00 Bangkok time
  for event reminders, directory renewals and the weekly backup.
- D1 database `ftbkk` through Drizzle (`src/db/schema.ts`, migrations in `migrations/`).
- R2 bucket `ftbkk-media` for images and files, served at `/media/*`.
- Cloudflare Access on `/admin` and `/api/admin`, Turnstile on public forms, Resend for email.

## Run it locally

```sh
cp .dev.vars.example .dev.vars   # first time only
npm install
npm run db:migrate:local         # create or upgrade the local D1 database
npm run dev                      # http://localhost:4321
```

Locally the admin needs no login (it uses `DEV_ADMIN_EMAIL` from `.dev.vars`) and emails are
printed to the console instead of being sent. To fill the local database with the content
captured from Wix, run `npm run import` (see [migration/README.md](migration/README.md)).

To bring an event's registrations over from Wix, export its guest list in Wix (Events > the event >
Guests > Export; ticketed and RSVP events both work) and run `npm run import:guests -- <Guest_list_….csv>` (add `--remote` for the
live database). It adds one registration per email with the Wix order date and Wix check-ins
(attended), takes the role from the job title or "Which best describes you?" question, puts
LinkedIn URLs (mistyped ones are repaired) and free-text answers on the contact cards, sends no
email, and can be re-run. For a folder of exports:
`for f in ~/Downloads/Guest_list_*.csv; do npm run -s import:guests -- "$f" --remote; done`.

Other commands:

```sh
npm run check                     # astro check + eslint + prettier
npm test                          # unit tests (Vitest)
npm run build && npx wrangler dev # production build served by wrangler
npm run db:generate               # new migration after editing src/db/schema.ts
npm run types                     # regenerate binding types after editing wrangler.jsonc
npm run check:redirects -- <url>  # every old Wix URL must end on a 200
```

## Deploy

The repo is connected to Cloudflare Workers Builds: every merge to `main` builds and deploys the
Worker, then applies D1 migrations. Other branches get a preview URL. Cloudflare setup (R2, build
settings, Access, Turnstile, Resend, backups, domain) is in [docs/deploy.md](docs/deploy.md).

## Project layout

```text
src/pages/        public pages, /admin and /api/admin
src/components/   Astro components (admin/ for the admin UI)
src/lib/          server logic: auth, registrations, directory, email, cron jobs
src/db/           Drizzle schema and client
migrations/       D1 migrations
migration/        Wix capture script and captured data
scripts/          content import and redirect checker
docs/             plan, deploy guide, admin guide, design tokens
test/             unit tests
```

## Docs

- [docs/admin.md](docs/admin.md): how to use the admin.
- [docs/deploy.md](docs/deploy.md): Cloudflare setup and deploys.
- [docs/plan.md](docs/plan.md): the rebuild plan and decisions.
- [docs/design-tokens.md](docs/design-tokens.md): colours, fonts and spacing.
- [CLAUDE.md](CLAUDE.md): conventions for working on the code with Claude Code.
