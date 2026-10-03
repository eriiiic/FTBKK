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
4. The sender is `EMAIL_FROM` in `wrangler.jsonc` (`hello@french-tech-bangkok.com`).

## 7. In the admin

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
the Access application and the Turnstile widget, then run
`npm run check:redirects -- https://www.french-tech-bangkok.com`.
