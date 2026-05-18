> **Document status (2026-05-17):** Historical reference. Superseded by the RFQ master remediation plan; most i18n leakage findings were fixed, while remaining notes are design debt.

# RFQ Authoring Analysis: Architecture & Language Leakage Audit

**Date**: 2026-05-14  
**Scope**: RFQ creation and editing path (organizer wizard, list, detail views)  
**Model**: gpt-5.4  
**Status**: Analysis complete, no source files modified

---

## Executive Summary

This Sevent codebase has a well-structured extension-form architecture for RFQ category-specific requirements, but suffers from **systematic language leakage** in three areas:

1. **Server actions return English-only error messages** — instead of stable error codes
2. **Requirements and auto-match reasons are rendered raw** — bypassing translation entirely
3. **Shared locale helpers (formatDate, cityNameFor) are duplicated or ignored** — creating inconsistency

Additionally, the category-slug-to-extension-kind mapping is **loosely coupled** and inconsistent with the seeded taxonomy.

---

## Architecture & Design Analysis

### Data Model

The RFQ system centers on two aggregates:

- **`rfqs`**: Root entity with `event_id`, `category_id`, `subcategory_id`, `requirements_jsonb` (typed in app code), `status`, `sent_at`, marketplace visibility flags.
- **`rfq_invites`**: Fan-out child (one per supplier contacted), with `supplier_id`, `source`, `status`, `sent_at`, `response_due_at`, `decline_reason_code`.

Organizer list/detail views join these with `events` and parent/subcategory `categories` for display.

### Form / Extension Architecture

**Good design**:

- `src/lib/domain/rfq.ts` is the single schema source of truth for all extension payloads:
  - `VenuesExtension`, `CateringExtension`, `PhotographyExtension`, `GenericExtension`
  - Discriminated union `RfqExtension`
  - Top-level `RfqFormInput`
  
- `src/components/rfq/extensions/index.tsx` is the dispatcher:
  - Chooses subform by `kind` (as derived from parent category slug)
  - Protects against mismatched `value.kind` with early validation
  - Provides parse-safe defaults with `defaultExtensionFor()`

- All extension subforms are controlled components, keeping mutation centralized in the wizard reducer.

### Server Action Flow

**New RFQ creation** (`new/page.tsx` + `actions.ts`):

1. **Mount**: Fetch organizer's events and taxonomy categories
2. **Step 1**: Pick event → category → subcategory → derive `kind` from parent slug
3. **Step 2**: Render locale-aware requirements form via `RfqExtensionForm` dispatcher
4. **Step 3**: Preview auto-matches + supplier search and shortlist picking
5. **Step 4**: Final review (dumps requirements as raw schema keys/values) → `sendRfqAction()`

### Language Leakage Findings

**P0 (Critical - Blocks Arabic UX)**:

1. **Auto-match reasons (all English)**
   - File: `src/components/rfq/ShortlistEditor.tsx:201-207` + `src/lib/domain/matching/reasons.ts:15-24`
   - Fix: Translate reason badges via domain object with key + params

2. **Server error messages (all English)**
   - Files: `src/app/(organizer)/organizer/rfqs/actions.ts:300-366`
   - Fix: Return error codes instead of strings; map to translations in UI

3. **Step 4 error display**
   - File: `src/app/(organizer)/organizer/rfqs/new/page.tsx:1117-1121`
   - Fix: Map error codes to translated messages instead of rendering raw strings

**P1 (High - Field-level leaks)**:

4. **Hardcoded date formatting**: `src/app/(organizer)/organizer/rfqs/new/page.tsx:68-74`
   - Fix: Use `fmtDate()` from shared `src/lib/domain/formatDate.ts`

5. **Local category name helper**: `src/app/(organizer)/organizer/rfqs/new/page.tsx:80-87`
   - Fix: Import and use shared `categoryName()` from `src/lib/domain/taxonomy.ts`

6. **Enum kind in translation string**: `src/app/(organizer)/organizer/rfqs/new/page.tsx:993`
   - Fix: Translate kind first, then embed: `t(\`rfq.kind.\${kind}\`)`

7. **Requirements dump (raw field names + enum values)**:
   - Files: `src/app/(organizer)/organizer/rfqs/new/page.tsx:995-1007` + `src/app/(organizer)/organizer/rfqs/[id]/page.tsx:101-139`
   - Fix: Create shared `PresentRfqRequirements` component that translates field labels and option values

8. **Boolean display ("Yes"/"No")**: `src/app/(organizer)/organizer/rfqs/[id]/page.tsx:114-116`
   - Fix: Use `t("yes")`/`t("no")`

9. **Raw city slugs**: `src/components/rfq/ShortlistEditor.tsx:296,343`
   - Fix: Use `cityNameFor(slug, locale)` (helper already exists)

10. **Decline reason codes**: `src/app/(organizer)/organizer/rfqs/[id]/page.tsx:329`
    - Fix: Map to `t(\`rfq.declineReason.\${code}\`)`

11. **Unknown invite source fallback**: `src/app/(organizer)/organizer/rfqs/[id]/page.tsx:307-311`
    - Fix: Add fallback translation instead of rendering raw slug

12. **English title fallback**: `src/app/(organizer)/organizer/rfqs/[id]/page.tsx:200`
    - Fix: Use `t("rfq.titleDefault")` instead of hardcoded "RFQ"

13. **ARIA label**: `src/app/(organizer)/organizer/rfqs/page.tsx:244`
    - Fix: Use `aria-label={t("pagination.ariaLabel")}`

**P2 (Medium - Dead translation keys)**:

14. **RFQ status incomplete coverage**: pages 229-231, 228-230
    - Analysis: Messages define 6 status keys but DB can return 10+
    - Fix: Either narrow statuses or add all keys to messages

15. **Invite status untyped + incomplete**: `src/app/(organizer)/organizer/rfqs/[id]/page.tsx:314-316`
    - Fix: Type as union; add fallback `inviteStatus.unknown`

---

## Design Issues

### 1. CRITICAL: Category Slug → Extension Kind Mismatch
- **Problem**: `kindFromParentSlug()` assumes slugs are `venues`, `catering`, `photography`
- **Reality**: Seeded taxonomy uses `sound_lighting`, `photo_video`, `catering_hospitality`
- **Impact**: Real categories collapse to `generic` form
- **Fix**: Move kind mapping into domain (add `extension_kind` column or create domain lookup)

### 2. Dead State: `overrideKind` / `kindOverridden`
- No UI path dispatches these; remove or add override UI

### 3. Extension Validation Props Unused
- Components accept `errors` param; wizard never supplies it
- Fix: Parse requirements client-side or remove param

### 4. Requirements Rendering Duplicated
- Both `new/page.tsx:947-1011` and `[id]/page.tsx:101-139` introspect requirements
- Fix: Create shared `PresentRfqRequirements` component

### 5. Shortlist Size Mismatch
- Zod enforces max 10; RPC error says max 20
- Fix: Align both to same limit

### 6. Marketplace Privacy Outside Transaction
- RFQ can be created but fail to become private
- Fix: Include visibility in RPC transaction

### 7. Silent Degradation
- Preview and search actions return empty on error instead of error feedback
- Fix: Add explicit error messages

---

## Execution Roadmap

1. P0 fixes (error codes) — unblocks all Arabic error messaging
2. P1-7 (shared requirements presenter) — core i18n layer
3. Remaining P1 (field-level fixes)
4. P2 (incomplete translation keys)
5. Design refactors (category mapping, transactions)

All fixes are non-breaking; translations first, architecture refactor second.

---

**Generated by opencode plan-agent on 2026-05-14**
