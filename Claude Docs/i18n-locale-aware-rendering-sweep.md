# i18n — Locale-Aware Rendering Sweep

**Status:** Planned · not yet executed
**Owner:** Claude (execute) + Ahmad (approve)
**Created:** 2026-04-22
**Context window:** Follows the "translation gaps" analysis session where `src/messages/ar.json` was fully translated (245 values) and a Vitest guardrail was added. This plan covers the **remaining React-side work** — places where components render database slugs / `name_en` columns directly instead of through locale-aware domain helpers, so switching to Arabic still surfaces English text or raw slugs.

---

## 1. Why this exists

Translating `ar.json` only fixes strings that flow through `next-intl`'s `t()`. It does **not** fix:

- Database enum slugs (`event_type = "entertainment_culture"`, `city = "riyadh"`) rendered directly into JSX.
- `categories.name_en` column rendered regardless of locale, even though a `name_ar` column exists.
- Hardcoded `Intl.DateTimeFormat("en-SA", …)` date formatters that produce Latin digits + English month names even on an Arabic page.
- A dead `eventFormT("eventType.${slug}")` lookup path that existed for the **old 7 event types** (`wedding`, `corporate`, …) but receives slugs from the **new 5 market segments** (`private_occasions`, `business_events`, …). next-intl returns the literal key when the lookup fails, so Arabic users see strings like `organizer.eventForm.eventType.entertainment_culture` as page headings.

The two highest-visibility pages (`/organizer/events/[id]` and `/organizer/rfqs/new`) were fixed in the prior session. This plan covers the ~20 remaining files that carry the same pattern.

---

## 2. Scope — four classes of bug

### Class A · Raw `event_type` slug via dead translation lookup

Files still calling `eventFormT("eventType.${event.event_type}")`:

| File | Line |
|---|---|
| `src/app/(organizer)/organizer/dashboard/page.tsx` | 275 |
| `src/app/(organizer)/organizer/events/page.tsx` | 125 |
| `src/app/(organizer)/organizer/bookings/[id]/page.tsx` | 260 |
| `src/app/(supplier)/supplier/bookings/[id]/page.tsx` | 210 |

**Fix:** replace with `segmentNameFor(event.event_type, locale)` from `src/lib/domain/segments.ts`. Add `getLocale()` call in each server component.

### Class B · Raw city slug

Files rendering `{event.city}` directly (shows `riyadh` instead of `الرياض`):

| File | Line |
|---|---|
| `src/app/(organizer)/organizer/dashboard/page.tsx` | 279 |
| `src/app/(organizer)/organizer/events/page.tsx` | 140 |
| `src/app/(organizer)/organizer/bookings/[id]/page.tsx` | 193, 269 |
| `src/app/(supplier)/supplier/bookings/[id]/page.tsx` | 171 |
| `src/app/(supplier)/supplier/rfqs/page.tsx` | 252 |
| `src/app/(supplier)/supplier/rfqs/[id]/quote/page.tsx` | 291 |

**Fix:** `cityNameFor(event.city, locale)` from `src/lib/domain/cities.ts`.

### Class C · `name_en` rendered regardless of locale

Files showing category/subcategory/segment names in English under both locales:

