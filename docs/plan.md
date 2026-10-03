# French Tech Bangkok website rebuild: plan and Claude Code prompts

2026-10-02 · @Eric Delattre

## Summary and decisions

The new site has 5 public sections (Home, Ecosystem, Events, Blog, About) and one private admin area where the team manages blog posts, events, registrations and the ecosystem directory. Everything runs on one Cloudflare Worker, with content in a Cloudflare D1 database and images in R2, so publishing is instant and needs no code or rebuild.

The centrepiece is the **Ecosystem directory**: a searchable map of the startups, corporates, investors, institutions, service providers and communities that make up French Tech in Thailand. Organisations can request a listing through a form, and the team approves it in the admin. It starts with the 31 partner profiles and 3 institutions already on the Wix site.

The directory follows the board deck on the ecosystem directory: an open, self-submitted cartography first, a free Member badge second, member perks from 2027, with every listing reconfirmed each year.

| Decision                                         | Choice in this plan                                                                                                                                                    | Alternative                                                                                            |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Admin for blog, events, registrations, directory | Custom admin at /admin on the same Worker, data in D1, login through Cloudflare Access (free for up to 50 users, email one-time code, no passwords to build)           | Git-based CMS (Sveltia). Simpler code, but registrations would still need a database and a second tool |
| Event registration                               | Built in: registration form per event, capacity and waitlist, confirmation email with calendar invite, attendee list, CSV export, door check-in page                   | Luma links (no code, but data lives outside)                                                           |
| Directory listings                               | Open cartography: anyone submits, email verified, moderated within 5 days, owners update by email link, reconfirmed every year or hidden; free Member badge in stage 2 | Members only, validated by the board (Barcelona model, caps out around 80 listings)                    |
| Members login and Wix member profiles            | Dropped; the directory replaces them                                                                                                                                   | Rebuild member accounts                                                                                |
| Blog comments and likes                          | Dropped                                                                                                                                                                | Giscus                                                                                                 |
| /fund, /team, /services-9, placeholder pages     | Dropped, old URLs redirect                                                                                                                                             | Migrate as-is                                                                                          |
| Emails (registration confirmations, form alerts) | Resend API (free tier 3,000 emails per month) from the Worker                                                                                                          | Cloudflare Email Routing (only sends to verified addresses, so it can't confirm attendees)             |
| Language                                         | English only, built so French or Thai can be added                                                                                                                     | Bilingual from day one                                                                                 |

Still to check before the domain move: whether french-tech-bangkok.com is already on Cloudflare, and where the hello@ mailbox is hosted. The members page lists contact@ftbkk.com while every other page lists hello@french-tech-bangkok.com; pick one.

## What the current site contains

Crawled on 2 October 2026 from the [sitemap](https://www.french-tech-bangkok.com/sitemap.xml). Main menu: Home, About, Events, Blog, plus Log In. Footer: hello@french-tech-bangkok.com and Instagram, WhatsApp group, Facebook, LinkedIn, YouTube.

| Page or content type   | Current URL                      | What it holds                                                                                                                                                                                                                 | Wix feature behind it  |
| ---------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Home                   | /                                | Hero "Support your venture with our network" with events CTA; 3 mission pillars; next 2 events; 3 benefits (learn, network, grow); 10 board members with photo, company, LinkedIn; 3 institutional partners; WhatsApp invite  | Static + Events widget |
| About                  | /about                           | Who we are (volunteer community, French Tech label since 2019, free and open to all); "You can join us" for individuals, startups (free certification), business partners; Meet the Board with titles; institutional partners | Static                 |
| Events list            | /events                          | Calendar view + "Coming up next", upcoming and past, venue, short description, attendee count, share buttons                                                                                                                  | Wix Events             |
| Event detail (33)      | /event-details-registration/slug | Date and time, venue and address, description, free "General Admission" ticket, attendee avatars, photo-consent notice                                                                                                        | Wix Events RSVP        |
| Blog index             | /blog                            | Cards with cover, title, excerpt, author, date, read time; categories Ecosystem News, Founder Guides, Tech Insights, Events & Community, Studies & Resources                                                                  | Wix Blog               |
| Blog post (11)         | /post/slug                       | Hero image, H2 sections, bullet lists, downloadable PDF, author byline, related posts, comments, likes                                                                                                                        | Wix Blog               |
| Partner profile (31)   | /sponsors/slug                   | Logo, name, category (e.g. Hospitality & Hotels), description, image carousel                                                                                                                                                 | CMS collection         |
| Sponsors list          | /sponsors                        | "Sponsors List", items not rendered in the crawl                                                                                                                                                                              | CMS collection         |
| Partners               | /services-9                      | Intro text + 6 Wix placeholder cards                                                                                                                                                                                          | Template leftover      |
| Portrait Entrepreneurs | /team, /team/slug                | One profile (Antoo founder)                                                                                                                                                                                                   | CMS collection         |
| Members                | /members                         | Login wall                                                                                                                                                                                                                    | Wix Members            |
| Fund                   | /fund                            | Crypto donation addresses, marked as a test mockup                                                                                                                                                                            | Static                 |

Recurring formats worth modelling as event series: French Tech Connect (monthly networking, numbered #41 to #57), French Tech Talk (monthly topic at Common Ground), AI Agent episodes, and one-off workshops.

Not captured from here: exact colors, fonts and logo files. My crawler could read page text but not the stylesheets or images, so phase 1 has Claude Code extract them on your machine with a real browser.

## The new site

Twelve Wix page types become 5 public sections and 1 admin area. The look stays the same: palette, fonts and photo style come from the current site in phase 1.

| Section         | Pages                                                                                                                                                         | Replaces on Wix                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Home            | Hero, next events, ecosystem numbers (startups, partners, investors listed), featured organisations, latest posts, WhatsApp CTA                               | Home                                    |
| Ecosystem       | /ecosystem (directory with search and filters, plus a landscape view of logos by category), /ecosystem/slug (profile), /ecosystem/join (listing request form) | /sponsors, /services-9, /team, /members |
| Events          | /events (upcoming, then past by year), /events/slug (details + registration form), confirmation and cancel pages                                              | /events, /event-details-registration/*  |
| Blog            | /blog, /blog/category/slug, /blog/slug                                                                                                                        | /blog, /post/*                          |
| About           | Mission, board, institutional partners, how to join (individuals, startups, partners), contact form                                                           | /about, /fund                           |
| Admin (private) | Dashboard, Events, Registrations, Posts, Ecosystem (incl. pending requests), Settings                                                                         | Wix dashboard                           |

### Ecosystem directory

The directory follows the board deck on the ecosystem directory: one tool holding an open **cartography** that anyone can join by submitting a listing, plus a **Member** badge for organisations whose free membership the board approved. It rolls out in three stages: cartography first, free membership second, member perks (priority registration to Talks and Connects) not before 2027. Every listing is reconfirmed once a year or hidden, which is what keeps the published count honest (Barcelona announces 250 and maintains 72).

**Categories** (the deck's 7): French startups · French companies established in Thailand · French-speaking service providers · Investors · Incubators and coworkings · Schools and universities · Institutions.

**Listing fields:** name, logo, one-line pitch, description, website, LinkedIn, founded year, category, sectors (AI, Fintech, E-commerce, Travel and hospitality, Mobility, Health, Climate and energy, Agritech and food, Industry, Media and gaming, Cybersecurity, SaaS, Other), stage and hiring/raising flags for startups, ticket size for investors, public contact email (optional), 1 to 3 owner emails (private), badges set by the team (Member, sponsor, board, institutional), last confirmed date.

**Public features:** search, filters (category, sector, stage, Member, hiring, raising), a landscape view of logos by category, and on each profile "last confirmed" plus a "Claim or update this listing" link.

#### Submission, updates and annual reconfirmation

There are no user accounts: owners prove they control a listing by clicking one-time links sent to their email.

| Stage       | What triggers it                                                                                          | Public? | Emails                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| Submitted   | Anyone fills /ecosystem/submit (Turnstile, logo upload, consent to publication and yearly reconfirmation) | No      | Verification link to the submitter, valid 7 days; unverified entries deleted after that                       |
| In review   | Email verified                                                                                            | No      | Alert to moderators; target answer within 5 days, as in the deck                                              |
| Published   | Moderator approves                                                                                        | Yes     | Welcome email with the "manage your listing" link; renewal date set to +12 months                             |
| Rejected    | Moderator rejects with a reason                                                                           | No      | Reason sent; they can resubmit                                                                                |
| Updated     | Owner asks for a link at /ecosystem/manage and edits                                                      | Yes     | Name, category, logo or website changes wait for review; other fields go live at once; every change is logged |
| Renewal due | 30 days before the renewal date                                                                           | Yes     | "Still accurate?" with one-click Confirm and Update links, repeated 14 days before and on the day             |
| Expired     | 30 days after the renewal date without confirmation                                                       | No      | Owner told how to reactivate (the same link works for a year); moderators see it in their list                |
| Deleted     | 12 months after expiry                                                                                    | No      | None                                                                                                          |

- **Existing partners:** the 31 current partner profiles are imported as published but unclaimed. Moderators send each known contact an invitation to claim; anyone can also click "Claim this listing", verify their email, and a moderator approves (flagged when the email domain matches the website).
- **Membership (stage 2):** from a published listing, the owner applies for free membership with a short form. The board validates within 5 days and the Member badge appears. Reconfirming the listing each year also renews the membership; an expired listing loses the badge.
- **Member perks (stage 3, 2027):** registration recognises Member emails and can open earlier or reserve seats for them.
- **Moderator load:** a queue in the admin with each item's age against the 5-day target, and a Monday email to moderators with pending counts and the listings expiring that month.

Open board decisions from the deck that the build does not settle: scope (French tech only, or the wider ecosystem; the plan assumes the wider one), who moderates and how often, and voting rights for members (a general assembly decision).

## Target architecture

One Worker runs an Astro app: public pages render from D1 and are cached at the edge for a minute, so an edit in the admin shows up almost immediately. Cloudflare Access sits in front of /admin, so the team logs in with their email and the app never stores passwords.

| Piece            | Choice                                                                                                                           | Why                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Framework        | Astro (latest) with the @astrojs/cloudflare adapter, TypeScript, server output; static pages (About) prerendered                 | One codebase for public site and admin                                     |
| Styling          | Tailwind CSS with tokens taken from the current site                                                                             | Same look, quick to iterate                                                |
| Database         | Cloudflare D1 (SQLite) with Drizzle ORM and SQL migrations in the repo                                                           | Free tier is ample; typed queries; Time Travel restores up to 30 days back |
| Images and files | Cloudflare R2 bucket, served by the Worker at /media/*                                                                           | Admin uploads logos, covers, PDFs without touching Git                     |
| Admin login      | Cloudflare Zero Trust Access policy on /admin/* and /api/admin/* (list of allowed emails); the Worker also checks the Access JWT | No auth code to write or maintain                                          |
| Spam protection  | Cloudflare Turnstile on every public form                                                                                        | Free, no captcha puzzles                                                   |
| Email            | Resend API: registration confirmation with .ics, waitlist promotion, reminder the day before, admin alerts                       | Reliable sending to any address                                            |
| Scheduled jobs   | Worker cron: daily reminders and a weekly D1 export to R2                                                                        | Backups and reminders without another service                              |
| Deploy           | GitHub repo connected to Cloudflare Workers Builds, preview URL per branch                                                       | Push to main = live                                                        |
| Analytics        | Cloudflare Web Analytics                                                                                                         | Cookieless, free                                                           |

Main database tables: `events`, `registrations` (event, name, email, company, role, status registered/waitlist/cancelled/attended, token for cancel link, photo consent, created_at), `posts`, `categories`, `organisations` (the directory, fields as above), `people` (board and institutional contacts), `settings` (menu, socials, contact email), `submissions` (contact and listing requests).

## Phased plan

Eleven phases, each one Claude Code session ending in a commit you can look at. The Wix site stays live until phase 10.

| Phase                  | Outcome                                                                                                                        | You check before moving on                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| 0. Set up              | Repo, CLAUDE.md, Astro + Cloudflare adapter, local D1 and R2                                                                   | `npm run dev` works                                                    |
| 1. Capture             | All Wix content, images, screenshots and design tokens saved                                                                   | Counts: 33 events, 11 posts, 31 partners, 10 board, 3 institutional    |
| 2. Design system       | Layout, header, footer, components matching the current look                                                                   | Side-by-side with Wix screenshots, desktop and mobile                  |
| 3. Database and import | D1 schema, migrations, seed from the capture, images in R2                                                                     | Local DB holds everything; spot-check 3 posts, 3 events                |
| 4. Public pages        | Home, Events, Blog, About reading from D1                                                                                      | Every page on phone and desktop                                        |
| 5. Ecosystem directory | Directory, submission with email check, owner updates, claims, annual reconfirmation reminders, membership (off until stage 2) | A test listing goes through submit, approve, update and yearly confirm |
| 6. Admin               | /admin for posts, events, ecosystem (approve requests), people, settings, image upload                                         | You create, edit and unpublish a post and an event                     |
| 7. Event registrations | Registration form, capacity, waitlist, emails, attendee list, CSV, check-in                                                    | Register, cancel, get promoted from waitlist, check in on a phone      |
| 8. SEO and quality     | Meta, sitemap, RSS, JSON-LD, redirects from every old URL, Lighthouse 95+                                                      | Redirect checker passes                                                |
| 9. Deploy              | Live on workers.dev with Access, D1, R2, secrets, cron, Workers Builds                                                         | Board members test on the preview URL                                  |
| 10. Cutover            | Custom domain, Wix retired                                                                                                     | Old URLs redirect, email still works                                   |

For phases 2 to 7, start Claude Code in plan mode (Shift+Tab), read its plan before it writes, and let it commit at the end.

## Claude Code prompts

Paste one prompt per session, in order, from the repo folder on your machine. Phase 1 must run where the Wix site is reachable (your machine), because it drives a real browser against the live site.

### Phase 0: set up the repo

Before pasting: install Node 20+, create an empty GitHub repo `ft-bkk-site`, clone it, export this doc as Markdown into docs/plan.md, then run `claude` inside it.

```text
We are rebuilding https://www.french-tech-bangkok.com/ (currently on Wix) from scratch. Keep the same look. The new site is simpler (Home, Ecosystem, Events, Blog, About) plus a private /admin where the team manages blog posts, events, event registrations and an ecosystem directory of local startups, corporates, investors, institutions and service providers. It runs as one Cloudflare Worker. This session only sets up the project.

1. Scaffold Astro (latest, TypeScript strict) with the @astrojs/cloudflare adapter, output "server", Tailwind CSS, Prettier, ESLint. Use npm.
2. Add wrangler and a wrangler.jsonc: name "ft-bkk-site", current compatibility_date, nodejs_compat flag, a D1 binding DB (database_name "ftbkk"), an R2 binding MEDIA (bucket "ftbkk-media"), and placeholders for the vars ACCESS_TEAM_DOMAIN, ACCESS_AUD and TURNSTILE_SITE_KEY. Add .dev.vars.example listing the secrets TURNSTILE_SECRET and RESEND_API_KEY.
3. Add Drizzle ORM + drizzle-kit configured for D1 with migrations in ./migrations, and npm scripts: dev, build, preview (wrangler dev), deploy, check (astro check + eslint), db:generate, db:migrate:local, db:migrate:remote.
4. Create folders: docs/, migration/ (gitignore everything except migration/data and migration/README.md), scripts/.
5. Write CLAUDE.md with these conventions:
   - Stack: Astro on Cloudflare Workers, D1 via Drizzle, R2 for media, Tailwind, Cloudflare Access protects /admin and /api/admin, Turnstile on public forms, Resend for email.
   - Content (posts, events, organisations, people, settings) lives in D1, never hardcoded in components. Public pages send Cache-Control: public, s-maxage=60.
   - Colors, fonts and spacing come from docs/design-tokens.md through the Tailwind config; no raw hex values in components.
   - Every page works at 390px and 1440px, has one h1, alt text, visible focus states and AA contrast.
   - Every server handler validates input with Zod. Admin handlers must call requireAdmin() which verifies the Cf-Access-Jwt-Assertion JWT against ACCESS_TEAM_DOMAIN and ACCESS_AUD (skipped only when running locally).
   - Old Wix URLs keep working through redirects.
   - Before saying a task is done: npm run check and npm run build pass. Commit at the end of each phase.
6. Commit as "chore: scaffold Astro + Cloudflare Worker project" and tell me how to run it.
```

### Phase 1: capture the current site

```text
Read CLAUDE.md. Capture everything from the live Wix site so we never need Wix again. It is our own site. Use Playwright (dev dependency, Chromium only) because Wix renders with JavaScript; wait for network idle and scroll to the bottom before reading each page.

1. Read https://www.french-tech-bangkok.com/sitemap.xml and every child sitemap. Save all URLs to migration/data/urls.json grouped by type.
2. For every URL save the rendered HTML to migration/raw/ and full-page screenshots at 1440px and 390px to migration/screenshots/.
3. Extract into migration/data/:
   - events.json: slug, title, start and end datetime (Asia/Bangkok), venue, address, description as Markdown, cover image, series (French Tech Connect, French Tech Talk, AI Agent, Workshop, Other), past or upcoming. Check JSON-LD first, then the DOM. Mark the "test-title" event as junk.
   - posts.json: slug, title, excerpt, author, date, read time, categories, cover image, body as clean Markdown (turndown; keep headings, lists, links, images, tables), attached files (download PDFs too).
   - organisations.json: from each /sponsors/slug page: name, slug, category, description, logo, gallery images, website if present.
   - people.json: the 10 board members (name, title, company, LinkedIn, photo) and 3 institutional representatives (name, title, organisation, photo) from the home and about pages.
   - pages.json: home and about copy section by section, and the footer (email, social links, WhatsApp invite).
4. Download every image at original resolution (for static.wixstatic.com/media/ URLs strip the /v1/... suffix) to migration/images/ with readable names; record old URL to file in migration/data/images.json. Include the logo and favicon.
5. Design tokens: on home, about, events, one event and one post, read computed styles (font-family, sizes, weights, line-height, colors, backgrounds, radius, button styles) for body, h1 to h3, nav, buttons, cards, header and footer, plus any --color_* or --font_* CSS variables. Write docs/design-tokens.md with the palette (name, hex, usage), type scale, spacing, radius, and for each Wix font the closest free font if the original is not freely licensed.
6. Write migration/README.md with counts per type and anything broken or inconsistent. Commit migration/data, migration/README.md and docs/design-tokens.md.
```

### Phase 2: design system

```text
Read CLAUDE.md and docs/design-tokens.md, and look at migration/screenshots/ (home and about at 1440 and 390). Build the design system so the new site looks like the current one, cleaned up but recognisable.

1. Put tokens in the Tailwind config and self-host fonts with @fontsource.
2. Create BaseLayout (lang="en", SEO head with title, description, canonical, Open Graph, favicon), AdminLayout (sidebar: Dashboard, Events, Registrations, Posts, Ecosystem, People, Settings), and components: Header (logo; nav Home, Ecosystem, Events, Blog, About; "Join the community" button; accessible mobile menu), Footer (nav, email, Instagram, WhatsApp, Facebook, LinkedIn, YouTube as inline SVG), Button, Section, Card, EventCard, PostCard, PersonCard, OrgCard, Badge, FilterChips, FormField, Alert.
3. Make a /styleguide page (dev only) showing every component and the palette; compare with the screenshots and fix spacing, sizes and colors.
4. Commit.
```

### Phase 3: database and import

```text
Read CLAUDE.md. Create the database and load the captured content.

1. Drizzle schema in src/db/schema.ts:
   - events: id, slug, title, series, summary, body_md, starts_at, ends_at, timezone, venue, address, map_url, cover_key, capacity (nullable = unlimited), registration_open, registration_closes_at, status (draft/published/cancelled), created_at, updated_at.
   - registrations: id, event_id, name, email, company, role, how_heard, photo_consent, status (registered/waitlist/cancelled/attended), token, created_at, checked_in_at. Unique (event_id, email).
   - posts: id, slug, title, excerpt, body_md, cover_key, author_name, author_role, published_at, status, attachments JSON.
   - categories and post_categories (Ecosystem News, Founder Guides, Tech Insights, Events & Community, Studies & Resources).
   - organisations: id, slug, name, logo_key, cover_key, pitch, description_md, category (french_startup/french_company/service_provider/investor/incubator_coworking/school/institution), sectors JSON, stage, team_size, hiring, raising, ticket_size, french_link, badges JSON (sponsor/board/institutional), website, linkedin, founded_year, public_email, owner_emails JSON, status (unverified/pending/published/rejected/expired/hidden), confirmed_at, renewal_due_at, expired_at, member_status (none/applied/member/lapsed), member_since, created_at, updated_at.
   - org_changes (pending owner edits), claims, membership_applications, magic_tokens (token_hash, purpose, org_id, email, expires_at, used_at), reminders_sent (org_id, kind, sent_at), audit_log (actor, action, entity, before and after JSON, at).
   - people: id, name, title, organisation_id, group (board/institutional), linkedin, photo_key, sort_order.
   - settings (key, value JSON) and submissions (id, type, payload JSON, created_at, handled).
2. Generate and apply migrations locally.
3. scripts/import.ts: upload migration/images to local R2 (wrangler r2 object put --local) under events/, posts/, orgs/, people/; insert all events (skip junk), posts, categories, organisations (from the sponsors, with the sponsor badge; Franco-Thai Chamber of Commerce, French Treasury and Business France with the institutional badge; board members' companies with the board badge; map the Wix category to category and sectors, leave owner_emails empty (unclaimed)), people, and settings from pages.json. Idempotent, upsert on slug.
4. Add src/pages/media/[...key].ts that streams R2 objects with long cache headers.
5. Run it, print counts per table, commit (not the local DB).
```

### Phase 4: public pages

```text
Read CLAUDE.md, docs/design-tokens.md and migration/data/pages.json; look at the matching screenshots before each page. Build public pages reading from D1 through small query functions in src/lib/queries.ts. Reuse the original copy verbatim.

- / : hero ("Support your venture with our network", CTA to events), 3 mission pillars, next 2 upcoming events, ecosystem numbers (published organisations by type), 6 featured organisations, 3 latest posts, board grid, institutional partners, WhatsApp CTA.
- /events : upcoming (soonest first), then past grouped by year; filter by series. /events/[slug]: date and time in Bangkok time, Add to calendar (.ics endpoint), venue with Google Maps link, description (Markdown rendered and sanitised), the photo-consent notice, and a placeholder where the registration form goes in phase 7.
- /blog, /blog/category/[slug], /blog/[slug]: cover, author, date, read time from word count, typography plugin, attachments as downloads, 3 related posts.
- /about : who we are, how to join (individuals, startups, partners), board, institutional partners, contact form (Zod + Turnstile, stored in submissions, email alert to the settings contact address via Resend; skip email when RESEND_API_KEY is missing).
- 404 page.
Only published rows appear. Check each page at 390px and 1440px with Playwright screenshots in migration/compare/, fix gaps against the old screenshots, commit.
```

### Phase 5: ecosystem directory

```text
Read CLAUDE.md and the "Ecosystem directory" section of docs/plan.md. Build the directory and the full listing lifecycle: submission, review, owner updates, claims, annual reconfirmation, and membership. No user accounts: owners prove control of a listing through one-time email links.

1. /ecosystem: counts by category, search, filters (category, sector, stage, Member badge, hiring, raising) kept in the URL query, grid of OrgCards, and a "Landscape" toggle grouping logos by category. Only status published. Load one JSON payload and filter with a small vanilla TS island.
2. /ecosystem/[slug]: profile with badges, "last confirmed <month year>", related listings, JSON-LD Organization, and a "Claim or update this listing" link.
3. /ecosystem/submit: all listing fields, logo upload to R2 under orgs/pending/ (max 2 MB, png/jpg/svg/webp), Turnstile, consent to publication and to yearly reconfirmation. Creates the listing as unverified and emails a verification link valid 7 days. Clicking it sets status pending and alerts moderators.
4. src/lib/tokens.ts: random tokens, only a SHA-256 hash stored in magic_tokens with purpose (verify, manage, confirm, claim), org_id, email, expiry (30 min for manage, 45 days for confirm), single use. Rate-limit token requests per email and per IP.
5. /ecosystem/manage: asks for an email and always answers with the same neutral message; if the email owns listings, send a manage link. The edit page changes every field and manages co-owner emails (max 3). Changes to name, category, logo or website go to org_changes for review; other fields publish at once. Every change is written to audit_log.
6. Claims: on listings with no owner_emails, "Claim this listing" verifies an email by link, then creates a claim for moderators, flagged "domain matches website" when the email domain equals the website domain.
7. Annual reconfirmation. On approval set confirmed_at = now and renewal_due_at = now + 12 months. Create the Worker scheduled handler through the adapter's custom worker entry with a daily cron at 09:00 Asia/Bangkok that: sends "Is your listing still accurate?" with one-click Confirm and Update links at 30 days, 14 days and 0 days before renewal_due_at (confirming resets both dates); sets status expired 30 days after renewal_due_at without confirmation, hides it, emails the owner how to reactivate (the confirm link stays valid), and lists it for moderators; deletes expired listings 12 months after expiry; deletes unverified submissions older than 7 days. Record every reminder in reminders_sent so nothing is sent twice. Unclaimed listings get no reminders; they appear in the moderators' digest instead.
8. Moderator digest every Monday to settings.moderator_emails: pending listings, pending changes, claims and membership applications with the oldest age against the 5-day target, plus listings expiring this month.
9. Membership, behind settings flag membership_open (default off): on a published listing the owner applies for the free membership (contact person, role, short motivation, acceptance of the community charter). Approval in admin sets member_status member and shows the Member badge. Reconfirming the listing renews membership; an expired listing sets member_status lapsed.
10. Create src/lib/email.ts with one branded HTML template and plain-text fallback, sent through Resend; reuse it for every email on the site.
11. Redirect /sponsors, /sponsors/*, /services-9, /team, /team/* and /members to the matching /ecosystem URLs. Add an Ecosystem teaser to the home page.
12. Tests: Vitest for tokens and expiry, renewal date maths and the cron's reminder selection with a fixed clock; one Playwright test for submit, verify, approve, manage, confirm. Commit.
```

### Phase 6: admin area

```text
Read CLAUDE.md. Build /admin for non-technical volunteers. Every /admin page and /api/admin endpoint calls requireAdmin(). Keep it plain server-rendered forms with small enhancements; no SPA framework.

1. Dashboard: next events with registration counts, pending ecosystem requests, latest contact submissions.
2. Posts: list with status filter; create and edit with title, slug (auto from title, editable), excerpt, categories, cover upload, Markdown editor with live preview (EasyMDE or a textarea plus preview), attachments upload, publish date, draft/published. Delete asks for confirmation.
3. Events: list (upcoming, past); create, edit, duplicate (for monthly French Tech Connect), cancel; fields from the schema including capacity and registration closing time.
4. Ecosystem: a moderation queue (new listings, pending changes, claims, membership applications) showing each item's age against the 5-day target; approve or reject with a reason that is emailed; edit, hide, set badges; a renewals view (due in 30 days, expired, unclaimed) with a "send invitation to claim" action; the audit log on each listing.
5. People (board and institutional, drag to reorder) and Settings (contact email, social links, WhatsApp link, home hero text).
6. Uploads go to R2 through /api/admin/upload with type and size checks; images show a preview.
7. After a save, show a success toast and note that public pages refresh within a minute (60s edge cache).
8. Locally requireAdmin() accepts a fake admin email from .dev.vars. Write docs/admin.md: how to add an admin (Access policy email list), and a short guide for volunteers with screenshots of each screen. Commit.
```

### Phase 7: event registrations

```text
Read CLAUDE.md. Replace Wix Events RSVP with our own registration.

1. On /events/[slug], when the event is upcoming and registration is open: a form (name, email, company, role, how did you hear, photo consent required, Turnstile). Show "X spots left" when capacity is set, and "Join the waitlist" when full.
2. POST /api/events/[slug]/register: validate, reject duplicates (same email, same event) with a friendly message, insert as registered or waitlist inside one D1 batch so capacity is never exceeded, send a confirmation email via Resend with date, venue, map link, an .ics attachment and a cancel link (/events/[slug]/cancel?token=...).
3. Cancel page: marks cancelled, promotes the first waitlisted person and emails them.
4. Worker cron (scheduled handler, daily 09:00 Bangkok): reminder email to registered attendees of events happening the next day; weekly export of all tables to R2 as JSON for backup. Add these jobs to the scheduled handler created in phase 5.
5. Admin: Registrations page per event with counts by status, search, mark attended, move from waitlist, export CSV, and a mobile check-in view (/admin/events/[id]/checkin: big search box, one tap to check in).
6. Emails: reuse src/lib/email.ts.
7. Member priority, off by default (settings flag member_priority, stage 3, not before 2027): an event can open registration N days earlier, or reserve N seats, for owner emails of Member listings.
8. Tests: unit tests (Vitest) for capacity, waitlist and member priority logic, and one Playwright test for register, cancel and promotion against wrangler dev. Commit.
```

### Phase 8: SEO, redirects and quality

```text
Read CLAUDE.md. Make the site production quality.

1. /sitemap.xml generated from D1 (pages, published events, posts, organisations), robots.txt, /rss.xml for the blog, JSON-LD: Organization site-wide, Event on events (location, dates, isAccessibleForFree, offers 0 THB), BlogPosting on posts.
2. Redirect map in src/lib/redirects.ts handled by middleware with 301s: /post/:slug -> /blog/:slug, /event-details-registration/:slug -> /events/:slug, /sponsors/:slug -> /ecosystem/:slug, /sponsors, /services-9, /team, /members -> /ecosystem, /fund -> /about. scripts/check-redirects.ts tests every URL in migration/data/urls.json against a given base URL and reports anything not ending in 200.
3. Lighthouse (mobile) on /, /ecosystem, /events, one event, one post: fix until 95+ on all four scores. Check contrast of the palette.
4. Add Cloudflare Web Analytics (token from settings). Commit.
```

### Phase 9: deploy to Cloudflare

Before pasting: run `npx wrangler login` once in the repo.

```text
Read CLAUDE.md and docs/admin.md. Deploy to my Cloudflare account on the workers.dev URL. Do not touch DNS yet.

1. Create the remote D1 database and R2 bucket with wrangler, put the ids in wrangler.jsonc, apply migrations remotely, and run the import against remote (D1 and R2).
2. Add the cron triggers to wrangler.jsonc.
3. Give me step-by-step dashboard instructions for: a Zero Trust Access application covering <workers.dev host>/admin* and /api/admin* (later also www.french-tech-bangkok.com) with an allow policy for our board emails and one-time PIN login, then where to copy the team domain and AUD into wrangler vars; a Turnstile widget for the workers.dev host and french-tech-bangkok.com; a Resend account with the domain verified (list the DNS records it needs).
4. Tell me the wrangler secret put commands for TURNSTILE_SECRET and RESEND_API_KEY.
5. Deploy, run scripts/check-redirects.ts against the URL, and walk the main flows (register, cancel, listing request, admin edit).
6. Write docs/deploy.md: connecting the repo to Cloudflare Workers Builds (build: npm run build, deploy: npx wrangler deploy, previews for branches), how migrations are applied on deploy, and how to restore D1 with Time Travel. Commit.
```

## Phase 10: domain cutover and launch

The Worker can only take the custom domain once the french-tech-bangkok.com zone is on Cloudflare, so the order below protects email first and moves the website last. The current canonical host is www, so keep www as primary and redirect the bare domain to it.

- [ ] Find where the domain is registered (Wix or another registrar) and where hello@ email is hosted
- [ ] Export from Wix anything phase 1 missed: event attendee lists (CSV from Wix Events), blog comments if wanted, form submissions, member contacts
- [ ] Add the domain to Cloudflare; compare the imported DNS records with the current ones and copy every MX, SPF, DKIM, DMARC and verification TXT record exactly
- [ ] Lower TTLs, then switch the nameservers at the registrar to Cloudflare's (in Wix: Domains, then use external nameservers); wait for the zone to show Active
- [ ] Send a test email to and from hello@ to confirm mail still flows
- [ ] Run the prompt below to attach the domain to the Worker
- [ ] Check old URLs redirect, forms submit, Turnstile accepts the real hostname
- [ ] Add the site to Google Search Console and submit /sitemap-index.xml; update the link on Instagram, LinkedIn, Facebook and YouTube bios if they point to old paths
- [ ] Keep the Wix plan for about a month as a fallback, then cancel it (after confirming the domain is no longer billed through Wix)

```text
Read CLAUDE.md and docs/deploy.md. The french-tech-bangkok.com zone is now active on Cloudflare. Attach www.french-tech-bangkok.com and french-tech-bangkok.com to the ft-bkk-site Worker as custom domains in wrangler.jsonc (routes with custom_domain true), make the bare domain 301 to https://www.french-tech-bangkok.com preserving path and query, and deploy. Do not change or delete any existing DNS record, especially MX and TXT. Then run scripts/check-redirects.ts against https://www.french-tech-bangkok.com, check every page in src/pages returns 200, submit a test to each form, and report anything failing. Update docs/deploy.md with the final setup and commit.
```
