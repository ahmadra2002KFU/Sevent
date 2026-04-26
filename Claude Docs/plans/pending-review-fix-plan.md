# Pending Review Screen — Fix Plan

**Scope:** Supplier dashboard pending-review experience (`/supplier/dashboard` when `verification_status in ('pending','rejected')`).
**Mode:** Read-only investigation. No code edits made.
**Date:** 2026-04-22

---

## Section 1 — Findings

### 1. Fake green Wathq banner

The green banner `"تحقق تلقائي من واثق: Test Business · نشط · الرياض · 2019"` is rendered by `WathqVerifyBanner` at `src/components/supplier/onboarding/WathqVerifyBanner.tsx`. **It is NOT rendered on the supplier dashboard / pending-review screen.** `Grep` across the codebase shows exactly one caller: `src/app/(onboarding)/supplier/onboarding/wizard.tsx:605-614`, inside Step 1 of the onboarding wizard, guarded by `legalType === "company" && businessName.trim().length > 0`. The props come from:

- `businessName` — user's raw Step-1 text input (real, not fake).
- `city` — `cityNameFor(baseCity, locale)`, derived from user's selected base city (real).
- `activeSinceYear="2019"` — **hardcoded literal in the wizard JSX**.
- `labels.prefix = t("wathq.prefix")` → `"تحقّق تلقائي من واثق:"` (hardcoded string in `ar.json:572`).
- `labels.status = t("wathq.status")` → `"نشط"` (hardcoded string in `ar.json:573`).

Nothing in the wizard or anywhere else in `src/` calls an actual Wathq/Nafath/bank-IBAN API; `Grep` for `fetch.*wathq|verifyWathq|verify_iban` returns only `.tmp-home.html`. The banner therefore **claims** automatic verification but performs zero verification — it's triggered purely by "user typed a name" and "user picked company as legal type". The hardcoded year `2019` and hardcoded `نشط` state are the literal offenders in the user's screenshot.

### 2. The "6-item limit"

`MAX_CATEGORIES = 6` at `src/lib/domain/onboarding.ts:31`. Usage:

- Wizard Step 2 picker — `src/app/(onboarding)/supplier/onboarding/wizard.tsx:864` (`if (selectedIds.length >= MAX_CATEGORIES) return;`), line 896 (`max={MAX_CATEGORIES}`), line 899 (hint copy).
- Zod schema — `src/lib/domain/onboarding.ts:114` (`.max(MAX_CATEGORIES, "Pick at most 6 categories")`).
- Default fallback in `CategoryPillCloud` — `src/components/supplier/onboarding/CategoryPillCloud.tsx:45` (`max = 6`).

**It is on the onboarding wizard's Step 2 category picker — NOT on the pending-review screen.** The pending review checklist (`PendingReviewChecklist.tsx`) does not enforce any six-item limit; its 5-row checklist is hard-coded to exactly five keys in `src/lib/domain/verificationDisplay.ts:20-26` (`wathq / identity / iban / portfolio / badge`). So "6 items" is the category picker cap; this is the right target if the user's complaint is about Step 2 of onboarding.

### 3. Rejected state not reflected in the hero

`PendingReviewChecklist.tsx` accepts `verificationStatus: "pending" | "approved" | "rejected"` but only uses it to compute the per-row checklist states (line 172: `const checks = deriveChecklistStates(verificationStatus);`). The top hero (lines 177–241) is a **hard-coded "under review" blue gradient**:

- Line 182–185: fixed gradient `linear-gradient(135deg, #ffffff 0%, rgb(220 235 251 / 0.55) 100%)`.
- Line 188: fixed `border-brand-cobalt-500` (blue) + spinner animation — always on.
- Line 209: `ShieldCheck` icon — always rendered.
- Line 213: `{t("statusPill")}` → `"حالة الطلب · قيد المراجعة"` — always rendered (no branch on status).
- Line 216: `{t("title")}` → `"استلمنا طلبك"` — always rendered.
- Line 219–223: `{t("sub")}` + `{t("emailNotice", {email})}` — always rendered.

