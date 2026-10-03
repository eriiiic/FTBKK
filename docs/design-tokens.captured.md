# Design tokens

Extracted from the live Wix site by `npm run capture` on 2026-10-03.
Raw values are in `migration/data/tokens.json`. The Tailwind theme in `src/styles/global.css` maps these.

## /

### Most used colors

| Color | Hex | Uses |
| --- | --- | --- |
| rgb(0, 0, 0) | #000000 | 997 |
| rgb(40, 26, 57) | #281A39 | 292 |
| rgb(0, 0, 238) | #0000EE | 114 |
| rgb(255, 255, 255) | #FFFFFF | 67 |
| rgb(231, 231, 231) | #E7E7E7 | 26 |
| rgb(151, 151, 151) | #979797 | 24 |
| rgb(51, 51, 51) | #333333 | 24 |
| rgb(13, 0, 64) | #0D0040 | 22 |
| rgb(176, 169, 134) | #B0A986 | 13 |
| rgb(216, 216, 216) | #D8D8D8 | 6 |
| rgba(231, 231, 231, 0) | transparent | 5 |
| rgba(255, 255, 255, 0) | transparent | 5 |
| rgba(51, 51, 51, 0.5) | #333333 | 4 |
| rgb(17, 109, 255) | #116DFF | 2 |
| rgb(71, 67, 197) | #4743C5 | 2 |
| rgba(51, 51, 51, 0.8) | #333333 | 2 |
| rgba(40, 26, 57, 0) | transparent | 1 |
| rgba(51, 51, 51, 0.14) | #333333 | 1 |

### Elements

| Element | Font | Size / weight / line-height | Color | Background | Radius |
| --- | --- | --- | --- | --- | --- |
| `body` | Arial | 10px / 400 / normal | #000000 | transparent | 0px |
| `h1` | avenir-lt-w01_85-heavy1475544 | 66px / 700 / normal | #0D0040 | transparent | 0px |
| `h2` | avenir-lt-w01_85-heavy1475544 | 56px / 700 / 56px | #0D0040 | transparent | 0px |
| `p` | avenir-lt-w01_85-heavy1475544 | 25px / 400 / 32.5px | #281A39 | transparent | 0px |
| `nav a, [data-testid="linkElement"]` | Arial | 10px / 400 / normal | #0000EE | transparent | 0px |
| `button, [data-testid="buttonElement"]` | Helvetica | 14px / 400 / normal | #116DFF | #FFFFFF | 24px |
| `header, #SITE_HEADER` | Arial | 10px / 400 / normal | #000000 | transparent | 0px |
| `footer, #SITE_FOOTER` | Arial | 10px / 400 / normal | #000000 | transparent | 0px |

### Fonts loaded

- wf_0b2cb22f137b4bd2a093def6a normal normal
- avenir-lt-w01_85-heavy1475544 400 normal
- din-next-w01-light 400 normal
- avenir-lt-w01_35-light1475496 400 normal
- poppins-v2 900 normal
- poppins-v2 900 italic
- poppins-v2 700 normal
- poppins-v2 700 italic
- poppins-v2 200 normal
- poppins-v2 200 italic
- poppins-v2 800 normal
- poppins-v2 800 italic
- poppins-v2 500 normal
- poppins-v2 500 italic
- poppins-v2 300 normal
- poppins-v2 300 italic
- poppins-v2 100 normal
- poppins-v2 100 italic
- poppins-v2 400 normal
- poppins-v2 400 italic
- Lexend 100 900 normal

### Wix CSS variables

