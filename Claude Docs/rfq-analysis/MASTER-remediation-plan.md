> **Implementation status (2026-05-17):** Implemented and ready. The documented RFQ/i18n remediation stages match current code, including shared requirements rendering, locale helpers, Zod locale wiring, Accept-Language negotiation, ESLint fences, tests, and atomic marketplace publishing.

# RFQ Surface — Language Leakage: Master Remediation Plan

**Date:** 2026-05-14
**Source:** Consolidated from 3 parallel open-review (opencode / gpt-5.x) plan agents:
- `agent-1-rfq-authoring.md` — organizer RFQ wizard, list, detail
- `agent-2-rfq-response.md` — supplier RFQ view, quote builder, proposal upload, decline
- `agent-3-rfq-infra-i18n.md` (+ `opencode-full-analysis.txt`) — quote comparison/print/export, admin monitor, i18n infrastructure, notifications

**Total distinct language-leakage issues:** ~48 (after de-duplication)

---

## What "language leakage" means here

Any place where text renders in the **wrong language regardless of the active locale**. Six recurring classes were found:

| Class | Pattern | Fix |
|---|---|---|
| **L1** Hardcoded UI strings | English/Arabic literals in JSX, labels, placeholders, aria-labels, toasts | route through next-intl `t()` |
| **L2** Raw DB slugs | `event_type`, `city`, `base_city`, quote/booking status, line-item `kind` rendered directly or via `.replace(/_/g," ")` | `cityNameFor` / `segmentNameFor` / new enum translation maps |
| **L3** Raw requirement JSON | `requirements_jsonb` enum values (`buffet`, `halal`, `indoor`) dumped raw | new `requirementValues.*` keys + shared presenter component |
| **L4** English-only server actions | server actions return English prose; some leak raw `error.message` | return stable error **codes**, translate at render boundary |
| **L5** Notification/email leakage | cross-locale fallback (`name_ar \|\| name_en`), `"your event"` English fallback, single-language props, hardcoded `Intl` tags | locale-pure fields, bilingual props, `intlLocaleFor()` helper |
| **L6** Locale-unaware formatters | `formatHalalas` / `Intl.NumberFormat` / `date-fns` default to en → English digits in Arabic | locale-aware money/number/relative-time helpers |

---

## Helper inventory (verified to exist)

- `src/lib/domain/segments.ts` → `segmentNameFor(slug, locale)` ✅
- `src/lib/domain/cities.ts` → `cityNameFor(slug, locale)` ✅
- `src/lib/domain/taxonomy.ts` → `categoryName(row, locale)` ✅ (but has a hardcoded English `"RFQ"`-style fallback — see I-07)
- `src/lib/domain/formatDate.ts` → `fmtDate` / `fmtDateTime` ✅ (not used for relative-time or in the wizard)
- `src/messages/en.json` / `ar.json` → **structural parity 100%** (3017 lines, 0 keys-only-in-one-file). Gaps are *code-to-message*, not file-to-file.

**New helpers needed:** locale-aware `formatMoney(halalas, locale)`, `fmtNumber` / `fmtPercent`, relative-time wrapper, and `intlLocaleFor(locale)` for notification templates.

---

## P0 — Critical (blocks Arabic UX on core flows)

| # | File:line | Issue | Fix |
|---|---|---|---|
| I-01 | `organizer/rfqs/[id]/quotes/[quoteId]/page.tsx:164-519` | 20+ hardcoded English strings (snapshot headings, line-item table, totals, "Back to compare", "Valid until", etc.) | route all through existing/new `organizer.quote.*` keys |
| I-02 | `organizer/rfqs/[id]/quotes/export.csv/route.ts:20-246` | Entire CSV is fixed English — headers, status enums, "yes/no", truncation suffix, "Unauthorized" 401 body | give route locale access; translate every header/cell/status |
| I-03 | `quotes/[quoteId]/page.tsx:274,403` + `admin/rfqs/[id]/page.tsx:653-667` | `.replace(/_/g," ")` on quote status, line-item kind, booking confirmation/payment/service status | new enum translation maps (`quoteStatus.*`, `lineItemKind.*`, `bookingStatus.*`) |
| I-04 | `quotes/[quoteId]/page.tsx:269`, `print/page.tsx:68-93`, `export.csv/route.ts:114`, `QuoteComparisonGrid.tsx:356`, `ShortlistEditor.tsx:296,343` | raw `city` / `base_city` slug rendered across compare/print/CSV/shortlist | `cityNameFor(slug, locale)` everywhere |
| I-05 | `organizer/rfqs/actions.ts:300-366`, `quotes/actions.ts:87-764`, `supplier/.../quote/actions.ts`, `proposal-upload/actions.ts`, `supplier/rfqs/actions.ts` | server actions return English prose / raw `error.message` as user-facing copy | return stable error codes; map to `t()` at render boundary; never expose `error.message` |
| I-06 | `supplier/rfqs/[id]/page.tsx:141-172`, `opportunities/[id]/page.tsx:181-205`, `admin/rfqs/[id]/page.tsx:733-759`, `organizer/rfqs/new/page.tsx:995-1007`, `organizer/rfqs/[id]/page.tsx:101-139` | requirement values (`buffet`, `halal`, `indoor`, dietary arrays…) rendered raw; logic duplicated in 5 places | add `requirementValues.*` keys; build **one** shared `RfqRequirementsView` component used by all 5 |

## P1 — High