For `verificationStatus === "rejected"`, `deriveChecklistStates` returns 5 × `failed` rows (`src/lib/domain/verificationDisplay.ts:44-46`), so the checklist rows DO change color/icon (red `XCircle`, red trailing `✗`). However the hero stays blue/"قيد المراجعة", and `verification_notes` from the DB is never read or displayed. This exactly matches the P2-10 failure in `Claude Docs/access-control-test-results.md:121-124` ("Main header still displays Under review with blue background, no rejection note visible"). **Root cause: the hero is a single status-agnostic layout with no `if (verificationStatus === "rejected") { ... }` branch, and the page at `src/app/(supplier)/supplier/dashboard/page.tsx:290-306` does not pass `verification_notes` to the component.**

### 4. `descDone` i18n key

**Root cause: missing ICU argument, not a missing translation key.** The keys `supplier.pending.checks.wathq.descDone` etc. are defined in both `ar.json:1106` and `en.json:1106`. However the Arabic/English `descDone` for `wathq` contains the ICU placeholder `{city}`:

- `ar.json:1106` → `"مُطابق في قاعدة بيانات واثق · {city} · نشط"`.
- `en.json:1106` → `"Verified in Wathq database · {city} · active"`.

The renderer at `PendingReviewChecklist.tsx:280` calls:

```tsx
{t(`checks.${c.key as CheckKey}.desc${variant}`)}
```

**No second argument is ever passed**, so next-intl encounters an unresolved `{city}` placeholder. In default `onError` configurations next-intl throws `MISSING_FORMAT` and falls back to rendering the full key path (`supplier.pending.checks.wathq.descDone`). That's the untranslated-key appearance the user reported. This is exclusive to the `wathq` check because it's the only one that uses a placeholder. The variant naming (`Done`/`Running`/`Waiting` via `descVariantForState` at lines 42–55) is internally consistent and matches the i18n keys (`descDone`/`descRunning`/`descWaiting`); there is no `Done`/`DescDone` mismatch.

### 5. "Post-approval" card alignment

The right column (`PendingReviewChecklist.tsx:297-378`) contains the timeline card titled `{t("timelineTitle")}` → `"ما بعد الاعتماد"` (`ar.json:1138`) plus the navy side card. All the positioning classes **already use logical properties**: `ps-4` (line 308), `start-[6px]` (line 309), `-start-3` (line 314), `end-[-30px]` (line 340). The root `<html dir="rtl">` is set in `src/app/layout.tsx:72`. Tailwind is v4 (`package.json`), where `ps-*` / `start-*` / `end-*` are first-class utilities.

**I could not find a hard-coded `text-left` / `text-right` / `pl-*` / `pr-*` / `left-*` / `right-*` on this card.** What I can identify as a candidate root cause without a live screenshot:

- The outer two-column grid at line 244 is `lg:grid-cols-[1.3fr_1fr]`. CSS Grid does NOT auto-reverse columns under `dir="rtl"` — the FIRST grid column (the checklist, 1.3fr) renders on the RIGHT, and the SECOND grid column (timeline + navy) renders on the LEFT. Depending on which column the user considers "the post-approval column", the visual position may be opposite to their mental model. If the user expected the narrower column to sit on the LEFT of the screen (they perceive "right-side" as the leading side in RTL reading order), today it DOES sit on the LEFT, which matches the complaint "left-floated" — but this is the correct logical order, not a bug.
- Alternatively: nothing on the card forces `text-start`; default browser text-alignment under `dir="rtl"` body is right, which should be fine. But if a parent has `text-left` inherited from a CSS utility, children text could align left. I did not find such a parent utility in the dashboard section or layout.

**Verdict:** I cannot pinpoint a concrete misalignment bug in the card code itself. Either (a) the user wants the grid column order swapped so the narrower column sits on the right in RTL, or (b) there's a visual alignment issue I can't diagnose without inspecting the rendered DOM via Playwright. I am explicitly flagging this as unresolved rather than guessing.

### 6. Real verification vs. fake "done" states

Schema check on `supabase/migrations/20260420000100_marketplace_schema.sql`:

