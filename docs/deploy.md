# Deploy and Cloudflare setup

The site is one Cloudflare Worker, `ft-bkk-site`, deployed by **Workers Builds** from GitHub.
Everything below is done once, in the Cloudflare dashboard, by the account owner.

## 1. Image storage (R2 bucket)

Before the first deploy, create the bucket by hand (wrangler does not create it if R2 has never
been used on the account):

1. Dashboard > **R2 Object Storage**. If asked, activate R2 (a card is required; the free tier
   covers this site).
2. **Create bucket**, name `ftbkk-media`, default location.

## 2. Workers Builds (Worker > Settings > Build)

Set the build command on **both** tabs, Production and Previews Base.

| Setting                              | Value                          |
| ------------------------------------ | ------------------------------ |
| Build command                        | `npm run build`                |
| Deploy command                       | `npm run deploy:ci`            |
| Builds for non-production branches   | on                             |
| Non-production branch deploy command | `npx wrangler versions upload` |
| Root directory                       | `/`                            |

Do not use `npx wrangler preview`: it needs a separate `previews` config and skips the build.

Merging to `main` deploys to production and then applies the D1 migrations (`deploy:ci`). The
first deploy creates the `ftbkk` D1 database automatically (the R2 bucket comes from step 1).
Other branches upload a preview version with its own URL (shown on the PR check). Previews share
the production database, and migrations only run from `main`.

A branch that adds migrations (new tables or columns) therefore fails on its preview URL with
errors such as `no such column`, and right after the merge production serves the new code for a
few seconds before the migrations finish. When the new migrations only add tables and columns
(the old code ignores them), apply them before merging, from your computer on the branch:

```sh
npm run db:migrate:remote   # applies the branch's pending migrations to the production D1
```

The preview then works, and the merge deploy finds nothing left to apply. Don't do this for a
migration that drops or renames something the code on `main` still uses.

## 3. Load the content

On your computer, once: `npx wrangler login`. Then:

```sh
npm run capture                # optional: crawl the Wix site into migration/data
npm run import -- --remote     # events, posts, organisations, people, settings and images
```

The import can be run again safely (it updates rows by slug and never overwrites settings
edited in the admin unless you pass `--force-settings`).

## 4. Admin login (Cloudflare Access)

Until this is done, `/admin` answers **403** in production (it fails closed).

1. Zero Trust > Access > Applications > **Add an application** > Self-hosted.
2. Name it "FT Bangkok admin". Add two destinations on the Worker's host (the `workers.dev`
   address for now, `www.french-tech-bangkok.com` later): path `admin` and path `api/admin`.
3. Policy: Allow, rule **Emails**, list the board members who manage the site.
4. Login methods: **One-time PIN** (code by email, no password).
5. Copy two values into `wrangler.jsonc` > `vars` (they are not secret):
   - `ACCESS_TEAM_DOMAIN`: your team domain, e.g. `ftbkk.cloudflareaccess.com` (Zero Trust >
     Settings > Team name).
   - `ACCESS_AUD`: the application's **Application Audience (AUD) Tag** (application > Overview).

To add an admin later, add their email to the policy. Nothing changes in the code.

## 5. Forms anti-spam (Turnstile)

Until this is done, forms use Cloudflare's test keys, which let every submission through.

1. Dashboard > Turnstile > **Add widget**, mode Managed, hostnames: the `workers.dev` host and
   `french-tech-bangkok.com`.
2. Put the **Site key** in `wrangler.jsonc` > `vars` > `TURNSTILE_SITE_KEY`.
3. Add the **Secret key** as a secret named `TURNSTILE_SECRET`: Worker > Settings > Variables and
   Secrets > Add > type Secret (or `npx wrangler secret put TURNSTILE_SECRET`).

## 6. Email (Resend)

Until this is done, no email is sent (confirmations, reminders and listing links are only logged).

1. Create an account at resend.com and add the domain `french-tech-bangkok.com`.
2. Add the DNS records Resend lists (an SPF TXT and an MX on the `send` subdomain, a DKIM TXT on
   `resend._domainkey`, and optionally a DMARC TXT) where the domain's DNS is hosted, then click
   Verify.
