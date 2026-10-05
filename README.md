# La French Tech Bangkok website

The new website of La French Tech Bangkok, replacing the Wix site at
https://www.french-tech-bangkok.com/. It runs as one Cloudflare Worker and is live at
https://ft-bkk-site.edelattre.workers.dev until the domain moves over.

## What the site does

Public pages:

- **Home** and **About**: the community, the board and institutional partners, "You can join us"
  cards and the contact form. Texts are edited in the admin.
- **Ecosystem**: a directory of French startups, companies, service providers, investors,
  incubators, schools and institutions in Thailand. Anyone can request a listing; owners manage
  it through one-time email links (no accounts) and confirm it once a year. Free membership with
  a Member badge, validated by the board.
- **Events**: upcoming and past events with built-in registration: capacity, waitlist with
  automatic promotion, confirmation email with a calendar invite, reminder the day before, QR
  ticket and cancel link.
- **Blog**: posts with categories, authors, images and PDF downloads. RSS at `/rss.xml`.
- Old Wix URLs redirect to their new pages; `sitemap.xml` and `robots.txt` are generated.

Private admin at `/admin` (behind Cloudflare Access) for posts, events and registrations (stats,
CSV export), contacts, the ecosystem directory (review queue, listings, renewals, history), people, contact
messages (folders, team notes, blocked senders), uploaded files and site settings. See
[docs/admin.md](docs/admin.md).

Check-in at the door works from a phone: volunteers bookmark `/checkin`, which opens a list of
today's and upcoming events (after the Access login). Tapping one opens its check-in screen. On
that screen they can search by name, email or phone, scan the QR ticket, and add walk-in guests
who didn't register.

**Contacts** in the admin lists everyone who ever registered for an event or walked in, one line
per person (grouped by email), with no sign-up needed. For each person it shows how many events
they attended, registered for and missed, which events those were, their company, and the
ecosystem listings they manage or are the contact for. The list can be filtered (regulars, never
came, linked to the ecosystem, by event) and exported to CSV, and "Copy emails" copies the
filtered addresses for the Bcc field of an email. Contacts can be added by hand, edited (with
team notes and LinkedIn), contacted by email, WhatsApp or phone, and deleted. The dashboard shows
the total number of contacts.

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
live database). It adds one registration per email with the Wix order date, puts LinkedIn URLs
and "Anything we should know?" answers on the contact cards, sends no email, and can be re-run.

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