| File | Line(s) | What it renders |
|---|---|---|
| `src/app/(organizer)/organizer/dashboard/page.tsx` | 227 | `r.sub?.name_en` |
| `src/app/(organizer)/organizer/rfqs/page.tsx` | 169, 172 | `row.sub?.name_en`, `row.parent?.name_en` |
| `src/app/(organizer)/organizer/rfqs/[id]/page.tsx` | 206, 207 | `rfq.parent?.name_en`, `rfq.sub.name_en` |
| `src/app/(supplier)/supplier/rfqs/page.tsx` | 177, 251 | `subcategory?.name_en` |
| `src/app/(supplier)/supplier/rfqs/[id]/page.tsx` | 311 | `subcategory?.name_en` |
| `src/app/(supplier)/supplier/rfqs/[id]/quote/page.tsx` | 291 | `rfq.categories?.name_en` |
| `src/app/(supplier)/supplier/dashboard/page.tsx` | 635 | `invite.rfq?.category?.name_en` |
| `src/app/(admin)/admin/dashboard/page.tsx` | 587, 588 | `r.cat?.name_en`, `r.sub?.name_en` |
| `src/app/(public)/categories/page.tsx` | 51 | `c.name_en` |
| `src/app/(public)/categories/[parent]/page.tsx` | 27, 28, 71, 76 | `parent.name_en` (page title + metadata + breadcrumb + heading) |
| `src/app/(public)/s/[slug]/page.tsx` | 46 | `firstCat?.parent_name_en ?? firstCat?.name_en` |
| `src/components/public/SupplierProfileHero.tsx` | 174 | `s.name_en` (segment — **should use `segmentNameFor`**, the `MARKET_SEGMENTS` const already has `name_ar`) |

**Fix:**
- For categories (DB-backed): add `name_ar` to the relevant SELECT clause in the caller's `actions.ts`/server query, add `name_ar` to the TS type, then render `locale === "ar" ? row.name_ar : row.name_en` (or add a `categoryName(row, locale)` helper in `src/lib/domain/taxonomy.ts` for reuse).
- For segments (code-backed via `MARKET_SEGMENTS`): use `segmentNameFor(slug, locale)`.

### Class D · Hardcoded `Intl.DateTimeFormat("en-SA", …)`

12 files with the hardcoded `"en-SA"` locale; Arabic users get `Apr 22, 2026` instead of `٢٢ أبريل ٢٠٢٦`:

- `src/app/(organizer)/organizer/dashboard/page.tsx:44`
- `src/app/(organizer)/organizer/rfqs/page.tsx:49`
- `src/app/(organizer)/organizer/rfqs/[id]/page.tsx:71`
- `src/app/(organizer)/organizer/rfqs/[id]/quotes/QuotesTable.tsx:56`
- `src/app/(organizer)/organizer/rfqs/[id]/quotes/[quoteId]/page.tsx:71`
- `src/app/(organizer)/organizer/events/page.tsx:34, 39`
- `src/app/(admin)/admin/dashboard/page.tsx:139, 152`
- `src/app/(supplier)/supplier/rfqs/page.tsx:65`
- `src/app/(supplier)/supplier/rfqs/[id]/page.tsx:84`
- `src/app/(supplier)/supplier/rfqs/[id]/quote/page.tsx:394`

**Fix:** either change each formatter to accept `locale` and pick `ar-SA` / `en-SA`, or — cleaner — extract a single helper `src/lib/domain/formatDate.ts` exporting `fmtDate(iso, locale)` and `fmtDateTime(iso, locale)`, then replace every call site.

---

## 3. Fix strategy — shared helpers, not inline conditionals

Introduce two small additions to stop this bug class from recurring:

### 3a. New file: `src/lib/domain/formatDate.ts`

```ts
export function fmtDate(iso: string, locale: "en" | "ar"): string {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-SA", {
      year: "numeric", month: "short", day: "numeric",
    }).format(new Date(iso));
  } catch { return iso; }
}

export function fmtDateTime(iso: string, locale: "en" | "ar"): string {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-SA", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  } catch { return iso; }
}
```

Every existing `fmtDate` / `fmtDateTime` / `formatIso` inside the ~12 affected files gets deleted and imports swap to this module. Single source of truth.

### 3b. Extend `src/lib/domain/taxonomy.ts` with `categoryName()`

```ts
export function categoryName(
  row: { name_en: string; name_ar?: string | null } | null | undefined,
  locale: "en" | "ar",
): string {
  if (!row) return "";
  if (locale === "ar" && row.name_ar) return row.name_ar;
  return row.name_en;
}
```

Mirror the shape of `segmentNameFor` / `cityNameFor` so the three helpers feel uniform at call sites.

### 3c. Server-side locale access

