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
- Below the event form, **Speakers**, **Sponsors and hosts** and **Recap** each have their own
  save button and save only that section. If another section has unsaved changes, the page asks
  before saving, since those changes would be lost: save one section at a time.
- **Speakers** (below the event form, once the event is saved): pick someone already in People
  (speakers, board or institutional partners) and give an optional talk title, or fill in **Or
  someone new** (name, job title, company, LinkedIn, photo) to add them to People in the
  Speakers group and link them in one go. Reorder with the arrows, edit talk titles, tick
  "Remove" to unlink (the person stays in People), then **Save the speakers**. They show on the
  event page with their photo, title, company, talk title and LinkedIn. Speakers are reused
  across events: next time, just pick them from the list. Everyone who spoke at a past
  published event appears in **Speakers we've hosted** on About (the 24 most recent).
- **Sponsors and hosts** (below the event form, once the event is saved): choose the role
  (**Host (venue)**, **Sponsor** or **Partner**), then pick an organisation from the ecosystem
  directory (its current name, logo and website are used, and the event page links to its
  listing when it is published) or enter a name, website and logo (PNG, JPG, WebP or SVG, 2 MB
  max) for someone not in the directory. Reorder with the arrows, change a role, edit the name or
  website of hand-entered ones, tick "Remove", then **Save the sponsors**. The event page shows
  "Hosted by" next to the venue and a logo wall ("Hosted by", "Sponsored by", "Partners"); the
  confirmation, waitlist promotion and reminder emails list them under the date and venue, with
  their logos (PNG and JPG only: most email clients don't show SVG). To change the logo of a
  hand-entered one, remove it and add it again; to change a directory organisation's logo, edit it
  in Ecosystem. Something to show sponsors: their logo on the page and in every attendee's inbox.
- **Recap** (at the bottom of an event's page, about 10 minutes after the event): add photos
  (select several at once, up to 20 per save, 5 MB each and 40 MB in all with the slides: save
  big batches in several goes), reorder them with the arrows, give them an optional caption
  (shown under the full-size photo and read to people using screen readers), or tick "Remove"
  (the file is deleted). Upload the speakers'
  slides as PDFs (the file name becomes the label, which you can edit) or paste a link to them,
  paste the video link (YouTube or Vimeo play on the page, other sites open in a new page), and
  pick the blog write-up among published posts. Click **Save the recap**. If the recap can't be
  saved (a bad link, for example), the files you picked are not kept: choose them again after
  fixing the error. It shows on the event
  page once the event has passed, and the event gets a "Recap" badge in the past events list.
  Uploaded slides also appear in **Files**, used by the event.

## Registrations

- People register on the event page (name, email, company, role, photo notice, and an optional
  newsletter box, unticked by default). They get a
  confirmation with a calendar invite and a cancel link, and a reminder the day before.
- The form also asks, optionally, **"Anything we should know, or something you're looking for?"**
  (up to 500 characters: dietary needs, accessibility, "looking for a CTO"...). Only the team sees
  the answer: under the person's name in **Registrations** (the search finds words in it too), in
  the **Note** column of the CSV, in small grey text on the check-in screen so door volunteers can
  spot it, and next to each event in the contact's event history. It is never repeated in emails.
- When the event is full, new people join the **waitlist**. If someone cancels, the first person
  on the waitlist is registered automatically and emailed.
- **Registrations** (or the count on the Events page): counts, search, check in, register someone
  from the waitlist (this can go over capacity), cancel, and **Export CSV** for Excel.
- **Check-in mode** is made for a phone at the door: type a few letters of the name and tap to
  check the person in. Tap again to undo. Door volunteers can bookmark
  `/checkin` on their phone: it opens a list of today's and upcoming events (after the admin
  login), and tapping one opens its check-in mode. They must be allowed in Cloudflare Access.
- **First time and Regular badges** on the check-in screen help volunteers greet people. "First
  time" (blue) means this email was never checked in at an earlier published event, and the
  banner above the list says how many newcomers are expected ("Say hello to the 3 newcomers").
  "Regular · N events" means they were checked in at 3 or more earlier events. Walk-ins added at
  the door get their badge too. People without an email get no badge (we can't tell), and the
  count only knows about events where check-in was used.
- **Walk-ins**: on the check-in screen, **+ Walk-in** (or **Add as a walk-in** when a search
  finds nobody) adds someone who didn't register and checks them in. Only the name is required.
  If the email is already registered for the event, that registration is checked in instead.
  Walk-ins are marked in Registrations and in the CSV export. Tick **They want the newsletter**
  only if the person said yes (it needs their email). This also works for someone already
  checked in: the screen says "already checked in" and records the yes.
- **Contacts** lists everyone who ever registered or walked in, one line per person (by email;
  walk-ins without an email are grouped by name). It shows how many events each person attended,
  registered for and missed (registered for a past event where check-in was used, but not
  checked in), and the ecosystem listings their email manages or is the contact for. Filter by
  "came at least once", "came 2 times or more", "registered, never came", "linked to an
  ecosystem listing", "suggest for membership", by tag or by event, then **Export CSV** (the export keeps the filters and has
  a Tags column). Click a
  name to see their full event history. Details come from their latest registration.
- **Suggest for membership** (in the Show filter) is for the board: people who came to 3 or more
  events, have no ecosystem listing (their email doesn't manage and isn't the contact of any
  listing) and whose company isn't a member organisation (matched by name, ignoring "Co., Ltd."
  and the like). Copy their emails or export them to invite them to join.