3. Create an API key (sending access) and add it as a secret named `RESEND_API_KEY`, as for
   Turnstile above.
4. The sender is `EMAIL_FROM` in `wrangler.jsonc`. Until the domain is verified it is Resend's
   test sender `onboarding@resend.dev`, which only delivers to the email address of the Resend
   account: register and submit forms with that address to test. Once verified, set it to
   `La French Tech Bangkok <hello@french-tech-bangkok.com>`. Verifying the domain only adds DNS
   records: the Wix site and the domain's existing mailboxes keep working.
5. Until we control the DNS of french-tech-bangkok.com, the site sends from
   `noreply@mail.delattre.me` (Eric's domain, verified in Resend with its records in Cloudflare).
   Any verified domain works: change `EMAIL_FROM` in `wrangler.jsonc` and deploy. A value set only
   in the Cloudflare dashboard is overwritten by the next deploy.

## 7. Connect LinkedIn and Facebook (optional)

Until this is done, scheduled social media posts arrive by email to post by hand (Admin > Social
media says which pages are connected). WhatsApp has no posting API and always works by email.

**Facebook page**

1. At developers.facebook.com create an app (type Business) and add the Pages API.
2. In the Graph API Explorer, pick the app, ask for `pages_manage_posts` and
   `pages_read_engagement`, then get a **Page** access token for La French Tech Bangkok's page.
   Exchange it for a long-lived one (Access Token Debugger > Extend): a page token made from a
   long-lived user token does not expire.
3. Put the page's numeric ID in `FACEBOOK_PAGE_ID` in `wrangler.jsonc` and deploy, then add the
   token as a secret: Worker > Settings > Variables and Secrets > Add > Secret, name
   `FACEBOOK_PAGE_TOKEN` (or `npx wrangler secret put FACEBOOK_PAGE_TOKEN`).

**LinkedIn page**

1. At linkedin.com/developers create an app linked to the La French Tech Bangkok page (a page
   admin must verify it), then request the **Community Management API** product. LinkedIn
   reviews this request; it can take some days.
2. Once granted, generate a token with the `w_organization_social` scope for a page admin
   (Auth > OAuth 2.0 tools). It lasts 60 days: when it expires, the scheduled post falls back to the
   email and the error says to renew it.
3. Put the page's numeric ID (in the page admin URL, `/company/<id>/admin`) in
   `LINKEDIN_ORGANIZATION_ID` in `wrangler.jsonc` and deploy, then add the secret
   `LINKEDIN_ACCESS_TOKEN`.

Link previews (on Facebook, and when you paste a link in WhatsApp or LinkedIn) read the page's
share image, so the site must be reachable without the Access login: Access must only cover
`/admin` and `/api/admin`.

## 8. In the admin

- Settings > **Directory moderators**: who gets listing requests and the Monday digest.
- Settings > **Cloudflare Web Analytics token** (Dashboard > Analytics & Logs > Web Analytics >
  add the site), if you want visitor stats.

## Backups and restore

- D1 keeps 30 days of history: `npx wrangler d1 time-travel restore ftbkk --timestamp=<ISO date>`
  restores the database to that moment (`time-travel info` shows the current bookmark first).
- Every Sunday the cron also writes a JSON export of all tables to R2 under `backups/` (12 weeks
  kept, never served publicly).

## Later: the domain

When the site is ready to replace Wix: move `french-tech-bangkok.com` DNS to Cloudflare (or add a
CNAME), add `www.french-tech-bangkok.com` as a Custom Domain on the Worker, add the hostname to
the Access application and the Turnstile widget, set `SITE_URL` in `wrangler.jsonc` back to
`https://www.french-tech-bangkok.com` (links in emails, canonical URLs, the sitemap and social
images use it; the workers.dev address then answers with `noindex`), then run
`npm run check:redirects -- https://www.french-tech-bangkok.com`. Finally add the domain in Google
Search Console and submit `https://www.french-tech-bangkok.com/sitemap.xml`.
