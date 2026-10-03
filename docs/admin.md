# Admin guide

The admin lives at `/admin`. Cloudflare Access asks for your email and sends a one-time code;
only emails on the Access policy get in. Every change is saved straight to the live site (public
pages refresh within a minute) and recorded in Ecosystem > History.

## Posts

- **New post**: title, text (Markdown), then **Save**. Leave it as _Draft_ until it is ready.
- **Insert image / Attach PDF** in the editor uploads the file and inserts a link where your cursor
  is. Use **Preview** to see the result.
- A **publication date** in the future schedules the post. Empty means now.
- Categories: tick existing ones or type a new one.
- Old posts can be deleted at the bottom of the page.

## Events

- **New event**: title, type, start time (Bangkok time), venue, then publish.
- **Duplicate** (on an event page) copies everything except the dates, handy for the next French
  Tech Connect.
- **Capacity** empty means unlimited. When full, people join the waitlist.
- **Cancel the event** keeps it on the site with a "Cancelled" label and closes registration.

## Ecosystem

- **To review**: new listing requests, owner changes to name, category, logo or website, claims and
  membership applications, oldest first. Aim to answer within 5 days (the badge turns red after).
  **Approve**, or write a short reason and **Reject**. The person gets an email either way.
- **All listings**: search and open any organisation to edit it, set badges (Member, Sponsor,
  Board, Institutional partner), change its owners or hide it. Hiding is better than deleting.
- **Renewals**: owners confirm their listing once a year (reminders at 30 and 14 days before and on
  the day). Unconfirmed listings are hidden 30 days later and deleted after 12 months. Unclaimed
  listings get no reminders: use **Send** to invite someone you know there to claim it.
- **History**: who changed what, and when.

Moderators also get an email for each new request and a summary every Monday. Set who receives
them in Settings > Directory moderators.

## People, Messages, Settings

- **People**: board and institutional partners on the About page. Use ↑ ↓ to reorder.
- **Messages**: contact form messages. Mark them handled once answered.
- **Settings**: home and about texts, social links, contact email, moderators, membership switches
  and the analytics token.

## For developers

- Every `/admin` page and `/api/admin` endpoint goes through `requireAdmin()` in
  `src/middleware.ts`, which verifies the Cloudflare Access JWT (`src/lib/auth.ts`). Locally,
  with `ACCESS_AUD` empty, `DEV_ADMIN_EMAIL` from `.dev.vars` is used, on localhost only.
- Pages are plain server-rendered forms that redirect with `?saved=1`. The only scripts are the
  Markdown editor (`src/components/admin/MarkdownEditor.astro`), the confirm prompt on destructive
  forms and the saved toast.
- `POST /api/admin/upload` (multipart `file`, `kind=image|file`) returns `{ key, url }`.
  `POST /api/admin/preview` (`{ md }`) returns `{ html }`.