| # | File:line | Issue | Fix |
|---|---|---|---|
| I-07 | `taxonomy.ts` + `supplier/rfqs/page.tsx:204`, `:314`, `:421`, `quote/page.tsx:285` | hardcoded English `"RFQ"` category fallback | `t("supplier.rfqInbox.fallbackCategoryLabel")` |
| I-08 | `supplier/rfqs/[id]/page.tsx:423-425,476` | hardcoded "quote data corrupt" JSX; raw quote status slug interpolated | move to keys; translate status first |
| I-09 | `print/page.tsx:21-31,109`, `admin` invite source | invite-source labels (`self-applied`, `auto-matched`, `organizer-picked`) + "⚠ conflict" hardcoded | reuse translated source-badge keys |
| I-10 | `ShortlistEditor.tsx:201-207` + `lib/domain/matching/reasons.ts:15-24` | auto-match reason badges all English | translate via key + params |
| I-11 | `organizer/rfqs/new/page.tsx:68-87` | local duplicated `fmtDate` + `categoryName` helpers | import shared `formatDate.ts` / `taxonomy.ts` |
| I-12 | `organizer/rfqs/new/page.tsx:993` | enum `kind` embedded raw in translation string | `t(\`rfq.kind.${kind}\`)` |
| I-13 | `organizer/rfqs/[id]/page.tsx:114-116,200,307-311,329` | "Yes"/"No" hardcoded; `"RFQ"` title fallback; raw invite-source fallback; decline reason codes raw | `t()` + `t(\`rfq.declineReason.${code}\`)` |
| I-14 | aria-labels: `organizer/rfqs/page.tsx:244`, `supplier/rfqs/page.tsx:366`, `admin/rfqs/page.tsx:423`, `QuoteBuilderForm.tsx:406` | hardcoded English aria-labels (pagination, remove line item) | `t("pagination.ariaLabel")`, `t("supplier.quote.removeLineItemAriaLabel")` |
| I-15 | `supplier/rfqs/page.tsx:75-77` | `date-fns` relative time not given a locale → English "1 day ago" in Arabic | pass `ar`/`enUS` locale to `formatDistanceToNowStrict` |
| I-16 | `QuoteBuilderForm.tsx:57` | hardcoded English Zod validation message | `supplier.quote.errors.positiveAmountRequired` |
| I-17 | notifications: `RfqInvited.tsx:38,50-53`, `QuoteRejected.tsx:22`, `QuoteProposalRequested.tsx:23`, `quotes/actions.ts:213,575,640`, `supplier/.../quote/actions.ts:621`, `supplier/rfqs/actions.ts:73,87` | `"your event"` English fallback; cross-locale `name_ar \|\| name_en` fallback; raw event_type slug in email; organizer notification not localized to recipient locale | carry `event_type` slug + recipient locale → `segmentNameFor(slug, recipientLocale)`; locale-pure category field; localized fallback strings |
| I-18 | `QuoteAccepted.tsx:11`, `QuoteReceived.tsx:13` | template props single-language (`eventName: string`, `rfqTitle: string`) | accept `{ en, ar }` or slug + locale |
| I-19 | `admin/rfqs/page.tsx:352`, `admin/rfqs/[id]/page.tsx:355`, `RfqFilters.tsx:14-22` | `pending` status renderable + filterable in code but `admin.rfqs.status.pending` / `admin.rfqs.filter.pending` missing from both message files | add the 2 keys; add `pending` to filter list |

## P2 — Medium

| # | File:line | Issue | Fix |
|---|---|---|---|
| I-20 | `RfqInvited.tsx:24`, `QuoteAccepted.tsx:21`, `QuoteReceived.tsx:32-34` | hardcoded `"ar-SA"`/`"en-GB"`/`"en-US"` Intl tags duplicated | one shared `intlLocaleFor(locale)` helper |
| I-21 | `formatHalalas` across `QuoteComparisonGrid`, `print`, `[quoteId]`, `admin` | money formatter defaults to `en-SA` → English digits in Arabic | require `locale` param / locale-aware money helper |
| I-22 | `QuoteComparisonGrid.tsx:636,643,716`, `print:146,153,210`, `[quoteId]:408,450,461` | raw `%` / `qty` / numeric interpolation → Latin digits in Arabic | shared `fmtNumber` / `fmtPercent` |
| I-23 | `admin/rfqs/page.tsx:165-177` | admin search matches raw slugs only — Arabic search terms miss | normalize localized search terms → slugs before query |
| I-24 | RFQ status coverage | messages define ~6 RFQ status keys; DB can emit more (incl. `pending`) | audit full enum; add missing keys |
| I-25 | `QuoteBuilderForm.tsx:271-275` | dead branch interpolates raw slugs if ever rendered | remove dead branch or translate |

## P3 — Infrastructure / guardrails

| # | File:line | Issue | Fix |
|---|---|---|---|
| I-26 | `src/lib/zod/i18n.ts:26-33` + `src/i18n/request.ts` | `z.config()` mutates Zod locale **process-globally** per request → concurrent en/ar requests race | request-scoped error map / wrapper validators |
| I-27 | `src/i18n/request.ts:18-21` | `Accept-Language` parsing only reads first token → `fr,ar;q=0.9` wrongly falls back to English | proper best-match negotiation over `["en","ar"]` |
| I-28 | — | no regression guardrail | add `no-restricted-syntax` ESLint rules banning: `Intl.DateTimeFormat`/`NumberFormat` outside helpers, `.replace(/_/g," ")` on enum fields, raw `.city`/`.base_city`/`.event_type` JSX renders, `name_ar \|\| name_en` cross-fallbacks; add tests asserting every runtime status/enum value has a translation key |

---

## New translation keys required (both en.json + ar.json)

Approx. **40-50 new keys**, grouped:
- `organizer.quote.*` — snapshot/detail page labels (~22 keys)
- `quoteStatus.*`, `lineItemKind.*`, `bookingStatus.*` — enum maps (~20 keys)
- `requirementValues.*` — meal type, dietary, seating, indoor/outdoor, service style, deliverables (~25 keys)
- `rfq.declineReason.*`, `rfq.kind.*`, `rfq.inviteSource.*`, `rfq.inviteStatus.*` — RFQ enum maps (~15 keys)
- `supplier.quote.errors.*`, `supplier.proposalUpload.errors.*` — error-code → message maps (~16 keys)
- `admin.rfqs.status.pending`, `admin.rfqs.filter.pending`, `pagination.ariaLabel`, misc (~5 keys)
- CSV / print labels (~12 keys)

---

## Architecture/design issues found (NOT language leakage — separate track)

