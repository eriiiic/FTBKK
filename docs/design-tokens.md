# Design tokens

Colours follow the French Tech usage charter ("Charte d'usage", section 7.3): the palette for the
communication of French Tech Capitals and Communities. The logo colours (Rouge Marianne `#E0000F`,
Bleu France `#000091`) belong to the French State's charter and are not used. The charter's navy is
also the deep indigo of the original Wix site (`#0D0040`). The values live in the `@theme` block of
`src/styles/global.css`; components only use the token names.

## Palette

| Token         | Hex       | Charter colour                          | Usage                                 |
| ------------- | --------- | --------------------------------------- | ------------------------------------- |
| `navy`        | `#160B47` | Bleu marine                             | Headings, navy bands, footer          |
| `navy-soft`   | `#2A1F63` |                                         | Hover on navy cards                   |
| `brand`       | `#D6223D` | Rouge azalée `#E62A45`, darkened for AA | Primary buttons, eyebrows, highlights |
| `brand-dark`  | `#B01A31` |                                         | Button hover, small text on surface   |
| `accent`      | `#0062FF` | Bleu électrique                         | Links, focus ring                     |
| `accent-soft` | `#B3CDFF` |                                         | Text and focus ring on navy           |
| `ink`         | `#1A1530` |                                         | Body text                             |
| `muted`       | `#5C5A73` |                                         | Secondary text                        |
| `line`        | `#E0DFE8` |                                         | Borders                               |
| `surface`     | `#F5F5F5` | Gris clair                              | Alternating section background        |
| `paper`       | `#FFFFFF` |                                         | Page background                       |

## Logo

The charter says the Community logo must be reproduced from the supplied files, unchanged: no
redrawn text, no new layout, never the rooster alone. `src/components/Logo.astro` shows the
official artwork (`public/brand/logo-lockup.png`, cropped from `public/brand/logo.jpg`). Only the
colour version (black text) is in the repo, so on navy it sits on a white tile; replace that with
the official white-text version once the Mission French Tech files are added. The favicon and app
icons are the full lockup on white, not the rooster alone. Emails write the name as plain text.

## Type

- Display (h1 to h3): Montserrat Variable, bold, tight tracking.
- Body: Inter Variable, 16px base, 1.6 line height.
- Scale (Tailwind): h1 `text-4xl md:text-5xl`, h2 `text-2xl md:text-3xl`, h3 `text-lg`.

## Shape

- Cards: `rounded-card` (1rem) with `shadow-card`.
- Buttons: pill (`rounded-button`).
- Page width: `container-page` (max 72rem, 16px gutters on phones).

## Contrast (WCAG AA)

| Text on background                  | Ratio           | Use                               |
| ----------------------------------- | --------------- | --------------------------------- |
| ink on paper                        | 17.6            | body text                         |
| muted on paper / surface            | 6.6 / 6.1       | secondary text                    |
| paper on brand                      | 5.1             | primary buttons                   |
| paper on navy                       | 17.9            | navy bands, footer, admin sidebar |
| accent-soft on navy                 | 11.2            | text and focus ring on navy       |
| accent on paper / surface           | 5.0 / 4.6       | links                             |
| brand on paper / surface            | 5.1 / 4.6       | eyebrows, labels                  |
| success / warning / danger on paper | 5.3 / 5.9 / 6.6 | status text                       |

Lighthouse (mobile, production build): 99–100 performance, 100 accessibility and SEO on Home,
Ecosystem, an event, an organisation, a post and About.