Server components use `await getLocale()` from `next-intl/server`. Client components use `useLocale()`. The `fmtDate` / `cityNameFor` / `segmentNameFor` / `categoryName` helpers all accept locale as a parameter — they do NOT call the hooks themselves, so they stay server-safe and can be imported from either side.

### 3d. ESLint guardrail (ban the four patterns)

Add custom ESLint rules or a `no-restricted-syntax` config to prevent regression:

1. **Ban** `new Intl.DateTimeFormat("en-SA"` and `"ar-SA"` literal strings — force the helper.
2. **Ban** `.name_en` in JSX expressions outside `src/lib/domain/**` and test files.
3. **Ban** `eventFormT(\`eventType.${…}\`)` template pattern — dead lookup.
4. **Ban** string-literal locale `"en"` / `"ar"` arguments to `DateTimeFormat` unless routed through the helper.

Implemented in `eslint.config.mjs` via `no-restricted-syntax` selectors; no custom plugin needed.

---

## 4. SELECT clauses that need `name_ar` added

Every server action/query that feeds a page in Class C must be extended. Tracker:

| File | Query reads from | Columns to add |
|---|---|---|
| `src/app/(organizer)/organizer/rfqs/actions.ts:115` | `categories` | already done in this session |
| `src/app/(organizer)/organizer/rfqs/page.tsx` (inline query) | `categories` joined via rfqs | `name_ar` |
| `src/app/(organizer)/organizer/rfqs/[id]/page.tsx` (inline query) | `categories` joined via rfqs | `name_ar` |
| `src/app/(organizer)/organizer/dashboard/page.tsx` | rfqs → categories join | `name_ar` |
| `src/app/(supplier)/supplier/rfqs/page.tsx` | rfqs → categories join | `name_ar` |
| `src/app/(supplier)/supplier/rfqs/[id]/page.tsx` | rfqs → categories join | `name_ar` |
| `src/app/(supplier)/supplier/rfqs/[id]/quote/page.tsx` | rfqs → categories join | `name_ar` |
| `src/app/(supplier)/supplier/dashboard/page.tsx` | rfq_invites → rfqs → categories | `name_ar` |
| `src/app/(admin)/admin/dashboard/page.tsx` | rfqs → categories join | `name_ar` |
| `src/app/(public)/categories/page.tsx` | `categories` | `name_ar` |
| `src/app/(public)/categories/[parent]/page.tsx` | `categories` | `name_ar` |
| `src/app/(public)/s/[slug]/page.tsx` | supplier → categories materialized | `name_ar` (and `parent_name_ar` if the view is custom) |

`name_ar` is already a column on the `categories` table (per the 2026-04-21 taxonomy migration). No schema change required.

---

## 5. Execution order

Sequenced to minimize churn and keep each step verifiable.

1. **Add the helpers.** Create `src/lib/domain/formatDate.ts` and extend `src/lib/domain/taxonomy.ts` with `categoryName`. Export both from a barrel if convenient.
2. **Class D sweep — date formatter.** Replace all 12 `Intl.DateTimeFormat("en-SA", …)` call sites with the helper. Pass `locale` from `await getLocale()` (server) or `useLocale()` (client). This is the most mechanical step and touches the most files, so doing it first surfaces any subtle compile issue (e.g. a client component that needs the locale prop piped in).
3. **Class A sweep — event type.** 4 files. Each gets a `segmentNameFor(event.event_type, locale)` replacement and a `getLocale()` call if not already present.
4. **Class B sweep — city.** 7 call sites. Replace with `cityNameFor(city, locale)`.
5. **Class C sweep — category name.**
   - Extend each affected query's SELECT to include `name_ar`.
   - Extend each TS type.
   - Render via `categoryName(row, locale)`.