- `--wst-button-color-fill-primary`: rgb(var(--color_48))
- `--wst-button-color-border-primary`: rgb(var(--color_49))
- `--wst-button-color-text-primary`: rgb(var(--color_50))
- `--wst-button-color-fill-primary-hover`: rgb(var(--color_51))
- `--wst-button-color-border-primary-hover`: rgb(var(--color_52))
- `--wst-button-color-text-primary-hover`: rgb(var(--color_53))
- `--wst-button-color-fill-primary-disabled`: rgb(var(--color_54))
- `--wst-button-color-border-primary-disabled`: rgb(var(--color_55))
- `--wst-button-color-text-primary-disabled`: rgb(var(--color_56))
- `--wst-button-color-fill-secondary`: rgb(var(--color_57))
- `--wst-button-color-border-secondary`: rgb(var(--color_58))
- `--wst-button-color-text-secondary`: rgb(var(--color_59))
- `--wst-button-color-fill-secondary-hover`: rgb(var(--color_60))
- `--wst-button-color-border-secondary-hover`: rgb(var(--color_61))
- `--wst-button-color-text-secondary-hover`: rgb(var(--color_62))
- `--wst-button-color-fill-secondary-disabled`: rgb(var(--color_63))
- `--wst-button-color-border-secondary-disabled`: rgb(var(--color_64))
- `--wst-button-color-text-secondary-disabled`: rgb(var(--color_65))
- `--wst-color-fill-base-1`: rgb(var(--color_36))
- `--wst-color-fill-base-2`: rgb(var(--color_37))
- `--wst-color-fill-base-shade-1`: rgb(var(--color_38))
- `--wst-color-fill-base-shade-2`: rgb(var(--color_39))
- `--wst-color-fill-base-shade-3`: rgb(var(--color_40))
- `--wst-color-fill-accent-1`: rgb(var(--color_41))
- `--wst-color-fill-accent-2`: rgb(var(--color_42))
- `--wst-color-fill-accent-3`: rgb(var(--color_43))
- `--wst-color-fill-accent-4`: rgb(var(--color_44))
- `--wst-color-fill-background-primary`: rgb(var(--color_11))
- `--wst-color-fill-background-secondary`: rgb(var(--color_12))
- `--wst-color-text-primary`: rgb(var(--color_15))
- `--wst-color-text-secondary`: rgb(var(--color_14))
- `--wst-color-action`: rgb(var(--color_18))
- `--wst-color-disabled`: rgb(var(--color_39))
- `--wst-color-title`: rgb(var(--color_45))
- `--wst-color-subtitle`: rgb(var(--color_46))
- `--wst-color-line`: rgb(var(--color_47))
- `--wst-font-style-h2`: var(--font_2)
- `--wst-font-style-h3`: var(--font_3)
- `--wst-font-style-h4`: var(--font_4)
- `--wst-font-style-h5`: var(--font_5)
- `--wst-font-style-h6`: var(--font_6)
- `--wst-font-style-body-large`: var(--font_7)
- `--wst-font-style-body-medium`: var(--font_8)
- `--wst-font-style-body-small`: var(--font_9)
- `--wst-font-style-body-x-small`: var(--font_10)
- `--wst-color-custom-1`: rgb(var(--color_13))
- `--wst-color-custom-2`: rgb(var(--color_16))
- `--wst-color-custom-3`: rgb(var(--color_17))
- `--wst-color-custom-4`: rgb(var(--color_19))
- `--wst-color-custom-5`: rgb(var(--color_20))
- `--wst-color-custom-6`: rgb(var(--color_21))
- `--wst-color-custom-7`: rgb(var(--color_22))
- `--wst-color-custom-8`: rgb(var(--color_23))
- `--wst-color-custom-9`: rgb(var(--color_24))
- `--wst-color-custom-10`: rgb(var(--color_25))
- `--wst-color-custom-11`: rgb(var(--color_26))
- `--wst-color-custom-12`: rgb(var(--color_27))
- `--wst-color-custom-13`: rgb(var(--color_28))
- `--wst-color-custom-14`: rgb(var(--color_29))
- `--wst-color-custom-15`: rgb(var(--color_30))

## /about

### Most used colors

