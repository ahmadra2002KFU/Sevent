# Sevent Design Tokens

Source of truth for the Sevent visual system. Every new UI surface should consume these tokens rather than hardcoding values. Tokens are exposed both as CSS custom properties in `src/app/globals.css` and as Tailwind v4 `@theme` variables usable as utility classes (e.g. `bg-brand-navy-900`, `text-brand-cobalt-500`).

**Logo source:** `public/logo.svg` (full lockup), `public/logo-mark.svg` (parallelogram S only), `public/favicon.svg`. Hand-authored SVGs render with `Inter Black Italic`; if the senior provides a path-traced vector with the original glyphs, replace these files (the viewBox + colors stay the same).

---

## Palette

### Brand

| Token | Hex | Role |
|---|---|---|
| `brand-navy-900` | `#0F2E5C` | Anchor surfaces, "EVENT" wordmark, primary text on light |
| `brand-navy-700` | `#1C3F73` | Hover state for navy elements |
| `brand-navy-500` | `#355B95` | Navy borders, secondary nav states |
| `brand-cobalt-500` | `#1E7BD8` | Primary CTA, the "S" parallelogram, links, focus ring |
| `brand-cobalt-400` | `#3D91E5` | Hover state for cobalt CTAs |
| `brand-cobalt-100` | `#DCEBFB` | Info backgrounds, soft badges |
| `accent-gold-500` | `#C8993A` | Verified supplier badge, premium trust markers |
| `accent-gold-100` | `#F6EBCE` | Gold badge background fill |

### Neutrals (warm off-white system)

| Token | Hex | Role |
|---|---|---|
| `neutral-50` | `#FAFAF7` | Page background |
| `neutral-100` | `#F4F4EF` | Card background (elevated surfaces on page bg) |
| `neutral-200` | `#E7E6DF` | Borders, dividers, skeleton base |
| `neutral-400` | `#A9A9A1` | Disabled text, icons-muted |
| `neutral-600` | `#6B6B64` | Secondary text, helper copy |
| `neutral-900` | `#1A1A18` | Default body text on light backgrounds |

### Semantic

| Token | Hex | Role |
|---|---|---|
| `semantic-success-500` | `#1E9A5B` | Approved, confirmed, booked |
| `semantic-success-100` | `#D8F1E3` | Success badge background |
| `semantic-warning-500` | `#D89423` | Pending, awaiting action, countdowns nearing deadline |
| `semantic-warning-100` | `#FAEBD3` | Warning badge background |
| `semantic-danger-500` | `#C4353C` | Rejected, cancelled, destructive actions |
| `semantic-danger-100` | `#F6D7D9` | Danger badge background |
| `semantic-info-500` | `#1E7BD8` | Aliases `brand-cobalt-500` — info states reuse primary cobalt |
| `semantic-info-100` | `#DCEBFB` | Aliases `brand-cobalt-100` |

### Status-pill color map

Used by `components/ui-ext/StatusPill.tsx`:

| Status | Background | Foreground |
|---|---|---|
| `invited`, `awaiting_supplier` | `semantic-warning-100` | `semantic-warning-500` |
| `quoted`, `sent` | `brand-cobalt-100` | `brand-cobalt-500` |
| `accepted`, `confirmed`, `booked`, `approved` | `semantic-success-100` | `semantic-success-500` |
| `declined`, `rejected`, `cancelled` | `semantic-danger-100` | `semantic-danger-500` |
| `draft`, `pending` | `neutral-200` | `neutral-600` |

### Accessibility contrast (WCAG AA)

| Pair | Ratio | Usage |
|---|---|---|
| `neutral-900` on `neutral-50` | 15.3:1 | Body text |
| `neutral-600` on `neutral-50` | 5.6:1 | Helper text |
| `brand-navy-900` on `neutral-50` | 13.2:1 | Headings |
| `white` on `brand-cobalt-500` | 3.4:1 | Large-text only — use on buttons sized ≥14px bold or ≥18px regular |
| `white` on `brand-navy-900` | 13.9:1 | Primary CTA foreground |

---

## Typography

### Families

- **Latin (`en`):** `Inter` — loaded via `next/font/google` with weights 400/500/600/700/900 and subset `latin`.
- **Arabic (`ar`):** `Tajawal` — loaded via `next/font/google` with weights 400/500/700/900 and subset `arabic`.

Resolved via CSS variable `--font-sans`:
- `<body>` gets class `font-sans` which maps to `--font-inter` by default
- `[dir="rtl"]` selector swaps `--font-sans` to `--font-tajawal`

### Scale