- On a contact's page: **Email**, **WhatsApp** (Thai numbers starting with 0 get +66) and
  **Call** buttons, and **Edit** for name, email, phone, company, role, tags, LinkedIn and team
  notes.
  Once edited, the saved details win over what the person types in later registrations. Changing
  the email moves their registrations to the new one; if that email already registered, the two
  merge. Adding an email to a walk-in groups their future registrations with it. **New contact**
  adds someone who never registered. **Delete this contact** removes them and all their
  registrations (their seats on upcoming events go to the waitlist). People can do the same
  themselves: see **Manage or delete my data** below. **Copy emails** on the list
  copies the filtered addresses for the Bcc field of an email.
- **Tags**: Speaker, Sponsor, Volunteer, Board and Press. You set them by hand (nothing is tagged
  automatically) and only the admin team sees them. They show as small badges next to the name,
  and the **Any tag** menu on the list shows only the people with one tag (it combines with the
  other filters and the search). Tagging someone saves a contact card for them, as editing does.
  A walk-in without an email can't be tagged until you add an email on their page.
- **Bulk actions on Contacts**: tick the boxes in front of the names (or the box in the header to
  tick every row shown). A bar appears with **Copy emails**, **Export CSV** (only the ticked
  rows), **Add tag** / **Remove tag** (choose the tag in the menu first; walk-ins without an email
  are skipped, and the message says how many) and **Delete** (asks first; removes those contacts and their registrations, and freed
  seats on upcoming events go to the waitlist).
