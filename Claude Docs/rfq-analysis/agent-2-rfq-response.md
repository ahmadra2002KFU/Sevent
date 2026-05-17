# RFQ Response Path Analysis & Language Leakage Audit

**Report Date:** 2026-05-14
**Scope:** Supplier RFQ response flow (quote builder, proposal upload, decline, opportunities)
**Status:** Analysis only — no source files modified

---

## Executive Summary

**Language Leakage:** 15 critical instances found across hardcoded English copy, raw enum slugs, and English-only error messages.

**Architecture Issues:** Quote builder supports rule-engine but ships free-form only (dead branches). Requirement rendering duplicated and inconsistent. Decline flow lacks localized action-state UX.

---

## Part 1: Language Leakage Audit

### CRITICAL (user-facing)

**1. Quote Validation Errors — English Only**
File: src/app/(supplier)/supplier/rfqs/[id]/quote/QuoteBuilderForm.tsx:57
Why: Hardcoded English Zod validation message.
Fix: Move to supplier.quote.errors.positiveAmountRequired translation key.

**2. Proposal Upload Server Errors — English Only**
File: src/app/(supplier)/supplier/rfqs/[id]/proposal-upload/actions.ts:50, 57, 65-75, 91, 105, 124, 148, 173, 179
Why: All errors hardcoded English; rendered directly in ProposalUploadForm.
Fix: Return error codes; localize in form. Add translation keys.

**3. Quote Builder Server Errors — English Only**
File: src/app/(supplier)/supplier/rfqs/[id]/quote/actions.ts:209-212, 222-230, 251, 268-305, 317, 334, 358, 377, 507, 712-724, 750
Why: All errors hardcoded English; some expose raw error.message.
Fix: Return error codes instead of prose. Never expose backend error.message.

**4. Requirement Values — Raw Slugs**
File: src/app/(supplier)/supplier/rfqs/[id]/page.tsx:141-172
Why: Label translated but value is raw enum slug (buffet, plated, halal).
Fix: Translate values using t(requirementValues.mealType.).

**5. Opportunity Detail — Raw JSON Dumps**
File: src/app/(supplier)/supplier/opportunities/[id]/page.tsx:181-205
Why: Both requirement keys and values render raw from requirements_jsonb.
Fix: Create shared RequirementDisplay component.

**6. Hardcoded English Fallback — Category Name**
Files: src/app/(supplier)/supplier/rfqs/page.tsx:204-208, 314, 421
       src/app/(supplier)/supplier/rfqs/[id]/quote/page.tsx:285-291
Code: category_label: categoryName(...) || "RFQ"
Why: English fallback shows in Arabic UI.
Fix: Add key supplier.rfqInbox.fallbackCategoryLabel with Arabic translation.

**7. Hardcoded English Error — Quote Data Corrupt**
File: src/app/(supplier)/supplier/rfqs/[id]/page.tsx:423-425
Why: Hardcoded English JSX.
Fix: Move to supplier.rfqInbox.quoteCorruptMessage key.

**8. Quote Status — Raw Enum Slug**
File: src/app/(supplier)/supplier/rfqs/[id]/page.tsx:476
Why: quote.status is raw slug, not human-readable.

Fix: Translate first before interpolating.

**9. Accessibility Label — Remove Line Item**
File: src/app/(supplier)/supplier/rfqs/[id]/quote/QuoteBuilderForm.tsx:406
Why: Hardcoded English aria-label.
Fix: Move to supplier.quote.removeLineItemAriaLabel key.

**10. Accessibility Label — Pagination**
File: src/app/(supplier)/supplier/rfqs/page.tsx:366
Why: Hardcoded English aria-label.
Fix: Move to pagination.ariaLabel key.

**11. Relative Time — date-fns Locale Not Configured**
File: src/app/(supplier)/supplier/rfqs/page.tsx:75-77
Why: date-fns defaults to English. Arabic UI shows English relative time.
Fix: Pass locale parameter to formatDistanceToNowStrict().

### HIGH (backend/notifications)

**12. Decline Action Errors — English Throws**
File: src/app/(supplier)/supplier/rfqs/actions.ts:22, 30, 51
Why: English prose errors. Organizer notification unlocalized.
Fix: Return error codes; localize organizer notification by recipient locale.

**13. Organizer Notification — English Fallback & Unlocalized**
File: src/app/(supplier)/supplier/rfqs/actions.ts:73, 87
Why: English fallback; notification not localized for organizer locale.
Fix: Fetch organizer locale; localize entire notification.

**14. Event Type in Email — Raw Slug + English Fallback**
File: src/app/(supplier)/supplier/rfqs/[id]/quote/actions.ts:621
Why: Raw slug in email; English fallback; recipient locale not used.
Fix: Get organizer locale; translate event type using their locale.

### MEDIUM (dead/stale)

**15. Quote Source Interpolation — Dead Branch**
File: src/app/(supplier)/supplier/rfqs/[id]/quote/QuoteBuilderForm.tsx:271-275
Why: If live, interpolates raw slugs into user copy.
Fix: If dead, remove. If live, translate slug first.

---

## Part 2: Architecture & Design Analysis

### 4 Key Architecture Issues

**1. Quote Builder Architecture Ahead of UI**
   - Loader precomputes rule-engine snapshots using composePrice()
   - Form always submits source: free_form
   - Dead branches for rule-engine and mixed modes
   - Recommendation: Remove rule-engine from quote builder or build UI to enable it

**2. Requirement Display Duplicated & Inconsistent**
   - RFQ detail parses and translates labels + values
   - Opportunity detail dumps raw Object.entries() with unformatted output
   - Recommendation: Extract shared RequirementDisplay component

**3. Decline Flow Lacks Localized Action-State**
   - Quote/proposal use ActionBanner + action-state pattern
   - Decline throws errors with no rendered UX
   - Organizer notification text is English-only
   - Recommendation: Convert decline to action-state; localize organizer notifications

**4. Read Models Leak Raw JSON**
   - requirements_jsonb, quote_snapshot rendered directly to UI
   - Enum slugs, field names exposed without translation
   - Recommendation: Parse on server; render through typed locale-aware accessors

---

## Helper Verification

All 4 helpers exist and are mostly correct:
- segmentNameFor() — src/lib/domain/segments.ts ✅
- cityNameFor() — src/lib/domain/cities.ts ✅
- categoryName() — src/lib/domain/taxonomy.ts ✅ (fallback is hardcoded English)
- formatDate.ts — src/lib/domain/formatDate.ts ✅ (not always used for relative time)

No .name_en / .name_ar misuse found in the audited routes.

---

## Translation Keys Missing

- supplier.quote.errors.* (validation messages)
- supplier.proposalUpload.errors.* (upload errors)
- requirementValues.* (enum value labels)
- quoteStatus.* (status labels)
- eventTypes.* (event type labels)

---

## Execution Priority (3-4 hours total)

1. Relative time (15 min) — pass locale to date-fns
2. Hardcoded fallbacks (15 min) — replace || "RFQ" with translation keys
3. Accessibility labels (10 min) — move aria-label to translations
4. Quote validation (30 min) — add error translation keys
5. Requirement values (45 min) — add keys + use in both RFQ and opportunity detail
6. Server error codes (45 min) — return codes instead of prose
7. Decline + notifications (60 min) — action-state pattern + organizer locale
8. Event type email (30 min) — use organizer locale for event slug

---

Report generated by opencode gpt-5.4 | Analysis only — no files modified