| Color | Hex | Uses |
| --- | --- | --- |
| rgb(0, 0, 0) | #000000 | 814 |
| rgb(40, 26, 57) | #281A39 | 190 |
| rgb(0, 0, 238) | #0000EE | 114 |
| rgb(255, 255, 255) | #FFFFFF | 34 |
| rgb(13, 0, 64) | #0D0040 | 31 |
| rgb(51, 51, 51) | #333333 | 24 |
| rgb(176, 169, 134) | #B0A986 | 16 |
| rgb(231, 231, 231) | #E7E7E7 | 10 |
| rgba(255, 255, 255, 0) | transparent | 5 |
| rgba(51, 51, 51, 0.5) | #333333 | 4 |
| rgb(17, 109, 255) | #116DFF | 2 |
| rgb(71, 67, 197) | #4743C5 | 2 |
| rgba(51, 51, 51, 0.8) | #333333 | 2 |
| rgba(231, 231, 231, 0) | transparent | 1 |
| rgb(235, 37, 69) | #EB2545 | 1 |
| rgba(40, 26, 57, 0) | transparent | 1 |
| rgba(51, 51, 51, 0.14) | #333333 | 1 |

### Elements

| Element | Font | Size / weight / line-height | Color | Background | Radius |
| --- | --- | --- | --- | --- | --- |
| `body` | Arial | 10px / 400 / normal | #000000 | transparent | 0px |
| `h1` | avenir-lt-w01_85-heavy1475544 | 56px / 700 / normal | #0D0040 | transparent | 0px |
| `h2` | avenir-lt-w01_85-heavy1475544 | 38px / 700 / normal | #0D0040 | transparent | 0px |
| `p` | avenir-lt-w01_85-heavy1475544 | 20px / 400 / normal | #281A39 | transparent | 0px |
| `nav a, [data-testid="linkElement"]` | Arial | 10px / 400 / normal | #0000EE | transparent | 0px |
| `button, [data-testid="buttonElement"]` | Helvetica | 14px / 400 / normal | #116DFF | #FFFFFF | 24px |
| `header, #SITE_HEADER` | Arial | 10px / 400 / normal | #000000 | transparent | 0px |
| `footer, #SITE_FOOTER` | Arial | 10px / 400 / normal | #000000 | transparent | 0px |

### Fonts loaded

- wf_0b2cb22f137b4bd2a093def6a normal normal
- avenir-lt-w01_85-heavy1475544 400 normal
- din-next-w01-light 400 normal
- futura-lt-w01-book 400 normal
- Lexend 100 900 normal

### Wix CSS variables

