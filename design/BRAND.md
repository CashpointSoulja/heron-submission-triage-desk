# Heron brand capture

Captured from the public site herondata.io (home, /about, /about-us, /careers, /platform) before any product code was written. `/product` returned 404. All values below were read from the live stylesheet (`herondata-staging28…opt.min.css`) and from computed styles in a 1440px browser, not guessed from screenshots.

## Logo

| Asset | Source | Use here |
| --- | --- | --- |
| `assets/heron-logo-nav.svg` | Inline SVG in the desktop nav (`.nav_desktop_logo`, viewBox `0 0 90.2727 18.7445`, `fill="currentColor"`) | Top-left of every screen, coloured `#4A1809` |
| `assets/heron-logo-tangerine.svg` | Footer image `heron-logo-tangerine.svg` (viewBox `0 0 139.68 29.0026`, `#FF835E`) | Dark panels only |

The mark is three rising slanted bars ("chevron stack") followed by the "Heron" wordmark. The literal SVGs are used unchanged; nothing is redrawn.

## Colour

Heron's tokens are named `--swatch--<hue>-<step>`. The core theme:

| Role | Token | Hex |
| --- | --- | --- |
| Page background | `olive-100` | `#F9FAF0` |
| Section band / secondary button / eyebrow chip | `olive-200` | `#EBEDD9` |
| Hover band | `olive-300` | `#E5E7CF` |
| Card surface | `olive-50` | `#FFFFFD` |
| Text (all headings and body) | `tangerine-800` | `#4A1809` |
| Muted text (hero sub copy) | `tangerine-800` at 60% | `#4A180999` |
| Brand / primary button | `brand-500` = `tangerine-400` | `#FF835E` |
| Primary hover | `tangerine-500` | `#EF5F34` |
| Strong accent | `tangerine-600` | `#CD461D` |
| Border | `dark-900` (`olive-950` `#15160C`) at 20% | `#15160C33` |

Status and category accents (the pixel-block "heron" artwork and badges use these four):

| Hue | 200 (badge bg) | 400 (block) | 800 (badge text / nav icon) |
| --- | --- | --- | --- |
| Green | `#C8EFDB` | `#8DDDB4` | `#1A5637` |
| Blue | `#C2E1F3` | `#99C4DB` | `#143E4D` |
| Pink | `#F4C2D3` | `#EC80A4` | `#5E132C` |
| Yellow | `#F5EFC7` | `#FAEA82` | `#544D1C` |
| Red | `#F1C6C6` | `#EC8080` | `#521E1E` (600 `#C03030`) |

On the site, badge semantics are: green "Pass", red "Fail · 2 found", yellow "Review · officer".

## Typography

| Role | Heron font | Weight | Observed size (1440px) | Tracking |
| --- | --- | --- | --- | --- |
| Display (h1) | Season Mix | 400 | 103px / 1.1 | -0.03em |
| Headings (h2) | Season Sans | 400 | 28px / 1.2 | normal |
| Body | Season Sans | 400 | 16px / 1.2 (14px / 1.5 small) | normal |
| Medium | Season Sans | 500 | used for labels | normal |

Season Sans and Season Mix are commercial typefaces, so they are not redistributed here. The desk uses **Instrument Sans** (SIL Open Font License, self-hosted) as the closest open grotesk, at weight 400 for headings with -0.03em tracking on display sizes, matching Heron's light, large, low-contrast headline style. Nothing is set bold; emphasis comes from size and colour, as on the site.

## Shape and spacing

- Radius: `--radius--main` 0.3125rem (5px), `--radius--small` 0.1875rem (3px). Buttons are near-square rectangles.
- Border: 1px at `#15160C33`.
- Max content width 88rem; site margin 1-3rem fluid.
- Primary button: tangerine fill, brown text, a small dark-brown square holding a play triangle at the right.

## Tone of voice

Plain, confident, operator-to-operator. Short declaratives that pair the mess with the outcome: "Give us the chaos. We give you decision-ready deals." "From submission to offer in minutes." Talks about underwriters, brokers, funders, subs, red flags, CRM. Uses numbers as proof (60,000+ businesses a day, 200+ funders, brokers and fintechs). No hype adjectives, no exclamation marks.

Words Heron uses that the desk reuses as domain vocabulary: submission / sub, scrub, enrich, red flags, decision-ready, underwriting policy, CRM. All product copy in the desk is original.
