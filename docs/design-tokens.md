# Design tokens

> **Placeholder.** The values below come from the project deck (navy and French Tech red) so the
> site can be built before the Wix styles are captured. After `npm run capture` writes
> `docs/design-tokens.captured.md`, replace this table and the `@theme` block in
> `src/styles/global.css` with the measured values. Components only use the token names, so
> nothing else changes.

## Palette

| Token          | Hex       | Usage                                            |
| -------------- | --------- | ------------------------------------------------ |
| `navy`         | `#0B1F3A` | Headings, header and footer background           |
| `navy-soft`    | `#1A2433` | Footer secondary background                      |
| `brand`        | `#E4002B` | Primary buttons, highlights (4.8:1 on white)     |
| `brand-dark`   | `#B80023` | Button hover                                     |
| `accent`       | `#2F5C9E` | Links, focus ring, secondary accents             |
| `accent-soft`  | `#A9C1E6` | Links on navy                                    |
| `ink`          | `#1A2433` | Body text                                        |
| `muted`        | `#5B6B80` | Secondary text (5.4:1 on white)                  |
| `line`         | `#D9E1EC` | Borders                                          |
| `surface`      | `#EEF2F7` | Alternating section background, card backgrounds |
| `paper`        | `#FFFFFF` | Page background                                  |

## Type

- Display (h1 to h3): Montserrat Variable, bold, tight tracking.
- Body: Inter Variable, 16px base, 1.6 line height.
- Scale (Tailwind): h1 `text-4xl md:text-5xl`, h2 `text-2xl md:text-3xl`, h3 `text-lg`.

## Shape

- Cards: `rounded-card` (1rem) with `shadow-card`.
- Buttons: pill (`rounded-button`).
- Page width: `container-page` (max 72rem, 16px gutters on phones).