- `--wst-button-color-fill-primary`: rgb(var(--color_48))
- `--wst-button-color-border-primary`: rgb(var(--color_49))
- `--wst-button-color-text-primary`: rgb(var(--color_50))
- `--wst-button-color-fill-primary-hover`: rgb(var(--color_51))
- `--wst-button-color-border-primary-hover`: rgb(var(--color_52))
- `--wst-button-color-text-primary-hover`: rgb(var(--color_53))
- `--wst-button-color-fill-primary-disabled`: rgb(var(--color_54))
- `--wst-button-color-border-primary-disabled`: rgb(var(--color_55))
- `--wst-button-color-text-primary-disabled`: rgb(var(--color_56))
- `--wst-button-color-fill-secondary`: rgb(var(--color_57))
- `--wst-button-color-border-secondary`: rgb(var(--color_58))
- `--wst-button-color-text-secondary`: rgb(var(--color_59))
- `--wst-button-color-fill-secondary-hover`: rgb(var(--color_60))
- `--wst-button-color-border-secondary-hover`: rgb(var(--color_61))
- `--wst-button-color-text-secondary-hover`: rgb(var(--color_62))
- `--wst-button-color-fill-secondary-disabled`: rgb(var(--color_63))
- `--wst-button-color-border-secondary-disabled`: rgb(var(--color_64))
- `--wst-button-color-text-secondary-disabled`: rgb(var(--color_65))
- `--wst-color-fill-base-1`: rgb(var(--color_36))
- `--wst-color-fill-base-2`: rgb(var(--color_37))
- `--wst-color-fill-base-shade-1`: rgb(var(--color_38))
- `--wst-color-fill-base-shade-2`: rgb(var(--color_39))
- `--wst-color-fill-base-shade-3`: rgb(var(--color_40))
- `--wst-color-fill-accent-1`: rgb(var(--color_41))
- `--wst-color-fill-accent-2`: rgb(var(--color_42))
- `--wst-color-fill-accent-3`: rgb(var(--color_43))
- `--wst-color-fill-accent-4`: rgb(var(--color_44))
- `--wst-color-fill-background-primary`: rgb(var(--color_11))
- `--wst-color-fill-background-secondary`: rgb(var(--color_12))
- `--wst-color-text-primary`: rgb(var(--color_15))
- `--wst-color-text-secondary`: rgb(var(--color_14))
- `--wst-color-action`: rgb(var(--color_18))
- `--wst-color-disabled`: rgb(var(--color_39))
- `--wst-color-title`: rgb(var(--color_45))
- `--wst-color-subtitle`: rgb(var(--color_46))
- `--wst-color-line`: rgb(var(--color_47))
- `--wst-font-style-h2`: var(--font_2)
- `--wst-font-style-h3`: var(--font_3)
- `--wst-font-style-h4`: var(--font_4)
- `--wst-font-style-h5`: var(--font_5)
- `--wst-font-style-h6`: var(--font_6)
- `--wst-font-style-body-large`: var(--font_7)
- `--wst-font-style-body-medium`: var(--font_8)
- `--wst-font-style-body-small`: var(--font_9)
- `--wst-font-style-body-x-small`: var(--font_10)
- `--wst-color-custom-1`: rgb(var(--color_13))
- `--wst-color-custom-2`: rgb(var(--color_16))
- `--wst-color-custom-3`: rgb(var(--color_17))
- `--wst-color-custom-4`: rgb(var(--color_19))
- `--wst-color-custom-5`: rgb(var(--color_20))
- `--wst-color-custom-6`: rgb(var(--color_21))
- `--wst-color-custom-7`: rgb(var(--color_22))
- `--wst-color-custom-8`: rgb(var(--color_23))
- `--wst-color-custom-9`: rgb(var(--color_24))
- `--wst-color-custom-10`: rgb(var(--color_25))
- `--wst-color-custom-11`: rgb(var(--color_26))
- `--wst-color-custom-12`: rgb(var(--color_27))
- `--wst-color-custom-13`: rgb(var(--color_28))
- `--wst-color-custom-14`: rgb(var(--color_29))
- `--wst-color-custom-15`: rgb(var(--color_30))

## /events

### Most used colors

| Color | Hex | Uses |
| --- | --- | --- |
| rgb(0, 0, 0) | #000000 | 1535 |
| rgb(40, 26, 57) | #281A39 | 1131 |
| rgb(151, 151, 151) | #979797 | 216 |
| rgb(231, 231, 231) | #E7E7E7 | 105 |
| rgb(255, 255, 255) | #FFFFFF | 58 |
| rgb(216, 216, 216) | #D8D8D8 | 54 |
| rgb(136, 129, 144) | #888190 | 42 |
| rgb(0, 0, 238) | #0000EE | 36 |
| rgb(51, 51, 51) | #333333 | 24 |
| rgba(231, 231, 231, 0) | transparent | 23 |
| rgb(13, 0, 64) | #0D0040 | 14 |
| rgba(40, 26, 57, 0.04) | #281A39 | 12 |
| rgba(255, 255, 255, 0) | transparent | 5 |
| rgb(88, 77, 101) | #584D65 | 4 |
| rgba(51, 51, 51, 0.5) | #333333 | 4 |
| rgba(40, 26, 57, 0) | transparent | 3 |
| rgb(17, 109, 255) | #116DFF | 2 |
| rgb(71, 67, 197) | #4743C5 | 2 |
| rgba(51, 51, 51, 0.8) | #333333 | 2 |
| rgb(235, 37, 69) | #EB2545 | 1 |
| rgba(51, 51, 51, 0.14) | #333333 | 1 |

### Elements