- Line 16: `supplier_verification_status` enum = `pending | approved | rejected`.
- Lines 99–102, the `suppliers` table has: `verification_status`, `verification_notes text`, `verified_at timestamptz`, `verified_by uuid`.
- **There are no `wathq_verified_at`, `identity_verified_at` / `nafath_verified_at`, `iban_verified_at` per-check columns.**
- No later migration adds them (`Grep` for `wathq|nafath|identity_verified|iban_verified` across `supabase/migrations/` returns no matches; the only hit in `20260422000000_supplier_onboarding_redesign.sql:7` is an unrelated comment).

`deriveChecklistStates` at `src/lib/domain/verificationDisplay.ts:38-55` makes this explicit in its comments: it's a **"cosmetic mapping"** (lines 1–9) that fabricates a 2-done / 1-running / 2-waiting display for `pending` (lines 48–54) and marks all-done for `approved`. There is no API integration with Wathq, Absher/Nafath, or any bank IBAN verification service anywhere in `src/` (confirmed via `Grep`).

**Available signals from the DB today:** only `verification_status`, `verification_notes`, `verified_at`, `verified_by`, plus `supplier_docs.status` per uploaded document (from the schema enum `supplier_doc_status: pending | approved | rejected` at line 18) and `supplier_docs.doc_type` (line 17: `cr | vat | id | gea_permit | certification | other`). Those document rows could back a real "CR uploaded / ID uploaded / IBAN certificate uploaded" per-check state, but not an external "verified with Wathq" state.

**Practical options:**
- **(a) Redirect-to-real-service:** no backing API client exists — a `Start Wathq verification` button would have to ship a new integration (out of scope for a UI-only fix).
- **(b) Drop the fake "done" states:** replace the 2/1/2 aspirational progression with either (i) a single honest "under review" card, or (ii) a checklist driven off real `supplier_docs.status` per `doc_type` (e.g. "CR document uploaded ✓", "IBAN certificate uploaded ✓", "Portfolio uploaded — waiting for review"). Path (b)(ii) is compatible with today's schema without migrations.

---

## Section 2 — Proposed fixes

Ordered by user-visible impact; each entry names the file(s) and the nature of the change (no code written).

1. **Remove the fake Wathq "auto-verified" banner from onboarding Step 1.**
   - File: `src/app/(onboarding)/supplier/onboarding/wizard.tsx:604-614` — delete the `<WathqVerifyBanner …>` block (and prune the now-dead `activeSinceYear="2019"` literal + the unused `t("wathq.prefix")` / `t("wathq.status")` translations).
   - File: `src/components/supplier/onboarding/WathqVerifyBanner.tsx` — delete this file; nothing else imports it.
   - File: `src/messages/ar.json:571-574` and `src/messages/en.json` (corresponding `wathq` block) — remove the `wathq.prefix` / `wathq.status` keys.
   - Rationale: the banner asserts a verification that never runs. Removing it is the least-risky fix; re-introduce only once a real Wathq integration exists.

2. **Fix the rejected-state hero in `PendingReviewChecklist`.**
   - File: `src/components/supplier/onboarding/PendingReviewChecklist.tsx` — the top `<motion.section>` (lines 177–241) should branch on `verificationStatus === "rejected"`:
     - Swap gradient + border + icon to the danger palette (`border-semantic-danger-500` / red gradient / `XCircle` instead of `ShieldCheck`).
     - Swap `statusPill`, `title`, `sub` to a new rejected-state copy set (new keys under `supplier.pending.rejected.*` or a parallel `supplier.rejected.*` namespace).
     - Drop the spinning ring (or replace with a static red ring).
     - Render `verification_notes` when the admin left one.
   - File: `src/app/(supplier)/supplier/dashboard/page.tsx:290-306` — pass `verificationNotes={supplierSummary.verification_notes}` to the component (requires adding `verification_notes` to the `.select(...)` on line 229 and to the `SupplierSummaryRow` type at lines 60–67).
   - File: `src/messages/ar.json` + `src/messages/en.json` — add rejected-state strings (`statusPill`, `title`, `sub`, `notesHeading`, rejected-mode CTA copy).

