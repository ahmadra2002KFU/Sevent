> **Document status (2026-05-17):** Historical reference. This pre-remediation audit was consolidated into the master plan and is no longer the active tracker.

# RFQ + i18n Infrastructure Language Leakage Audit

**Date:** 2026-05-14  
**Status:** Read-only analysis complete  

## Summary

Found **30 language leakage issues** across RFQ/admin surfaces and i18n infrastructure:

- **P0 Critical (4):** CSV entirely English, quote detail 20+ hardcoded strings, city slugs unlocalized
- **P1 High (13):** Server actions, notification templates, admin enums, cross-locale fallbacks
- **P2 Medium (9):** Money/number formatting, Accept-Language parsing, Zod race condition
- **P3 Low (4):** Type definitions, Intl locale tags

## Issues by Priority

### P0 Critical (4 issues)

- **Issue 1:** CSV Export — All Headers & Enum Labels (export.csv/route.ts:106-246)
- **Issue 2:** CSV Export — City Slug & Verified Badge (export.csv/route.ts:114-118)
- **Issue 3:** Quote Detail — 20+ Hardcoded English Strings ([quoteId]/page.tsx:164-519)
- **Issue 4:** Print Page — City Slugs (print/page.tsx:68-93)

### P1 High (13 issues)

- **Issue 5:** Print — Invite Source Labels (print/page.tsx:21-31)
- **Issue 6:** Print — Conflict Warning (print/page.tsx:109)
- **Issue 7:** Quote Detail — Status Enum ([quoteId]/page.tsx:274)
- **Issue 8:** Quote Detail — Line Item Kind ([quoteId]/page.tsx:403)
- **Issue 9:** Quote Detail — City + Revision Label ([quoteId]/page.tsx:269-270)
- **Issue 10:** Server Actions — English UI Copy (actions.ts:87-764)
- **Issue 11:** Server Actions — Event Type Fallback (actions.ts:213,575,640)
- **Issue 12:** Comparison Grid — City Slug (QuoteComparisonGrid.tsx:356-358)
- **Issue 13:** Admin Detail — Booking Status Enums ([id]/page.tsx:653-667)
- **Issue 14:** Admin Detail — Requirement Values ([id]/page.tsx:733-759)
- **Issue 15:** Notification — Event Type Fallback (RfqInvited.tsx,etc:varies)
- **Issue 16:** Notification — Cross-Locale Fallback (RfqInvited.tsx:50-53)
- **Issue 17:** Notification — Hardcoded Intl Locales (Templates:multiple)

### P2 Medium (9 issues)

- **Issue 18:** Money Formatting — Locale Unaware (Multiple:formatHalalas)
- **Issue 19:** Number/Percentage Formatting (Multiple:lines)
- **Issue 20:** Admin Filter — Missing pending (RfqFilters.tsx:14-22)
- **Issue 21:** Admin Status Key — Missing pending (admin/rfqs:352-358)
- **Issue 22:** Admin Pagination Label (page.tsx:423-425)
- **Issue 23:** CSV Truncation Suffix (export.csv:20-24)
- **Issue 24:** CSV Error Response (export.csv:97)
- **Issue 25:** Notification — Single-Language Props (Templates:11,13)
- **Issue 26:** Admin Search — Not Locale-Aware (admin/rfqs:165-177)

### P3 Low (4 issues)

- **Issue 27:** Accept-Language — Shallow Parsing (request.ts:18-21)
- **Issue 28:** Zod — Global Race Condition (i18n.ts:26-33)
- **Issue 29:** Locale Types — Scattered (Multiple:inline)
- **Issue 30:** Intl Tags — Inconsistent (Templates:multiple)

## Key Findings

### Architecture Issues
- Quote comparison/print/export lack unified localization layer
- Detail page (`[quoteId]/page.tsx`) is isolated, reintroduces English
- Server actions own UI copy and notification payloads
- Admin RFQ monitor missing status/requirement translations
- Zod global locale causes race conditions under concurrent requests

### Message Files
- **Parity:** 100% — en.json and ar.json have identical key structures (both 3017 lines)
- **Missing keys:** 
  - `admin.rfqs.status.pending`
  - `admin.rfqs.filter.pending`

### Critical Gaps
1. CSV export: zero locale support, all hardcoded English
2. Quote detail page: 20+ hardcoded English strings
3. Print page: city slugs rendered raw, invite source labels hardcoded
4. Server actions: return English UI copy directly
5. Notification templates: cross-locale fallbacks, single-language props
6. Admin page: booking status and requirement values untranslated
7. Infrastructure: Zod race condition, shallow Accept-Language parsing

## Recommendations

1. **Immediate (P0):** Localize CSV, quote detail, print page
2. **High (P1):** Fix server actions, notification templates, admin enums
3. **Medium (P2):** Add locale-aware money/number formatting, fix Accept-Language
4. **Low (P3):** Centralize types, add ESLint guardrails, create tests

## Files Referenced

- `src/app/(organizer)/organizer/rfqs/[id]/quotes/export.csv/route.ts`
- `src/app/(organizer)/organizer/rfqs/[id]/quotes/[quoteId]/page.tsx`
- `src/app/(organizer)/organizer/rfqs/[id]/quotes/print/page.tsx`
- `src/app/(organizer)/organizer/rfqs/[id]/quotes/QuoteComparisonGrid.tsx`
- `src/app/(organizer)/organizer/rfqs/[id]/quotes/actions.ts`
- `src/app/(admin)/admin/(monitor)/rfqs/[id]/page.tsx`
- `src/app/(admin)/admin/(monitor)/rfqs/page.tsx`
- `src/app/(admin)/admin/(monitor)/rfqs/_components/RfqFilters.tsx`
- `src/lib/notifications/templates/**/*Rfq*|*Quote*`
- `src/i18n/request.ts`
- `src/lib/zod/i18n.ts`
- `src/messages/en.json`
- `src/messages/ar.json`

## Full Analysis

See `opencode-full-analysis.txt` for complete findings with line numbers and code samples.

---

**Generated by:** opencode (gpt-5.4 plan-agent)  
**Analysis type:** Comprehensive language leakage audit + architecture assessment  
**Scope:** RFQ surfaces + i18n infrastructure  
**Coverage:** 30 issues enumerated with file/line/code/why/fix for each