| Element | Font | Size / weight / line-height | Color | Background | Radius |
| --- | --- | --- | --- | --- | --- |
| `body` | Arial | 10px / 400 / normal | #000000 | transparent | 0px |
| `h2` | avenir-lt-w01_85-heavy1475544 | 56px / 700 / 56px | #0D0040 | transparent | 0px |
| `p` | avenir-lt-w01_85-heavy1475544 | 16px / 400 / 28.8px | #000000 | transparent | 0px |
| `nav a, [data-testid="linkElement"]` | Arial | 10px / 400 / normal | #0000EE | transparent | 0px |
| `button, [data-testid="buttonElement"]` | Helvetica | 14px / 400 / normal | #116DFF | #FFFFFF | 24px |
| `header, #SITE_HEADER` | Arial | 10px / 400 / normal | #000000 | transparent | 0px |
| `footer, #SITE_FOOTER` | Arial | 10px / 400 / normal | #000000 | transparent | 0px |

### Fonts loaded

- wf_0b2cb22f137b4bd2a093def6a normal normal
- avenir-lt-w01_85-heavy1475544 400 normal
- din-next-w01-light 400 normal
- avenir-lt-w01_35-light1475496 400 normal
- Lexend 100 900 normal

### Wix CSS variables

- `--wst-button-color-fill-primary`: rgb(var(--color_48))
- `--wst-button-color-border-primary`: rgb(var(--color_49))
- `--wst-button-color-text-primary`: rgb(var(--color_50))
- `--wst-button-color-fill-primary-hover`: rgb(var(--color_51))
- `--wst-button-color-border-primary-hover`: rgb(var(--color_52))
- `--wst-button-color-text-primary-hover`: rgb(var(--color_53))
- `--wst-button-color-fill-primary-disabled`: rgb(var(--color_54))
- `--wst-button-color-border-primary-disabled`: rgb(var(--color_55))
- `--wst-button-color-text-primary-disabled`: rgb(var(--color_56))
- `--wst-button-color-fill-secondary`: rgb(var(--color_57))
- `--wst-button-color-border-secondary`: rgb(var(--color_58))
- `--wst-button-color-text-secondary`: rgb(var(--color_59))
- `--wst-button-color-fill-secondary-hover`: rgb(var(--color_60))
- `--wst-button-color-border-secondary-hover`: rgb(var(--color_61))
- `--wst-button-color-text-secondary-hover`: rgb(var(--color_62))
- `--wst-button-color-fill-secondary-disabled`: rgb(var(--color_63))
- `--wst-button-color-border-secondary-disabled`: rgb(var(--color_64))
- `--wst-button-color-text-secondary-disabled`: rgb(var(--color_65))
- `--wst-color-fill-base-1`: rgb(var(--color_36))
- `--wst-color-fill-base-2`: rgb(var(--color_37))
- `--wst-color-fill-base-shade-1`: rgb(var(--color_38))
- `--wst-color-fill-base-shade-2`: rgb(var(--color_39))
- `--wst-color-fill-base-shade-3`: rgb(var(--color_40))
- `--wst-color-fill-accent-1`: rgb(var(--color_41))
- `--wst-color-fill-accent-2`: rgb(var(--color_42))
- `--wst-color-fill-accent-3`: rgb(var(--color_43))
- `--wst-color-fill-accent-4`: rgb(var(--color_44))
- `--wst-color-fill-background-primary`: rgb(var(--color_11))
- `--wst-color-fill-background-secondary`: rgb(var(--color_12))
- `--wst-color-text-primary`: rgb(var(--color_15))
- `--wst-color-text-secondary`: rgb(var(--color_14))
- `--wst-color-action`: rgb(var(--color_18))
- `--wst-color-disabled`: rgb(var(--color_39))
- `--wst-color-title`: rgb(var(--color_45))
- `--wst-color-subtitle`: rgb(var(--color_46))
- `--wst-color-line`: rgb(var(--color_47))
- `--wst-font-style-h2`: var(--font_2)
- `--wst-font-style-h3`: var(--font_3)
- `--wst-font-style-h4`: var(--font_4)
- `--wst-font-style-h5`: var(--font_5)
- `--wst-font-style-h6`: var(--font_6)
- `--wst-font-style-body-large`: var(--font_7)
- `--wst-font-style-body-medium`: var(--font_8)
- `--wst-font-style-body-small`: var(--font_9)
- `--wst-font-style-body-x-small`: var(--font_10)
- `--wst-color-custom-1`: rgb(var(--color_13))
- `--wst-color-custom-2`: rgb(var(--color_16))
- `--wst-color-custom-3`: rgb(var(--color_17))
- `--wst-color-custom-4`: rgb(var(--color_19))
- `--wst-color-custom-5`: rgb(var(--color_20))
- `--wst-color-custom-6`: rgb(var(--color_21))
- `--wst-color-custom-7`: rgb(var(--color_22))
- `--wst-color-custom-8`: rgb(var(--color_23))
- `--wst-color-custom-9`: rgb(var(--color_24))
- `--wst-color-custom-10`: rgb(var(--color_25))
- `--wst-color-custom-11`: rgb(var(--color_26))
- `--wst-color-custom-12`: rgb(var(--color_27))
- `--wst-color-custom-13`: rgb(var(--color_28))
- `--wst-color-custom-14`: rgb(var(--color_29))
- `--wst-color-custom-15`: rgb(var(--color_30))

