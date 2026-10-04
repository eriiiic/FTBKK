# Admin guide

The admin lives at `/admin`. Cloudflare Access asks for your email and sends a one-time code;
only emails on the Access policy get in. Every change is saved straight to the live site (public
pages refresh within a minute) and recorded in Ecosystem > History.

## Posts

- **New post**: title, text (Markdown), then **Save**. Leave it as _Draft_ until it is ready.
- **Insert image** in the editor uploads an image and inserts it where your cursor is. Use
  **Preview** to see the result.
- **PDFs**: **Attach PDF** in the editor, or the **PDF attachments** panel on the right, uploads the
  file and adds it to the post's list. **Insert** places a download button at the cursor as a tag,
  `{{download: report.pdf | Download the full report}}`; the words after `|` are the button text.
- **Authors**: one row per author (name, role, LinkedIn link); **+ Add an author** for co-authors.
  A byline typed at the top of the text (By … / role / La French Tech Bangkok) moves to these rows
  when you open or save the post; the Posts list has a button to do it for every post at once.
- A **publication date** in the future schedules the post. Empty means now.
- Categories: tick existing ones or type a new one.
- Old posts can be deleted at the bottom of the page.

## Files

Every uploaded PDF, with where it is used. Copy a link, upload new ones, or delete a file nothing
uses any more.

## Events

- **New event**: title, type, start time (Bangkok time), venue, then publish.
- **Duplicate** (on an event page) copies everything except the dates, handy for the next French
  Tech Connect.
- **Capacity** empty means unlimited. When full, people join the waitlist.
- **Cancel the event** keeps it on the site with a "Cancelled" label and closes registration.

## Registrations

- People register on the event page (name, email, company, role, photo notice). They get a
  confirmation with a calendar invite and a cancel link, and a reminder the day before.
- When the event is full, new people join the **waitlist**. If someone cancels, the first person
  on the waitlist is registered automatically and emailed.
- **Registrations** (or the count on the Events page): counts, search, check in, register someone
  from the waitlist (this can go over capacity), cancel, and **Export CSV** for Excel.
- **Check-in mode** is made for a phone at the door: type a few letters of the name and tap to
  check the person in. Tap again to undo.
- Cancelling an event emails everyone registered or on the waitlist.
- Every Sunday a JSON backup of the database is saved to R2 under `backups/` (the last 12 weeks
  are kept). It is never served publicly.

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