6. **Gate: TypeScript + ESLint + tests.** `pnpm exec tsc --noEmit && pnpm exec eslint src && pnpm test`. Guardrail test from the prior session stays green.
7. **Add the ESLint rules** (step 3d). Run `pnpm exec eslint src --fix` to confirm the codebase is clean under the new rules. If any remaining violation surfaces, fix it and re-gate.
8. **Manual walkthrough in Arabic locale:**
   - `/organizer/dashboard`, `/organizer/events`, `/organizer/rfqs`, `/organizer/rfqs/[id]`, `/organizer/bookings/[id]`.
   - `/supplier/dashboard`, `/supplier/rfqs`, `/supplier/rfqs/[id]`, `/supplier/rfqs/[id]/quote`, `/supplier/bookings/[id]`.
   - `/admin/dashboard`.
   - `/categories`, `/categories/[parent]`, `/s/[slug]`.

   Confirm: no raw `entertainment_culture`-style strings; cities show `الرياض`/`جدة`; category names show Arabic; dates show Arabic month names + Arabic-Indic digits.

---

## 6. Success criteria

The pass is done when all of the following hold:

- [ ] `pnpm exec tsc --noEmit` clean.
- [ ] `pnpm exec eslint src` clean, with the new rules active.
- [ ] `pnpm test` clean, including the translation-coverage guardrail from the prior session.
- [ ] Grep yields zero hits in `src/` for:
  - `eventFormT(\`eventType\.`  (dead lookup — fully deleted)
  - `new Intl\.DateTimeFormat\("en-SA"`  (replaced by helper)
  - `\.name_en}` in `.tsx` files outside `src/lib/domain` and tests
  - `{[a-z_]+\.city}` (bare city render) in `.tsx` files outside the helpers
- [ ] Arabic walkthrough of the 14 routes in step 8 shows no English slugs, no `en-SA` date formatting, no `name_en` category names.
- [ ] The old 7 `organizer.eventForm.eventType.{wedding,corporate,…}` keys can be deleted from both `en.json` and `ar.json` (the only callers were the dead lookup). Ship this deletion in the same commit as the sweep.

---

## 7. Risks + notes

- **Breaking the `organizer.eventForm.eventType.*` keys.** They're currently referenced by the dead lookup and nothing else. Confirmed by grep. Deleting them will not break any rendering path once the sweep is complete.
- **`public/s/[slug]/page.tsx` uses `parent_name_en`** — that's a materialized view column, not a plain join. Check the view definition before adding `parent_name_ar`; it may need a view migration. Flagged as the one potential schema risk in this plan.
- **RTL-aware date formatting.** `ar-SA` produces Arabic-Indic digits (`٠ ١ ٢ ٣…`). Double-check that any downstream string match / test assertion on dates uses locale-aware parsing, not string equality.
- **Client components that receive dates as props already formatted by the server.** If any component today accepts a pre-formatted string and re-uses it, the sweep will change that string shape. Grep for `.toLocaleDateString` / `"en-SA"` in client components after the first pass and audit props.
- **ESLint custom selectors can be noisy.** Keep the regex tight; limit to `.tsx` files in `src/app/**` and `src/components/**`. Allow-list `src/lib/domain/**` and test files.

---

## 8. Out of scope (deferred)

- Currency formatting (`formatHalalas`) — not part of this sweep but similarly should accept locale for Arabic digit form. Track separately.
- Number formatting on dashboard KPIs. Separate sweep.
- RTL bidi issues in table cells mixing English identifiers with Arabic labels. UI polish, not locale correctness.
- Email subject/body localization for transactional emails (Supabase auth + booking notifications). Server-side template rewrite; not this pass.

---

## 9. Related documents

- `Claude Docs/plan.md` — current sprint plan.
- `Claude Docs/taxonomy-legacy.md` — snapshot of the old event-type enum that the dead lookup was built against.
- `src/messages/__tests__/translation-coverage.test.ts` — guardrail test added in the previous session; this sweep keeps it green.
- Session transcript: `C:\Users\Ahmad\.claude\projects\D--Mufeed-Sevent-Code\46ab9333-eb30-4ab9-bd7d-3e84986e5812.jsonl` (analysis + prior mechanical fixes to `/organizer/events/[id]` and `/organizer/rfqs/new`).