## /blog

### Most used colors

| Color | Hex | Uses |
| --- | --- | --- |
| rgb(40, 26, 57) | #281A39 | 1455 |
| rgb(0, 0, 0) | #000000 | 891 |
| rgb(0, 0, 238) | #0000EE | 108 |
| rgba(235, 37, 69, 0.75) | #EB2545 | 24 |
| rgb(51, 51, 51) | #333333 | 24 |
| rgb(231, 231, 231) | #E7E7E7 | 21 |
| rgb(13, 0, 64) | #0D0040 | 10 |
| rgba(255, 255, 255, 0) | transparent | 5 |
| rgb(255, 255, 255) | #FFFFFF | 4 |
| rgba(51, 51, 51, 0.5) | #333333 | 4 |
| rgba(231, 231, 231, 0) | transparent | 3 |
| rgb(17, 109, 255) | #116DFF | 2 |
| rgb(232, 230, 230) | #E8E6E6 | 2 |
| rgb(71, 67, 197) | #4743C5 | 2 |
| rgba(51, 51, 51, 0.8) | #333333 | 2 |
| rgb(136, 129, 144) | #888190 | 1 |
| rgba(177, 211, 187, 0) | transparent | 1 |
| rgb(50, 65, 88) | #324158 | 1 |
| rgba(40, 26, 57, 0) | transparent | 1 |
| rgba(51, 51, 51, 0.14) | #333333 | 1 |

### Elements

| Element | Font | Size / weight / line-height | Color | Background | Radius |
| --- | --- | --- | --- | --- | --- |
| `body` | Arial | 10px / 400 / normal | #000000 | transparent | 0px |
| `h1` | avenir-lt-w01_85-heavy1475544 | 36px / 700 / 36px | #0D0040 | transparent | 0px |
| `h2` | avenir-lt-w01_85-heavy1475544 | 28px / 700 / normal | #281A39 | transparent | 0px |
| `p` | avenir-lt-w01_85-heavy1475544 | 16px / 400 / 28.8px | #000000 | transparent | 0px |
| `nav a, [data-testid="linkElement"]` | Arial | 10px / 400 / normal | #0000EE | transparent | 0px |
| `button, [data-testid="buttonElement"]` | Helvetica | 14px / 400 / normal | #116DFF | #FFFFFF | 24px |
| `header, #SITE_HEADER` | Arial | 10px / 400 / normal | #000000 | transparent | 0px |
| `footer, #SITE_FOOTER` | Arial | 10px / 400 / normal | #000000 | transparent | 0px |

### Fonts loaded

- wf_0b2cb22f137b4bd2a093def6a normal normal
- avenir-lt-w01_85-heavy1475544 400 normal
- din-next-w01-light 400 normal
- Lexend 100 900 normal

### Wix CSS variables

