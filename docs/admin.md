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
- **Recap** (at the bottom of an event's page, about 10 minutes after the event): add photos
  (select several at once, up to 20 per save, 5 MB each), reorder them with the arrows, give them
  an optional alt text or caption, or tick "Remove" (the file is deleted). Upload the speakers'
  slides as PDFs (the file name becomes the label, which you can edit) or paste a link to them,
  paste the video link (YouTube or Vimeo play on the page, other sites open in a new page), and
  pick the blog write-up among published posts. Click **Save the recap**. It shows on the event
  page once the event has passed, and the event gets a "Recap" badge in the past events list.
  Uploaded slides also appear in **Files**, used by the event.

## Registrations

- People register on the event page (name, email, company, role, photo notice). They get a
  confirmation with a calendar invite and a cancel link, and a reminder the day before.
- When the event is full, new people join the **waitlist**. If someone cancels, the first person
  on the waitlist is registered automatically and emailed.
- **Registrations** (or the count on the Events page): counts, search, check in, register someone
  from the waitlist (this can go over capacity), cancel, and **Export CSV** for Excel.
- **Check-in mode** is made for a phone at the door: type a few letters of the name and tap to
  check the person in. Tap again to undo. Door volunteers can bookmark
  `/checkin` on their phone: it opens a list of today's and upcoming events (after the admin
  login), and tapping one opens its check-in mode. They must be allowed in Cloudflare Access.
- **Walk-ins**: on the check-in screen, **+ Walk-in** (or **Add as a walk-in** when a search
  finds nobody) adds someone who didn't register and checks them in. Only the name is required.
  If the email is already registered for the event, that registration is checked in instead.
  Walk-ins are marked in Registrations and in the CSV export.
- **Contacts** lists everyone who ever registered or walked in, one line per person (by email;
  walk-ins without an email are grouped by name). It shows how many events each person attended,
  registered for and missed (registered for a past event where check-in was used, but not
  checked in), and the ecosystem listings their email manages or is the contact for. Filter by
  "came at least once", "came 2 times or more", "registered, never came", "linked to an
  ecosystem listing" or by event, then **Export CSV** (the export keeps the filters). Click a
  name to see their full event history. Details come from their latest registration.
- On a contact's page: **Email**, **WhatsApp** (Thai numbers starting with 0 get +66) and
  **Call** buttons, and **Edit** for name, email, phone, company, role, LinkedIn and team notes.
  Once edited, the saved details win over what the person types in later registrations. Changing
  the email moves their registrations to the new one; if that email already registered, the two
  merge. Adding an email to a walk-in groups their future registrations with it. **New contact**
  adds someone who never registered. **Delete this contact** removes them and all their
  registrations (their seats on upcoming events go to the waitlist). **Copy emails** on the list
  copies the filtered addresses for the Bcc field of an email.
- Cancelling an event emails everyone registered or on the waitlist.
- **Email registrants** (on an event's page, or the button in Registrations) sends your own
  message to the people of one event: a venue change, the slides after the talk, a last-minute
  reminder. Choose who gets it (**Registered**, **Checked in**, **Waitlist** or **Everyone not
  cancelled**; each shows how many people that is), write a subject and a plain-text message
  (leave a blank line between paragraphs; `{name}` becomes the person's first name), and
  optionally a button with its link (for example "Download the slides"). The email uses the
  site's usual layout and adds the event's date, venue and a link to its page. **Send me a test**
  sends it to you only. **Send** asks for confirmation with the number of people. Replies go to
  the contact address in Settings. Walk-ins without an email are skipped, and the same email
  can't go to the same people twice within 10 minutes unless you tick "Send it again". Everything
  sent is listed on that page, with who sent it and to how many people.
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

- **People**: board and institutional partners on the About page, with their job title and
  company. Use ↑ ↓ to reorder.
- **Messages**: contact form messages, filed in folders: Inbox, Answered, Handled, Spam and
  Deleted. Nothing is ever removed, so every folder keeps a record; "Back to inbox" undoes any
  move. **Reply** opens your mail app with the message quoted; mark it answered afterwards.
  **Spam…** blocks the sender's address (or their whole company domain; webmail domains like
  gmail.com can only be blocked address by address). Later messages from a blocked sender land
  in Spam silently, with no email to the team. Manage the list under Spam > Blocked senders.
  Tick several messages to move them at once; search covers every field and the team notes.
  **Add a note** records what was done (who answered, what was said, why it is spam) with your
  name and the time; "Save and mark answered" files the message in the same click. Every move
  between folders is logged under the message too.
- **Settings**: home and about texts, code of conduct, social links, contact email, moderators, membership switches
  and the analytics token. Long texts ("Who we are", "Official French Tech Community", the
  mission) keep the line breaks you type: leave an empty line between paragraphs. They accept
  Markdown (`**bold**`, `[link](https://…)`, `- list`, `## heading`). "You can join us" cards
  appear on Home and About, one per line as `Title | text | link`, where the link is optional.
- **Code of conduct**: the text of the public `/code-of-conduct` page, in Markdown. It starts with
  a default text (our commitment, expected and unacceptable behaviour, consequences, how to
  report). Write `{contactEmail}` where the contact email should appear; it becomes a mail link.
  Emptying the field brings the default text back. The page is linked in the footer, on event
  pages and under the registration form ("By registering you agree to our code of conduct").

## For developers

- Every `/admin` page and `/api/admin` endpoint goes through `requireAdmin()` in
  `src/middleware.ts`, which verifies the Cloudflare Access JWT (`src/lib/auth.ts`). Locally,
  with `ACCESS_AUD` empty, `DEV_ADMIN_EMAIL` from `.dev.vars` is used, on localhost only.
- Pages are plain server-rendered forms that redirect with `?saved=1`. The only scripts are the
  Markdown editor (`src/components/admin/MarkdownEditor.astro`), the confirm prompt on destructive
  forms and the saved toast.
- `POST /api/admin/upload` (multipart `file`, `kind=image|file`) returns `{ key, url }`.
  `POST /api/admin/preview` (`{ md }`) returns `{ html }`.