- **Newsletter consent**: the law (Thailand's PDPA) wants a clear yes, given by the person, with
  a date. The registration form asks with an unticked box; a tick is kept with its date (leaving
  the box unticked records nothing, so it never cancels an earlier yes). The
  contacts list has a **Newsletter** column ("Agreed") and an "Agreed to the newsletter" filter;
  the contact page shows their current choice, where it came from and when. If someone tells you
  in person or by message, open their contact, **Edit**, set **Newsletter** to "Subscribed" or
  "Not subscribed" and the date they told you (empty = today). The line under the menu shows the
  answer that counts now. Their latest choice always wins: a later tick on a registration form
  replaces what you set, and the other way round. The menu only shows your entry while it is the
  one that counts; a date older than their latest tick is refused, since it would change nothing.
  "As they chose when registering" removes your entry. People imported from Wix were never asked, so they count as
  not subscribed. To send a newsletter, filter on "Agreed to the newsletter" and **Export CSV**
  (columns "Newsletter" and "Newsletter consent date") into your newsletter tool. Only use **Copy
  emails** for event messages, not for the newsletter.
- **Manage or delete my data** (PDPA): every email to registrants (confirmation, waitlist
  promotion, reminder, feedback request, event cancelled and **Email registrants**) has this link
  in its footer. It opens `/my-data` for that registration, which shows the person their name,
  email, phone, company, events (registered, came, cancelled) with their own answers ("Anything
  we should know?", how they heard about us) and feedback, newsletter choice, tags, and whether
  you saved a contact card (your notes are not shown; the page tells them to ask for a copy). They can **Unsubscribe from the newsletter** (recorded on their contact
  card as "Not subscribed" with today's date) or **Delete my data** (asks to confirm, then does
  exactly what **Delete this contact** does: their card, registrations and feedback go, and freed
  seats go to the waitlist). An unsubscribe shows in Ecosystem > History with the actor
  `self-service:<their email>`. Deleting a contact (here or with **Delete this contact**) also
  wipes the old values of their contact entries in the history and logs the deletion under
  `deleted:<short code>` instead of their email. After a deletion the link stops working. If someone asks by email
  instead, use **Delete this contact** or edit their newsletter choice yourself.
- **Delete my data without an email to hand**: the site footer and the privacy page link to
  `/my-data`, where anyone can enter their email. If the site holds data for that address, it
  emails a link valid for 24 hours that opens the same page; otherwise nothing is sent. The page
  gives the same answer either way, so nobody can find out who is in the list. Nothing is deleted
  until the person confirms on the page.
- **Guests registered on Wix** are imported from the Wix guest list export with
  `npm run import:guests -- <Guest_list_….csv> --remote` (see the README). The event must already
  exist on the new site with the same slug as in the file name, or pass `--event <slug>`. Guests
  get no email; they show up in Registrations and Contacts like everyone else, with the date they
  registered on Wix.
- Cancelling an event emails everyone registered or on the waitlist.
- **Email registrants** (on an event's page, or the button in Registrations) sends your own
  message to the people of one event: a venue change, the slides after the talk, a last-minute
  reminder. Choose who gets it (**Registered**, **Checked in**, **Waitlist** or **Everyone not
  cancelled**; each shows how many people that is), write a subject and a plain-text message
  (leave a blank line between paragraphs; single line breaks, for an address or a list, are kept;
  `{name}` becomes the person's first name), and
  optionally a button with its link (for example "Download the slides"). The email uses the
  site's usual layout and adds the event's date, venue and a link to its page. **Send me a test**
  sends it to you only. **Send** asks for confirmation with the number of people and the event's
  name. After the event, **Checked in** is preselected when check-in was used, otherwise
  **Registered**. Replies go to
  the contact address in Settings. Walk-ins without an email are skipped, and the same email
  can't go to the same people twice within 10 minutes unless you tick "Send it again". Everything
  sent is listed on that page, with who sent it and to how many people. If sending stops part way
  (the email service failing), the page lists the addresses not reached: don't send again to the
  whole audience, or the first people get it twice.
- **Feedback**: at 09:00 the day after a published event (not cancelled ones), everyone who
  was checked in gets an email asking "How was it?" with five one-click buttons (1 = poor to
  5 = excellent). If nobody who registered was checked in (walk-ins don't count), everyone
  still registered gets it, and walk-ins with an email too. If the email service fails that
  morning, it tries again the next morning.
  Each person gets it once; walk-ins without an email are skipped. The click records the rating
  and opens a page where they can add a comment (up to 2,000 characters) or change the rating,
  any time later, with the same link.
- **Event stats** shows, for each past event that got the feedback email, the number of feedback
  responses and the average rating (events from before feedback emails show "–"); click the
  number to open the event's **Feedback** page (also linked at the top of a
  past event's page). It shows the average, the share of emailed people who answered, how many
  gave each rating, and every rating and comment with the person's name. Names are for the team
  only: **Hide names (to share)** shows the comments without names, ready to show speakers,
  sponsors or the board, and **Export feedback CSV** downloads them (without names and emails
  when names are hidden).
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
  company. Use ↑ ↓ to reorder. The **Speakers** group holds people who only spoke at events
  (added here or from an event's Speakers section); edit their photo, title or company here and
  every event page updates. Each person shows how many events they spoke at; removing a person
  also removes them from those events.
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
- **Privacy notice**: the text of the public `/privacy` page (Thailand's PDPA), in Markdown, edited
  the same way. The default says who we are, what we collect, why, who sees it, how long we keep
  it, people's rights and how to use them. Keep it true to what the team actually does (for
  example if you start sharing attendee lists with a sponsor, it must say so and ask first).
  `{contactEmail}` becomes a mail link; emptying the field brings the default back. It is linked
  in the footer and under every registration form.

## For developers

- Every `/admin` page and `/api/admin` endpoint goes through `requireAdmin()` in
  `src/middleware.ts`, which verifies the Cloudflare Access JWT (`src/lib/auth.ts`). Locally,
  with `ACCESS_AUD` empty, `DEV_ADMIN_EMAIL` from `.dev.vars` is used, on localhost only.
- Pages are plain server-rendered forms that redirect with `?saved=1`. The only scripts are the
  Markdown editor (`src/components/admin/MarkdownEditor.astro`), the confirm prompt on destructive
  forms and the saved toast.
- `POST /api/admin/upload` (multipart `file`, `kind=image|file`) returns `{ key, url }`.
  `POST /api/admin/preview` (`{ md }`) returns `{ html }`.
