# Logo rebrand — new SEVENT logo + blue/navy palette

**Date:** 2026-06-03
**Master asset:** `Logo New.png` (1090×500, transparent bg) — the exact file, used directly (no SVG re-draw).

## What changed

### Brand assets (all derived from the exact `Logo New.png` via `sharp`)
| Repo path | What |
|---|---|
| `public/logo.png` | Full-color "SEVENT" wordmark, trimmed (895×259). Used by the app wordmark **and** all emails. |
| `public/logo-mark.png` | The standalone "S" mark (242×259), cropped at the density valley between S and "EVENT". |
| `public/logo-white.png` | White knockout of the wordmark, for dark/navy surfaces. |
| `public/logo-mark-white.png` | White knockout of the "S" mark. |
| `src/app/favicon.ico` | 16/32/48/64 multi-size, from the "S" mark. |
| `src/app/icon.png` | 512px app icon (transparent), from the "S" mark. |
| `src/app/apple-icon.png` | 180px Apple touch icon (mark on white). |

Old vector files removed: `public/logo.svg`, `public/logo-mark.svg`, `public/favicon.svg` (backed up in `work/_old-assets/`). The old email raster `public/logo.png` was replaced (backup in `work/_old-assets/`).

### Code
- `src/components/brand/Logo.tsx` — rewritten to render the PNGs via `next/image` (`variant` = wordmark|mark, `tone` = color|white). Same props, so all call sites are unchanged.
- `src/components/auth/SignupValueHero.tsx` — inline SVG wordmark replaced with `<Image src="/logo-white.png">`; cobalt glow + icon-tile blue shifted to the new palette.
- `src/app/layout.tsx` — removed the stale `icons: { /favicon.svg }`; icons now auto-detected from the `src/app/{favicon.ico,icon.png,apple-icon.png}` file convention.

### Palette (full rebrand)
| Token | Old | New |
|---|---|---|
| brand-cobalt-500 (primary) | `#1e7bd8` | `#4975dd` |
| brand-cobalt-400 | `#3d91e5` | `#6e92e6` |
| brand-cobalt-100 | `#dcebfb` | `#e4eafa` |
| brand-navy-900 | `#0f2e5c` | `#1a2755` |
| brand-navy-700 | `#1c3f73` | `#273d7b` |
| brand-navy-500 | `#355b95` | `#314e99` |
| navy shadow rgb | `15 46 92` | `26 39 85` |
| gold accent | `#c8993a` | unchanged |

Applied in: `src/app/globals.css` (`@theme` + `:root` + `.dark` + shadows), `src/lib/notifications/templates/_brand.ts`, `_shared/BrandShell.tsx` (logo height 33→40 for new aspect), `src/lib/domain/taxonomy.ts` (cobalt/navy swatches + `DEFAULT_ACCENT_HEX`), `src/lib/supabase/types.ts` (comment), plus hardcoded-hex cleanups in `ApprovedCelebration`, `SegmentsPicker`, `ProfilePreview`, `CelebrationBanner`, `WizardStepper`, `PendingReviewChecklist`, `ImportWebsiteCard`, `ChoiceProgress`, `scripts/test-resend-send.ts`, and the 10 email HTML templates (`supabase/templates/*.html` + `public/email-templates/*.html`).

### DB
- `supabase/migrations/20260603000000_rebrand_accent_default.sql` — alters the `suppliers.accent_color` default `#1E7BD8` → `#4975DD`. **Not yet applied** — run `pnpm supabase migration up` (do NOT `db reset`; it wipes data). Existing suppliers keep their chosen accent.

## Verification
- `pnpm typecheck` ✓  ·  `pnpm lint` (changed files) ✓  ·  `pnpm build` ✓ (exit 0, 85 routes; `/icon.png` + `/apple-icon.png` routes emitted)
- Production server (`:3100`) HTTP checks: `/sign-up` serves `next/image` of both `logo.png` + `logo-white.png`; Next injects `<link>` for favicon.ico/icon.png/apple-icon.png; all 7 asset endpoints return 200 with matching byte sizes; `next/image` optimizer returns 200 for each logo.
- Email previews regenerated → `Claude Docs/email-previews/`.
- **Not done:** live in-browser screenshot — the Chrome extension is blocked from capturing localhost by an ExtensionsSettings policy. Verified at the HTTP layer instead.

## Regenerating assets
`work/gen-assets.js` (needs `sharp` + `png-to-ico`) reproduces every asset from `Logo New.png`. `work/replace-email-colors.js` is the email-HTML codemod.