- `--wst-button-color-fill-primary`: rgb(var(--color_48))
- `--wst-button-color-border-primary`: rgb(var(--color_49))
- `--wst-button-color-text-primary`: rgb(var(--color_50))
- `--wst-button-color-fill-primary-hover`: rgb(var(--color_51))
- `--wst-button-color-border-primary-hover`: rgb(var(--color_52))
- `--wst-button-color-text-primary-hover`: rgb(var(--color_53))
- `--wst-button-color-fill-primary-disabled`: rgb(var(--color_54))
- `--wst-button-color-border-primary-disabled`: rgb(var(--color_55))
- `--wst-button-color-text-primary-disabled`: rgb(var(--color_56))
- `--wst-button-color-fill-secondary`: rgb(var(--color_57))
- `--wst-button-color-border-secondary`: rgb(var(--color_58))
- `--wst-button-color-text-secondary`: rgb(var(--color_59))
- `--wst-button-color-fill-secondary-hover`: rgb(var(--color_60))
- `--wst-button-color-border-secondary-hover`: rgb(var(--color_61))
- `--wst-button-color-text-secondary-hover`: rgb(var(--color_62))
- `--wst-button-color-fill-secondary-disabled`: rgb(var(--color_63))
- `--wst-button-color-border-secondary-disabled`: rgb(var(--color_64))
- `--wst-button-color-text-secondary-disabled`: rgb(var(--color_65))
- `--wst-color-fill-base-1`: rgb(var(--color_36))
- `--wst-color-fill-base-2`: rgb(var(--color_37))
- `--wst-color-fill-base-shade-1`: rgb(var(--color_38))
- `--wst-color-fill-base-shade-2`: rgb(var(--color_39))
- `--wst-color-fill-base-shade-3`: rgb(var(--color_40))
- `--wst-color-fill-accent-1`: rgb(var(--color_41))
- `--wst-color-fill-accent-2`: rgb(var(--color_42))
- `--wst-color-fill-accent-3`: rgb(var(--color_43))
- `--wst-color-fill-accent-4`: rgb(var(--color_44))
- `--wst-color-fill-background-primary`: rgb(var(--color_11))
- `--wst-color-fill-background-secondary`: rgb(var(--color_12))
- `--wst-color-text-primary`: rgb(var(--color_15))
- `--wst-color-text-secondary`: rgb(var(--color_14))
- `--wst-color-action`: rgb(var(--color_18))
- `--wst-color-disabled`: rgb(var(--color_39))
- `--wst-color-title`: rgb(var(--color_45))
- `--wst-color-subtitle`: rgb(var(--color_46))
- `--wst-color-line`: rgb(var(--color_47))
- `--wst-font-style-h2`: var(--font_2)
- `--wst-font-style-h3`: var(--font_3)
- `--wst-font-style-h4`: var(--font_4)
- `--wst-font-style-h5`: var(--font_5)
- `--wst-font-style-h6`: var(--font_6)
- `--wst-font-style-body-large`: var(--font_7)
- `--wst-font-style-body-medium`: var(--font_8)
- `--wst-font-style-body-small`: var(--font_9)
- `--wst-font-style-body-x-small`: var(--font_10)
- `--wst-color-custom-1`: rgb(var(--color_13))
- `--wst-color-custom-2`: rgb(var(--color_16))
- `--wst-color-custom-3`: rgb(var(--color_17))
- `--wst-color-custom-4`: rgb(var(--color_19))
- `--wst-color-custom-5`: rgb(var(--color_20))
- `--wst-color-custom-6`: rgb(var(--color_21))
- `--wst-color-custom-7`: rgb(var(--color_22))
- `--wst-color-custom-8`: rgb(var(--color_23))
- `--wst-color-custom-9`: rgb(var(--color_24))
- `--wst-color-custom-10`: rgb(var(--color_25))
- `--wst-color-custom-11`: rgb(var(--color_26))
- `--wst-color-custom-12`: rgb(var(--color_27))
- `--wst-color-custom-13`: rgb(var(--color_28))
- `--wst-color-custom-14`: rgb(var(--color_29))
- `--wst-color-custom-15`: rgb(var(--color_30))