| Token | Size / line-height | Usage |
|---|---|---|
| `text-xs` | 12 / 16 | Labels, helper text |
| `text-sm` | 14 / 20 | Body small, nav links, table cells |
| `text-base` | 16 / 24 | Default body text |
| `text-lg` | 18 / 28 | Sub-headings, card titles |
| `text-xl` | 20 / 28 | Page section titles |
| `text-2xl` | 24 / 32 | Small page headings |
| `text-3xl` | 30 / 36 | Standard page heading (h1 in PageHeader) |
| `text-4xl` | 36 / 40 | Hero secondary heading |
| `text-5xl` | 48 / 52 | Landing hero primary heading |

Weights used: 400 (body), 500 (labels, emphasis), 600 (nav, button text), 700 (headings, strong), 900 (hero display, logo).

---

## Spacing

Tailwind's default scale (4px base). Standardize on:

- `gap-2` (8) for inline chips + badge clusters
- `gap-4` (16) for form fields within a group
- `gap-6` (24) for card-to-card spacing
- `gap-8` (32) for major page sections
- `p-6` / `px-6 py-8` for cards
- `max-w-6xl` for role-dashboard content containers
- `max-w-2xl` for form-centric pages (auth, new event)

---

## Radius

| Token | px | Usage |
|---|---|---|
| `rounded-sm` | 2 | Pills, chips (when cornered tight) |
| `rounded-md` | 6 | Inputs, buttons, small cards |
| `rounded-lg` | 8 | Cards, dialogs |
| `rounded-xl` | 12 | Hero cards, feature tiles |
| `rounded-2xl` | 16 | Large feature tiles, image containers |
| `rounded-full` | — | Avatars, circular badges |

Default for shadcn primitives: `rounded-md`.

---

## Shadows

| Token | Value | Usage |
|---|---|---|
| `shadow-sm` | `0 1px 2px rgba(15, 46, 92, 0.04)` | Button, input default |
| `shadow` | `0 1px 3px rgba(15, 46, 92, 0.08), 0 1px 2px rgba(15, 46, 92, 0.04)` | Cards |
| `shadow-md` | `0 4px 6px rgba(15, 46, 92, 0.08), 0 2px 4px rgba(15, 46, 92, 0.04)` | Popover, dropdown |
| `shadow-lg` | `0 10px 15px rgba(15, 46, 92, 0.08), 0 4px 6px rgba(15, 46, 92, 0.04)` | Dialog, sheet |

Shadows use the navy brand hue (not neutral black) so elevation feels product-native.

---

## Motion

| Token | Value | Usage |
|---|---|---|
| `duration-150` | 150ms | Hover states, button press |
| `duration-200` | 200ms | Dropdown + tooltip open/close |
| `duration-300` | 300ms | Dialog + sheet transitions |
| `ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Default ease for entering UI |
| `ease-in-out` | standard | State toggles |

Avoid durations > 400ms — feels sluggish in productivity UIs.

---

## Z-index ladder

| Layer | Value |
|---|---|
| Base page | `auto` |
| Sticky nav | `40` |
| Dropdown/Popover | `50` |
| Tooltip | `60` |
| Dialog backdrop + content | `70` / `71` |
| Toast (sonner) | `100` |

---

## Usage rules

1. **Never hardcode hex values in components.** Always reference a token (via Tailwind utility or CSS var).
2. **Primary action = cobalt.** Secondary action = navy-outlined. Tertiary/ghost = plain text.
3. **Trust/verified markers = gold.** Gold is scarce — reserve for verified-supplier badges, "pilot partner" markers, NOT for generic emphasis.
4. **Status lives in semantic tokens.** Don't use success-green for "brand accent"; don't use brand-cobalt for "info success".
5. **Logo tone by surface.**
   - On `neutral-50` or white: full-color SVG (cobalt + navy).
   - On `brand-navy-900`: white-reverse variant (`<Logo tone="white"/>`).
6. **RTL safety:** always use logical utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `text-end`, `border-s-*`, `border-e-*`). Directional utilities (`ml-*`, `mr-*`, `left-*`, `right-*`, `text-left`, `text-right`) are a lint error.
7. **Dark mode is deferred.** Tokens are designed to accommodate a future dark theme via `prefers-color-scheme` + a `--color-*` override block, but no dark variant ships in v1.

---

## Sevent-token shim (migration path)

Lane 0 keeps these aliases alive in `globals.css` so the 31 existing files using `sevent-*` tokens keep building while each surface lane migrates color classes incrementally:

```css
/* Temporary — remove after Lane 2 merges */
--color-sevent-green: var(--color-brand-cobalt-500);
--color-sevent-green-soft: var(--color-semantic-success-500);
--color-sevent-gold: var(--color-accent-gold-500);
--color-sevent-dark: var(--color-brand-navy-900);
--color-sevent-light: var(--color-neutral-50);
```

Each surface lane MUST replace `bg-sevent-*`, `text-sevent-*`, `border-sevent-*` classes with the new token classes as part of its visual refactor. After Lane 2 (organizer) merges, grep for `sevent-` across `src/` — if empty, delete the shim from `globals.css`.