3. **Fix the `descDone` untranslated-key bug.**
   - File: `src/components/supplier/onboarding/PendingReviewChecklist.tsx:280` — pass the city argument when formatting `wathq.descDone`. Since the component receives only `email` today and not the supplier's city, this fix depends on Proposal #6 below. Cheapest interim fix: remove the `{city}` placeholder from `ar.json:1106` + `en.json:1106` and simplify the copy (e.g. `"مُطابق في قاعدة بيانات واثق · نشط"`). Long-term fix: widen `PendingReviewChecklistProps` to accept `baseCityLabel` and thread it through from the page's existing supplier row.

4. **Post-approval card alignment — requires clarification.**
   - File (if a swap is wanted): `src/components/supplier/onboarding/PendingReviewChecklist.tsx:244` — change `lg:grid-cols-[1.3fr_1fr]` ordering, or wrap the right-column in a `lg:order-*` utility so the narrower card sits where the user expects.
   - I recommend pairing this with live inspection (Playwright `mcp__claude-in-chrome`) before editing — see Section 3, Q3.

5. **Drop or ground the "fake done" checklist.** Two paths; the user should pick one:
   - **Path A — minimal honesty:** delete the checklist card entirely and replace with a single "تحت المراجعة · عادةً خلال ٢٤ ساعة" card. Remove `deriveChecklistStates` + the 5 per-check i18n blocks.
     - Files: `src/components/supplier/onboarding/PendingReviewChecklist.tsx`, `src/lib/domain/verificationDisplay.ts`, `src/lib/domain/__tests__/verificationDisplay.test.ts`, `src/messages/ar.json` (keys `supplier.pending.checks.*`, `stateDone/Running/Waiting`), `src/messages/en.json` (same keys).
   - **Path B — real state from `supplier_docs`:** rewrite `deriveChecklistStates` to accept a `docs: Array<{doc_type, status}>` plus `verification_status`, and return rows only for checks we actually have a signal for:
     - CR document (`doc_type='cr'`) → `done` if any CR row with `status='approved'`, `running` if `status='pending'`, else `waiting`.
     - ID document (`doc_type='id'`) → same pattern.
     - IBAN certificate (`doc_type='iban_certificate'`) — **note:** this `doc_type` is declared in `src/lib/domain/onboarding.ts:33-42` but NOT in the DB enum at migration line 17 (`'cr', 'vat', 'id', 'gea_permit', 'certification', 'other'`). A migration would be needed to add `iban_certificate` + `company_profile` to `public.supplier_doc_type`, or the UI should stop pretending those are tracked.
     - Portfolio / badge — drop (no DB signal).
     - Files: `src/lib/domain/verificationDisplay.ts` (signature change), `src/lib/domain/__tests__/verificationDisplay.test.ts` (rewrite), `src/components/supplier/onboarding/PendingReviewChecklist.tsx` (new prop), `src/app/(supplier)/supplier/dashboard/page.tsx` (fetch `supplier_docs` and pass through — a docs query already exists at lines 346-348 for a different purpose, can be reused).