These were surfaced by the agents but are **bugs/design debt, not localization**. Listed for visibility; recommend a separate decision on whether to fix now:

1. **`kindFromParentSlug()` mismatch** *(real bug)* — assumes slugs `venues`/`catering`/`photography`; seeded taxonomy uses `sound_lighting`/`photo_video`/`catering_hospitality`, so real categories collapse to the `generic` extension form.
2. Dead `overrideKind`/`kindOverridden` wizard state — no UI dispatches it.
3. Extension `errors` prop accepted but never supplied by the wizard.
4. Requirements rendering logic duplicated across 5 files (folded into I-06's shared component).
5. Shortlist size limit mismatch — Zod `max(10)` vs RPC error text says 20.
6. Marketplace privacy flag set outside the create-RFQ transaction → RFQ can exist non-private on partial failure.
7. Quote builder ships rule-engine loader code + 3 submission modes but UI only ever submits `free_form` — dead branches.
8. Decline flow uses throw+redirect instead of the `ActionBanner`/action-state pattern the rest of the surface uses.

---

## Proposed execution order (language leakage track)

1. **Helpers + keys foundation** — add `intlLocaleFor`, locale-aware money/number/relative-time helpers; add all ~45 new keys to both message files.
2. **Shared `RfqRequirementsView` component** (I-06) — unblocks 5 call sites.
3. **P0 sweep** — I-01..I-05 (quote detail, CSV, enum maps, city slugs, server-action error codes).
4. **P1 sweep** — I-07..I-19.
5. **P2 sweep** — I-20..I-25.
6. **P3** — Zod race, Accept-Language, ESLint guardrails + coverage tests.
7. **Gate:** `pnpm exec tsc --noEmit` + `pnpm exec eslint src` + `pnpm test` clean; manual Arabic-locale walkthrough of every RFQ route.

## Success criteria

- [ ] Zero raw slug renders (`city`, `base_city`, `event_type`, status enums) in RFQ-surface `.tsx` outside domain helpers.
- [ ] Zero hardcoded English/Arabic literals in RFQ-surface JSX (all via `t()`).
- [ ] CSV export + print page + quote detail fully localized.
- [ ] Server actions return codes, not prose; UI translates them.
- [ ] Notification templates: no cross-locale fallback, no `"your event"`, bilingual props.
- [ ] `tsc` + `eslint` + `pnpm test` green; new guardrail rules active.
- [ ] Arabic walkthrough: no English slugs, no Latin digits where Arabic-Indic expected, no literal translation keys.

---

## Stage 1 remainder — DONE (2026-05-14)

Completed items **I-06** (shared requirements presenter) and **I-05** (server-action
error codes). Stage 0 + I-01..I-04 were already done before this pass.

### New translation keys (69 per locale, en.json + ar.json, via `scripts/i18n-merge-keys.cjs`)

- `rfqRequirements.*` — shared field-label namespace for the requirements
  presenter: `unknownKind`, `noStructuredRequirements`, `yes`, `no`, and
  `field.{kind,seating_style,indoor_outdoor,needs_parking,needs_kitchen,meal_type,dietary,service_style,coverage_hours,deliverables,crew_size,qty,notes}` (17 keys).
- `supplier.quote.errors.*` — 18 error-code keys for the quote builder action
  (`supplierProfileNotFound`, `invalidSubmission`, `technicalProposalTooLarge`,
  `technicalProposalNotPdf`, `supplierMismatch`, `inviteLookupFailed`,
  `rfqNotOpen`, `rfqLookupFailed`, `rfqOrEventNotFound`, `quoteNotEditable`,
  `packageRequired`, `packageLookupFailed`, `packageNotFound`,
  `packageInactive`, `rulesLookupFailed`, `rpcNoRow`, `rpcFailed`, `unknown`).
- `supplier.proposalUpload.errors.*` — 11 error-code keys for the proposal-upload
  action.
- `supplier.decline.errors.*` — 3 codes for the decline action (still
  throw+redirect; codes match for the eventual action-state migration).
- `organizer.rfqWizard.errors.*` — 11 error-code keys for `sendRfqAction`.
- `organizer.quote.rfpErrors.*` — 9 codes for the proposal request/cancel
  actions. (`organizer.quote.acceptError*` already existed and is now wired.)

### I-06 — Shared `RfqRequirementsView` component

- **New** `src/components/rfq/requirementRows.tsx` — framework-agnostic
  `buildRfqRequirementRows(value, t, tValues)` row builder shared by server +
  client; exhausts the `RfqExtension` discriminated union once.
- **New** `src/components/rfq/RfqRequirementsView.tsx` — async server component;
  safe-parses raw `requirements_jsonb`, renders a localized `<dl>` field list
  (labels via `rfqRequirements.field.*`, enum values via `requirementValues.*`),
  with localized fallback lines for missing/unrecognized payloads.
- Wired into call sites, deleting their ad-hoc renderers:
  - `organizer/rfqs/[id]/page.tsx` — removed `PrettyRequirements` (dumped raw
    slugs + raw `kind` badge + `"Yes"/"No"` literals).
  - `supplier/rfqs/[id]/page.tsx` — removed local `RequirementsBlock` (rendered
    raw enum slugs as values).
  - `supplier/opportunities/[id]/page.tsx` — removed `RequirementsBlock` +
    `renderRequirementValue` (raw `Object.entries()` dump with raw slug keys).
  - `organizer/rfqs/new/page.tsx` (wizard step-4 review) — replaced the raw
    `Object.entries` dump with `buildRfqRequirementRows`; also fixed I-12 in
    passing — `reviewRequirements` now interpolates the translated `kind` value
    instead of the raw slug.
  - Admin `rfqs/[id]/page.tsx` `RequirementsBody` left as-is — already correct
    in-place with admin-namespaced labels; refactor would be churn, not a clean
    win (task said "only if clean").

### I-05 — Server-action error codes

All five server actions now return stable error **codes** (or carry codes in
the `ActionState` error variant); the render boundary maps code → `t()`. No
raw `error.message` is exposed to users anywhere; backend messages are
`console.warn`/`console.error`-logged instead.

- `action-state.ts` (organizer quotes, supplier quote, supplier proposal-upload):
  error variant changed to `{ status: "error"; code: string; message?: string }`;
  organizer variant also carries optional `params` for `acceptErrorRfqTerminal`.
- `organizer/rfqs/[id]/quotes/actions.ts` — `messageForError` → `errorForRpc`
  returning `{ code, params? }` mapped to `organizer.quote.acceptError*`;
  `requestProposalAction` / `cancelProposalRequestAction` return
  `organizer.quote.rfpErrors.*` codes.
- `organizer/rfqs/actions.ts` — `sendRfqAction` result type changed to
  `{ ok: false; code: string; issues? }`; P0020–P0025 mapped to
  `organizer.rfqWizard.errors.*`; raw RPC/thrown messages no longer surfaced.
- `supplier/rfqs/[id]/quote/actions.ts` — `mapRpcError` → `mapRpcErrorCode`;
  `readSubmission` + `loadPackage` + `loadActiveRules` now return `{ errorCode }`;
  all `sendQuoteAction` error returns carry `supplier.quote.errors.*` codes.
- `supplier/rfqs/[id]/proposal-upload/actions.ts` — all error returns carry
  `supplier.proposalUpload.errors.*` codes.
- `supplier/rfqs/actions.ts` — `declineInviteAction` still throws (design debt,
  separate track) but no longer interpolates raw `error.message`; throws stable
  `decline:<code>` tokens and logs the DB message.
- Render boundaries updated to translate codes:
  `QuoteComparisonGrid.tsx` (`AcceptForm`, `RfpCell`), `QuoteBuilderForm.tsx`
  (`ActionBanner`), `ProposalUploadForm.tsx`, and the wizard `Step4` error alert.

### Gate results

- `pnpm exec tsc --noEmit` — clean.
- `pnpm exec eslint src` — clean for all touched files. (3 pre-existing
  `set-state-in-effect` errors remain in untouched `feedback/FeedbackRow.tsx` +
  `feedback/FeedbackWidget.tsx`; not in scope, not modified.)
- `pnpm test` — 101 passed / 12 skipped, including `translation-coverage`
  (en/ar 100% structural parity, no AR leaf equal to its EN leaf).

### Deferred / notes

- Admin `RequirementsBody` not refactored (intentional — already correct).
- `supplier.opportunities.detail.noRequirements` message key is now orphaned
  (the shared component owns its own fallback copy). Harmless; left for a later
  dead-key sweep.
- `declineInviteAction` not migrated to the action-state pattern — that is
  master-plan design-debt item #8, explicitly a separate track. I-05's
  requirement ("never expose raw `error.message`") is satisfied.

---

## Stage 2 (P1, items I-07..I-19) — DONE (2026-05-17)

Gate: tsc clean, eslint clean except 3 pre-existing `feedback/` errors, 101/101 tests pass, en/ar parity 100% (2376 keys).

### Per-item status
- I-07 ✅ supplier `"RFQ"` fallback → `t("supplier.rfqInbox.fallbackCategoryLabel")`
- I-08 ✅ supplier/rfqs/[id] quote-corrupt JSX → `t("quoteCorrupt")`; quote status routed through translation map
- I-09 ✅ print invite-source + "⚠ conflict" → translated via `organizer.rfqs.source` + `organizer.quote.compare.conflictMark`
- I-10 ✅ ShortlistEditor auto-match reasons → `t(\`reasons.${reason.code}\`, reason.params)`; `lib/domain/matching/reasons.ts` returns `{code, params}` instead of raw English
- I-11 ✅ organizer/rfqs/new local `fmtDate`/`categoryName` → shared imports
- I-12 ✅ raw `kind` slug in `reviewRequirements` → translated via shared `RfqRequirementsView`
- I-13 ✅ Yes/No, "RFQ" title, invite-source fallback, `decline_reason_code` raw → all translated (`tDecline` + `source.unknown`)
- I-14 ✅ aria-label="Pagination" on organizer/rfqs and admin/rfqs → `t("pagination.ariaLabel")`
- I-15 ✅ `date-fns` relative → replaced with `fmtRelative(iso, locale)` from `formatDate.ts`
- I-16 ✅ QuoteBuilderForm Zod messages → emit translation key strings (`positiveAmountRequired`, `requiredField`); `ErrorText` translates via `supplier.quote.errors.*`
- I-17 ✅ notification templates `RfqInvited`/`QuoteRejected`/`QuoteProposalRequested`: `event_type` semantically a SLUG; resolved via `getSegmentBySlug` (returns null for unknown → localized `genericEventFallback`); cross-locale `name_ar || name_en` fallback removed (locale-pure). Callers `quotes/actions.ts` updated to pass slug + per-recipient localization.
- I-18 ✅ `QuoteAccepted.eventName` and `QuoteReceived.rfqTitle` widened to `BilingualText = string | { en, ar }`; hardcoded `en-GB`/`en-US` → `intlLocaleFor(locale)`. `supplier/.../quote/actions.ts` updated to pass `{ en, ar }` bilingual from `getSegmentBySlug`.
- I-19 ✅ `admin.rfqs.status.pending` + `admin.rfqs.filter.pending` keys added; `pending` added to `RFQ_STATUS_FILTERS`.

### Files changed (Stage 2 delta on top of Stage 1)
- Components: `src/components/rfq/ShortlistEditor.tsx` (auto-match reasons), `src/lib/domain/matching/reasons.ts` + `autoMatch.ts` (return `{code, params}`).
- Pages: `src/app/(organizer)/organizer/rfqs/page.tsx`, `[id]/page.tsx`, `new/page.tsx`, `src/app/(supplier)/supplier/rfqs/page.tsx`, `[id]/page.tsx`, `src/app/(supplier)/supplier/rfqs/[id]/quote/page.tsx`, `src/app/(admin)/admin/(monitor)/rfqs/page.tsx`, `_components/RfqFilters.tsx`.
- Forms: `src/app/(supplier)/supplier/rfqs/[id]/quote/QuoteBuilderForm.tsx` (Zod key-as-message + `ErrorText` translates).
- Notification templates: `RfqInvited.tsx`+`.strings.ts`, `QuoteRejected.tsx`+`.strings.ts`, `QuoteProposalRequested.tsx`+`.strings.ts`, `QuoteAccepted.tsx`, `organizer/QuoteReceived.tsx`.
- Action callers: `src/app/(organizer)/organizer/rfqs/[id]/quotes/actions.ts`, `src/app/(supplier)/supplier/rfqs/[id]/quote/actions.ts`.

### New keys this stage
~16 added (`supplier.rfqInbox.fallbackCategoryLabel`, `genericEventFallback` per notification, plus admin pending keys merged in earlier). All AR distinct from EN.

---

## Stage 3 (P2, items I-20..I-25) — DONE (2026-05-17)

Gate: `pnpm exec tsc --noEmit` clean, `pnpm exec eslint src` clean for everything touched (only the 3 pre-existing `feedback/` `set-state-in-effect` errors remain, plus benign warnings — none in scope), `pnpm test` 101 passed / 12 skipped, en/ar parity 100% (2377 keys per locale).

### Per-item status
- **I-20** ✅ Swept *all* notification templates for hardcoded BCP-47 tags. Stage 2 had already fixed `RfqInvited`, `QuoteAccepted`, `QuoteReceived`. Stage 3 fixed the remaining three: `organizer/BookingCreated.tsx` (Asia/Riyadh deadline), `organizer/BookingConfirmed.tsx` (event start), `auth/PasswordChanged.tsx` (`formatChangedAt`). All now go through `intlLocaleFor(locale)` from `../_shared/i18n`. Verified by grep: no `"ar-SA"|"en-GB"|"en-US"|"en-SA"` literals remain in `src/lib/notifications/templates/**/*.tsx` outside the shared `i18n.ts` helper itself.
- **I-21** ✅ Replaced every `formatHalalas(...)` call site on the RFQ surface with `formatMoney(halalas, locale)` from `@/lib/domain/money`:
  - `QuoteComparisonGrid.tsx` — 8 calls (total/subtotal/setup/travel/teardown/VAT amount + 2 per line-item).
  - `admin/(monitor)/rfqs/[id]/page.tsx` — `budgetLabel` (min + max range).
  - `print/page.tsx` and `[quoteId]/page.tsx` were already on `formatMoney` from Stage 1 (verified).
  - Other `formatHalalas` callers (contracts PDF, bookings, public package cards, supplier bookings, dispute detail, supplier rfqs detail, catalog client) are **outside the RFQ surface scope**; left intact per master-plan boundary.
- **I-22** ✅ Raw `%`/`qty`/numeric interpolations on the RFQ surface routed through `fmtPercent`/`fmtNumber` from `@/lib/domain/formatDate`:
  - `QuoteComparisonGrid.tsx`: `vat_rate_pct` row now `fmtPercent`; `deposit_pct` row now `fmtPercent`; `li.qty` now `fmtNumber`.
  - `print/page.tsx`: `li.qty` now `fmtNumber` (VAT % + deposit % were already `fmtPercent` from Stage 1).
  - `[quoteId]/page.tsx`: `{item.qty}` → `fmtNumber`; `vatWithRate` ICU param now receives `fmtNumber(snap.vat_rate_pct, locale)` so the embedded percent value is Arabic-Indic on `ar`. (Deposit row already on `fmtPercent`.)
- **I-23** ✅ Admin RFQ search (`admin/(monitor)/rfqs/page.tsx`) now normalizes localized terms back to slugs. New helper `resolveSlugMatches(q)` does NFC-lower-case substring matching against `MARKET_SEGMENTS` (slug + name_en + name_ar) and `KSA_CITIES` (slug + name_en + name_ar), then `OR`s the resulting `event_type.in.(...)` / `city.in.(...)` clauses into the existing PostgREST `or()` alongside the raw ilike (which still catches operators who type slug or English label directly). Arabic operators searching "الرياض" or "مناسبات خاصة" now match.
- **I-24** ✅ Audited RFQ status enum coverage across the three namespaces. Findings:
  - DB enum `public.rfq_status` = `draft|sent|quoted|expired|booked|cancelled` — all 6 present in both `admin.rfqs.status` and `organizer.rfqs.status` and `admin.rfqs.filter`.
  - `pending` is a *code-level* fallback used by both admin and organizer `toPillStatus`/`rfqStatusPill` when an unrecognized value arrives from the DB. `admin.rfqs.status.pending` + `admin.rfqs.filter.pending` were added in Stage 2; `organizer.rfqs.status.pending` was missing — added (1 key per locale).
  - `RfqInviteStatus` = `invited|declined|quoted|withdrawn` plus the display-only `applied` — all 5 present in `supplier.rfqInbox.status`. `organizer.rfqs.inviteStatus` carries the 4 DB values (it doesn't display `applied`). No gap.
- **I-25** ✅ `QuoteBuilderForm.tsx:271-280` dead branch removed. Verified the parent `quote/page.tsx:182-184` calls `redirect()` on any TERMINAL quote status (`accepted|rejected|expired|withdrawn`), so `props.locked` is always `false` at render time — the banner could never appear. The branch also mis-used `initialSnapshot.source` (which is `rule_engine|free_form|mixed`, not a status) as if it were a status, producing nonsense like "This quote is already free_form". Deleted the `Alert` block + its now-unused `Alert`/`AlertDescription` import; kept the `props.locked` prop wired to the submit button's `disabled` attribute as a defense-in-depth guard in case the redirect ever races. Documented inline.

### Files changed
- `src/lib/notifications/templates/organizer/BookingCreated.tsx` — `intlLocaleFor`.
- `src/lib/notifications/templates/organizer/BookingConfirmed.tsx` — `intlLocaleFor`.
- `src/lib/notifications/templates/auth/PasswordChanged.tsx` — `intlLocaleFor`.
- `src/app/(organizer)/organizer/rfqs/[id]/quotes/QuoteComparisonGrid.tsx` — `formatHalalas`→`formatMoney`; raw % / qty → `fmtPercent` / `fmtNumber`.
- `src/app/(organizer)/organizer/rfqs/[id]/quotes/print/page.tsx` — `li.qty` → `fmtNumber`.
- `src/app/(organizer)/organizer/rfqs/[id]/quotes/[quoteId]/page.tsx` — `item.qty` → `fmtNumber`; VAT % param → `fmtNumber`.
- `src/app/(admin)/admin/(monitor)/rfqs/[id]/page.tsx` — `formatHalalas`→`formatMoney`.
- `src/app/(admin)/admin/(monitor)/rfqs/page.tsx` — new `resolveSlugMatches()` helper + bilingual-aware search.
- `src/app/(supplier)/supplier/rfqs/[id]/quote/QuoteBuilderForm.tsx` — removed dead I-25 banner + unused `Alert` import.
- `scripts/i18n-merge-keys.cjs` — added `organizer.rfqs.status.pending` to both locales.
- `src/messages/en.json` and `src/messages/ar.json` — 1 new key each (`organizer.rfqs.status.pending`).

### New keys this stage
1 key per locale: `organizer.rfqs.status.pending` ("Pending" / "قيد الانتظار"). AR distinct from EN.

### Deferred / notes
- I-21 left `formatHalalas` callers untouched in non-RFQ-surface files (contracts PDF, bookings list/detail for organizer + supplier, public package cards, supplier catalog, dispute detail). These are out of scope for the RFQ remediation plan; flagging for a future locale-aware money sweep if/when those surfaces get Arabic walkthroughs.
- `props.locked` prop on `QuoteBuilderForm` is kept as a defensive `disabled` on the submit button — even though `page.tsx` redirects, removing the prop would weaken the in-form guard against a hypothetical race.
- `as never` casts on `t(\`status.${row.status}\` as never)` callers (organizer rfqs list, admin dashboard, organizer events detail) are unchanged — TS can't narrow the dynamic key without a runtime mapping, and replacing them with `tStatus.has(...)` runtime checks would be code churn for no behavioural change. Master-plan P3 ESLint guardrails (Stage 4) can enforce coverage instead.

---

## Stage 4 (P3 + bugs) — DONE (2026-05-17)

Gate: `pnpm exec tsc --noEmit` clean, `pnpm exec eslint src` clean except the 3 pre-existing `feedback/` `set-state-in-effect` errors (FeedbackRow.tsx:84, FeedbackWidget.tsx:87+118), `pnpm test` 129 passed / 12 skipped. en/ar parity unchanged at 2377 keys per locale; no new keys added this stage (existing namespaces cover the new enum-coverage test).

### I-26 — Zod request-scoped error map (no more concurrent-locale race)

**Root cause.** `z.config({ localeError })` mutates a process-global. The pre-Stage-4 `registerZodLocale(locale)` ran on every request, so two concurrent requests with different locales raced over the same `z.config` object — whichever finished its `.config()` call last won, and the loser emitted validation messages in the wrong language.

**Approach (chosen path).** Install **one** dispatching error map at module load that resolves the active locale per call from a Node `AsyncLocalStorage`. Each request calls `enterRequestLocale(locale)` once during `getRequestConfig`; `AsyncLocalStorage.enterWith` propagates the value to every descendant async operation (RSC render, server action, fetch handler). No per-request mutation of shared state → no race. Zero caller-site changes; every existing `.safeParse(...)` / `.parse(...)` keeps working.

The alternative the task suggested — passing `{ error: factory().localeError }` directly to each `.parse()` call — would have meant rewriting 30+ call sites and is fragile (every new caller has to remember). The dispatcher approach is zero-call-site-cost and impossible to forget.

The module is split for cross-runtime safety:
- `src/lib/zod/i18n.ts` — shared `ZodLocale` type only.
- `src/lib/zod/i18n.server.ts` — `"server-only"` boundary; constructs `AsyncLocalStorage`, installs the global dispatcher, exports `enterRequestLocale`.
- `src/lib/zod/i18n.client.ts` — `registerZodLocaleGlobal`, called from `ZodLocaleBootstrap.tsx` inside a `useEffect`. Browser tabs only have one active locale, so the legacy global-mutation path is kept here (safe — no concurrency).

Wiring updated:
- `src/i18n/request.ts` — replaced `registerZodLocale(locale)` with `enterRequestLocale(locale)` from `@/lib/zod/i18n.server`.
- `src/app/_components/ZodLocaleBootstrap.tsx` — switched to `registerZodLocaleGlobal` from `@/lib/zod/i18n.client`.

### I-27 — Accept-Language best-match negotiation

**Root cause.** `accept.split(",")[0]?.split("-")[0]` only looks at the first token, so `fr,ar;q=0.9` falls back to English even though Arabic is supported and explicitly listed.

**Approach.** Inlined a small negotiator (no new dependency). Lifted into its own module `src/i18n/negotiateAcceptLanguage.ts` so it can be unit-tested without `next/headers`. Parses `lang[;q=0..1]` entries, normalizes `xx-YY` / `xx_YY` to base language, treats `q=0` and malformed q-values as "not acceptable", supports the wildcard `*` (resolves to the caller's preferred default), and breaks q ties on insertion order per RFC 9110 §12.5.4.

New test `src/i18n/__tests__/negotiateAcceptLanguage.test.ts` (11 cases) covers: empty header, missing q, language-region normalization, the original-bug regression (`fr,ar;q=0.9` → `ar`), q-ranking, tie-breaking, q=0, malformed q, no-match, wildcards, whitespace + case tolerance.

### I-28 — ESLint guardrails + enum-coverage test

**ESLint flat config (`eslint.config.mjs`)** now bans the regression patterns at error severity (one entry per rule, with inline rationale):
- `new Intl.DateTimeFormat(...)` and `new Intl.NumberFormat(...)` outside the three allow-listed helpers.
- BCP-47 string literals `"en-SA" | "ar-SA" | "en-GB" | "en-US"` outside the same allow-list.
- Cross-locale fallback `LogicalExpression[operator="||"]` between `name_ar` / `name_en` properties.
- `.replace(/_/g, " ")` inside a JSX expression context.
- `formatHalalas(...)` calls (deprecation fence).

Allow-list (narrow on purpose): `src/lib/domain/formatDate.ts`, `src/lib/domain/money.ts`, `src/lib/notifications/templates/_shared/i18n.ts`, plus the existing `src/lib/domain/**`, `src/lib/supabase/**`, `src/**/__tests__/**`, `src/messages/**`.

Note on severity: ESLint flat config only allows ONE severity per rule per file path, so `formatHalalas` is kept at `error` (not the soft "warn" suggested in the task). Where the call site is genuinely out of RFQ scope, an inline `eslint-disable-next-line no-restricted-syntax -- <reason>` carries the rationale.

**RFQ-surface fixes the rules surfaced** (these were leaks the prior stages missed):
- `src/lib/notifications/templates/supplier/RfqInvited.tsx`, `QuoteAccepted.tsx`, `auth/PasswordChanged.tsx`, `organizer/BookingCreated.tsx`, `BookingConfirmed.tsx`, `QuoteReceived.tsx` — every `new Intl.DateTimeFormat(intlLocaleFor(...))` inside templates rewritten to use two new shared helpers exported from `_shared/i18n.ts`: **`formatEmailDateTime(input, locale, options)`** and **`formatEmailNumber(value, locale, options)`**. The raw `Intl` constructor now exists only in the three allow-listed helper files.
- `src/app/(supplier)/supplier/rfqs/[id]/page.tsx` — `formatHalalas(snapshot.total_halalas)` → `formatMoney(snapshot.total_halalas, locale)`.
- `src/app/(supplier)/supplier/rfqs/[id]/quote/QuoteBuilderForm.tsx` — three `formatHalalas(...)` totals (subtotal, VAT, total) → `formatMoney(..., locale)`. `useLocale()` is now typed `as SupportedLocale` so the helper takes a narrowed locale.

**Out-of-scope hits suppressed with targeted `eslint-disable-next-line`** (each comment carries its rationale, none disable rules wholesale):
- `admin/(monitor)/disputes/[id]/page.tsx` — 1 hit.
- `organizer/bookings/[id]/page.tsx` — 8 hits (line items + totals).
- `organizer/bookings/page.tsx` — 2 hits (list + date formatter).
- `organizer/events/[id]/page.tsx` — 3 hits (two date formatters + budget label).
- `supplier/bookings/[id]/page.tsx` — 8 hits (line items + totals).
- `supplier/bookings/page.tsx` — 2 hits.
- `supplier/catalog/catalog-client.tsx` — 1 hit (price-from in interpolation).
- `components/public/PackageCard.tsx` — 1 hit (public marketing).
- `components/ui-ext/StatusPill.tsx` — 1 hit on the defensive `??` fallback (every RFQ-surface caller passes `label={t(...)}`, so the branch is unreachable in practice; the disable comment documents this).
- `lib/contracts/ContractDocument.tsx` — one file-level wrapper: imported `formatHalalas` is re-exposed under `formatHalalasEn` with a single disable comment, and every call site uses the wrapper. Contracts PDFs are English-only by legal-document policy until the bilingual contract sprint.

**Enum-coverage test** — new file `src/messages/__tests__/rfq-enum-coverage.test.ts` (11 cases):
- Mirrors the TS union types `RfqStatus`, `RfqInviteStatus`, `RfqInviteSource`, `QuoteLineItemKind`, `ConfirmationStatus`, `PaymentStatus`, `ServiceStatus` as `as const satisfies readonly X[]` arrays.
- Compile-time exhaustiveness assertions via `Exclude<Union, (typeof Array)[number]>` — TS rejects the file if a future commit widens any union without updating the value list.
- Asserts that every enum value has a string leaf in BOTH `en.json` and `ar.json` under each namespace it's rendered through (`admin.rfqs.status`, `organizer.rfqs.status`, `organizer.rfqs.inviteStatus`, `supplier.rfqInbox.status`, `organizer.rfqs.source`, `organizer.quote.csv.source`, `lineItemKind`, `bookingStatus.confirmation` / `.payment` / `.service`).
- Separate assertion for the display-only `supplier.rfqInbox.status.applied` (not a DB enum value; derived for the UI via `inviteDisplayStatus`).

All keys were already present from earlier stages; no new translation keys added.

### BUG #1 — `kindFromParentSlug()` mismatch

**Root cause.** The wizard's `kindFromParentSlug` checked parent slugs `venues` / `catering` / `photography`, none of which exist in the seeded taxonomy (`src/lib/domain/taxonomy.ts`). Real slugs are `tents_structures` / `catering_hospitality` / `photo_video` / 9 others. Every subcategory the organizer picked silently collapsed to the `generic` RFQ extension form, hiding the venues / catering / photography specialized fields.

**Fix.** Rewrote the function against the actual taxonomy, with the mapping the task suggested (verified against `RfqExtension` schemas in `src/lib/domain/rfq.ts`):
- `tents_structures` → `venues` (tents / domes / temporary hangars use the seating / indoor-outdoor / parking / kitchen form).
- `catering_hospitality` → `catering` (buffet / kitchens / VIP-services use the meal_type / dietary / service_style form).
- `photo_video` → `photography` (photographers / film / live-streaming use the coverage_hours / deliverables / crew_size form).
- everything else → `generic`.

**Module split.** `kindFromParentSlug` lifted from inline in `src/app/(organizer)/organizer/rfqs/new/page.tsx` to a sibling module `kindFromParentSlug.ts`. Next.js page files forbid named exports beyond a tight allow-list, so the function couldn't both ship inline AND be unit-tested.

**New test.** `src/app/(organizer)/organizer/rfqs/new/__tests__/kindFromParentSlug.test.ts` (6 cases):
- Each specialized slug maps to its expected kind.
- `undefined` / `""` / unknown slugs fall back to `generic`.
- **Every seeded parent slug not in the specialized map returns `generic`** — iterates `TAXONOMY` from `@/lib/domain/taxonomy` so a future taxonomy edit that introduces a new parent immediately surfaces here.
- Sanity check that each specialized slug we claim to handle actually exists in the seeded taxonomy (catches a future rename).

### BUG #2 — Marketplace privacy outside the transaction

**Root cause.** `sendRfqAction` called the `send_rfq_tx` RPC (which always inserted the RFQ with the column default `true`), then issued a SEPARATE `UPDATE public.rfqs SET is_published_to_marketplace = false WHERE id = ...` when the organizer opted out. If that UPDATE failed for any reason after the RPC succeeded (transient network / RLS regression / lock timeout), the RFQ existed in the wrong visibility state with no atomic recovery — published to the public marketplace despite the organizer explicitly opting out.

**Fix (option a — RPC signature widened).** New migration `supabase/migrations/20260517100000_send_rfq_tx_marketplace_flag.sql` adds an optional `p_is_published_to_marketplace boolean default true` argument to `send_rfq_tx`. The RPC now sets the flag atomically on the row insert. Callers that don't pass the argument keep previous behaviour (column default `true`), so the migration is forward- and backward-compatible.

`src/app/(organizer)/organizer/rfqs/actions.ts` updated:
- `send_rfq_tx` RPC call now passes `p_is_published_to_marketplace: parsed.data.publish_to_marketplace`.
- The post-RPC UPDATE block was deleted. The replaced code carries a docblock pointing at the migration and warning that any future post-create mutation must go through a dedicated action that revalidates.

Errcode reservations (P0020-P0025) stay unchanged.

### Files changed (Stage 4 delta)

Created:
- `src/lib/zod/i18n.server.ts` — server-only dispatcher + `enterRequestLocale`.
- `src/lib/zod/i18n.client.ts` — client-only `registerZodLocaleGlobal`.
- `src/i18n/negotiateAcceptLanguage.ts` — standalone negotiator.
- `src/i18n/__tests__/negotiateAcceptLanguage.test.ts` — 11 cases.
- `src/messages/__tests__/rfq-enum-coverage.test.ts` — 11 cases, runtime + compile-time exhaustiveness.
- `src/app/(organizer)/organizer/rfqs/new/kindFromParentSlug.ts` — the fixed helper.
- `src/app/(organizer)/organizer/rfqs/new/__tests__/kindFromParentSlug.test.ts` — 6 cases.
- `supabase/migrations/20260517100000_send_rfq_tx_marketplace_flag.sql` — RPC accepts the marketplace flag.

Modified:
- `src/lib/zod/i18n.ts` — now exports only the `ZodLocale` type.
- `src/app/_components/ZodLocaleBootstrap.tsx` — uses `registerZodLocaleGlobal` from the client module.
- `src/i18n/request.ts` — uses `enterRequestLocale` + `negotiateAcceptLanguage`.
- `eslint.config.mjs` — 5 new fences (Intl.DateTimeFormat, Intl.NumberFormat, BCP-47 literals, cross-locale fallback, `.replace(/_/g," ")` in JSX) + `formatHalalas` deprecation fence; allow-list widened to include `formatDate.ts` and the notification `_shared/i18n.ts`.
- `src/lib/notifications/templates/_shared/i18n.ts` — new `formatEmailDateTime` and `formatEmailNumber` helpers.
- 6 notification templates rewired to the new helpers (`supplier/RfqInvited.tsx`, `supplier/QuoteAccepted.tsx`, `auth/PasswordChanged.tsx`, `organizer/BookingCreated.tsx`, `organizer/BookingConfirmed.tsx`, `organizer/QuoteReceived.tsx`).
- `src/app/(supplier)/supplier/rfqs/[id]/page.tsx` — `formatHalalas` → `formatMoney(_, locale)`.
- `src/app/(supplier)/supplier/rfqs/[id]/quote/QuoteBuilderForm.tsx` — three `formatHalalas` totals → `formatMoney(_, locale)`; `useLocale()` typed `as SupportedLocale`.
- `src/app/(organizer)/organizer/rfqs/new/page.tsx` — switched to imported `kindFromParentSlug` from the new module.
- `src/app/(organizer)/organizer/rfqs/actions.ts` — passes `p_is_published_to_marketplace` into the RPC; deleted the racy post-RPC UPDATE.
- 11 out-of-scope files (admin disputes, organizer + supplier bookings, organizer events, supplier catalog, public PackageCard, StatusPill defensive fallback, ContractDocument) got targeted `eslint-disable-next-line no-restricted-syntax -- <reason>` comments. ContractDocument additionally uses a single-line `formatHalalasEn` wrapper to avoid scattering disables at every call site.

### New keys this stage

None. All new ESLint diagnostics map to existing keys (added in Stages 0-3); the enum-coverage test only asserts presence.

### Deferred / notes

- `formatHalalas` rule kept at `error` severity (not `warn` as suggested in the task spec) — ESLint flat config doesn't permit two severities for the same rule on overlapping file globs. Out-of-scope call sites carry per-line `eslint-disable-next-line` with rationale; contracts PDF uses a one-line wrapper. A future locale-aware money sweep on bookings / catalog / contracts can replace the wrapper + disables with `formatMoney(_, locale)` and remove the deprecation fence in one pass.
- The legacy `registerZodLocale` shim re-exported in `i18n.ts` was removed entirely (not just deprecated) because keeping it as a runtime-detection wrapper would have re-introduced the `node:async_hooks` import into the client bundle. Both callers (server `request.ts` + client `ZodLocaleBootstrap.tsx`) were updated to use the runtime-specific entry points directly.
- The `send_rfq_tx` migration adds a default-`true` argument, so existing automated tests / fixtures that call the RPC without the new parameter keep working unchanged. The supabase types are not regenerated in this repo (no `database.types.ts`), so no client-side typegen needed for the new parameter.
