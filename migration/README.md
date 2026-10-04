# Migration from Wix

`npm run capture` (script: `migration/capture.ts`) crawls the live Wix site with Playwright and
writes the extracted content to `migration/data/`. Only `migration/data/`, this README and the
script are committed; raw HTML, screenshots and images stay local (gitignored) and are uploaded to
R2 by `scripts/import.ts`.

## Running the capture

The cloud environment that built this repo can't reach french-tech-bangkok.com, so run it once
from a machine that can:

```sh
npm install
npx playwright install chromium
npm run capture               # ~75 pages, a few minutes
git add migration/data docs/design-tokens.captured.md && git commit -m "data: capture Wix site"
```

Options: `--only=events|posts|sponsors|pages|team`, `--no-screens`. `CHROMIUM_PATH` points at an
existing Chromium; `CAPTURE_SITE` overrides the base URL (used for testing against a fixture).

What the capture now gets right (fixed 2026-10-04 after the first run):

- Event descriptions: "Show More" buttons are clicked first, so the full text is captured.
- Blog categories: read from each category page, not from the post page (which lists the whole
  menu).
- Post attachments: Wix file widgets have no link, so each "Download" is clicked and the file is
  saved to `migration/files/` under the name shown on Wix.
- Sponsors: every link on the page is kept in `links`, to check by hand when `website` and
  `linkedin` come back empty.

To refresh only these: `npm run capture -- --only=events --no-screens`, then `--only=posts`, then
`npm run import -- --remote`.

## Seed data (until the capture runs)

`migration/data/seed/` holds what could be read from the home page text on 2026-10-03: board
members and institutional representatives (names and companies, no titles or photos yet), the next
two French Tech Connect events, the home and footer copy, and the 3 institutions plus the board
members' companies. The About copy and the organisations' directory categories are drafts to
review. `scripts/import.ts` uses a captured file when it exists and falls back to the seed.

## Expected counts after the capture

33 events (one "test-title" marked junk), 11 posts, 31 sponsors, 10 board members, 3 institutional
representatives.