6. **If keeping the checklist (Path B above), kill the `{city}` placeholder cleanly.**
   - Either add `{city}` handling (Fix #3 long-term) or drop it from the `wathq.descDone` copy when Path A is chosen (no placeholder substitution needed).

7. **`MAX_CATEGORIES = 6` — investigate but defer.** This lives in the **onboarding wizard Step 2**, not on the pending-review screen. If the user's "limited to 6 items, unnecessary here" complaint is genuinely aimed at the category picker:
   - File: `src/lib/domain/onboarding.ts:31` — raise or remove the cap; simultaneously relax `OnboardingStep2.subcategory_ids.max(MAX_CATEGORIES)` on line 114.
   - File: `src/app/(onboarding)/supplier/onboarding/wizard.tsx:864, 896, 899` — propagate the new cap / remove it.
   - File: `src/components/supplier/onboarding/CategoryPillCloud.tsx:30, 45, 78` — default `max` prop and `full` guard.
   - Product decision: is the cap for RFQ-match quality (too many = noisy matches) or purely a UI-fit constraint? Needs user's call before editing.

---

## Section 3 — Open questions for user

1. **Checklist strategy (Section 2, Fix #5):** Path A (drop the checklist entirely, show a single "under review" card) or Path B (drive checklist rows from real `supplier_docs` rows)? Path B is more work and still exposes gaps because we have no Wathq/Nafath integration.

2. **Scope of "6-item limit" complaint:** The limit exists only on the onboarding wizard's category picker (Step 2), not on the pending-review page. Is the user complaining about the wizard, or about some other "6 items" element I'm not seeing in the screenshot? Please confirm.

3. **Post-approval card visual misalignment:** I could not identify a concrete alignment bug in the code — all logical properties (`ps-*`, `start-*`, `end-*`) are used correctly and the root layout sets `dir="rtl"`. Do you want:
   - (a) The two grid columns swapped so the narrow "timeline + navy" column sits on the right (leading-edge) in RTL instead of the left?
   - (b) A live Playwright inspection to diagnose what's actually mis-rendering?

4. **Rejected-state copy:** Proposed keys include `statusPill`, `title`, `sub`, `notesHeading`. Can you provide preferred Arabic + English copy (e.g. should the title be "طلبك يحتاج إلى تعديل" / "نعتذر، لم نتمكن من اعتماد طلبك"), or should we draft it?

5. **`iban_certificate` / `company_profile` doc types:** They're declared in the Zod enum `src/lib/domain/onboarding.ts:33-42` but **not** in the DB enum `public.supplier_doc_type` (`supabase/migrations/20260420000100_marketplace_schema.sql:17`). Insert attempts with those values would fail RLS/enum validation. Is this a known bug? Needs a migration before Path B can honestly report IBAN status.

6. **Wathq banner removal (Section 2, Fix #1):** Agreed to delete the entire banner + its component + i18n keys? Alternative: keep the banner but only show the fields we genuinely know (`businessName · city`), drop the hardcoded `نشط` and `2019`, and rename the prefix from "تحقّق تلقائي من واثق:" to something non-asserting (e.g. "ملفك الحالي:").

---

## Section 4 — Estimated touch surface

Files likely to be modified once the open questions are answered:

| # | File | Fix(es) |
|---|------|---------|
| 1 | `src/app/(onboarding)/supplier/onboarding/wizard.tsx` | Remove Wathq banner block (Fix #1) |
| 2 | `src/components/supplier/onboarding/WathqVerifyBanner.tsx` | Delete file (Fix #1) |
| 3 | `src/components/supplier/onboarding/PendingReviewChecklist.tsx` | Rejected hero branch (Fix #2), `{city}` arg (Fix #3), optional grid order swap (Fix #4), checklist rewrite (Fix #5) |
| 4 | `src/app/(supplier)/supplier/dashboard/page.tsx` | Select + pass `verification_notes` (Fix #2); optionally pass docs for Path B (Fix #5) |
| 5 | `src/lib/domain/verificationDisplay.ts` | Delete or rewrite (Fix #5) |
| 6 | `src/lib/domain/__tests__/verificationDisplay.test.ts` | Update or delete (Fix #5) |
| 7 | `src/messages/ar.json` | Remove `wathq.*`, add `rejected.*` strings, strip `{city}` placeholder (Fixes #1, #2, #3) |
| 8 | `src/messages/en.json` | Same as above |
| 9 | `src/lib/domain/onboarding.ts` | Only if user wants the 6-category cap removed (Fix #7) |
| 10 | `src/components/supplier/onboarding/CategoryPillCloud.tsx` | Only if Fix #7 approved |
| 11 | `supabase/migrations/<new>.sql` | Only if Path B + `iban_certificate`/`company_profile` doc types need to be added to the DB enum (Section 3, Q5) |

**Scope estimate by fix:**
- Fix #1 (Wathq banner removal): ~3 files, small.
- Fix #2 (rejected-state hero): ~3 files, medium (new copy + conditional render).
- Fix #3 (descDone placeholder): 1 file (trivial) if combined with Fix #5 Path A; otherwise 3 files.
- Fix #4 (alignment): 1 file, blocked on clarification.
- Fix #5 Path A: ~5 files, medium (removes more than adds).
- Fix #5 Path B: ~6 files + 1 migration, larger.
- Fix #7 (`MAX_CATEGORIES`): ~3 files, blocked on product decision.

---

**Report file:** `D:/Mufeed/Sevent/Code/Claude Docs/plans/pending-review-fix-plan.md`
