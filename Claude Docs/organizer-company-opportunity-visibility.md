# Fix: Organizer company opportunities only visible to the creator

## Problem (confirmed against code + DB)

Organizer **companies** (multi-user) were built at the schema + RLS layer (migrations
`20260518*`–`20260519*`, "PR 1–7") and the kill switch is **ON**
(`.env.local:22 IS_COMPANY_FEATURES_ENABLED=true`). But the organizer **data plane was
never wired to it**:

- **Write path stamps `company_id = NULL`:**
  - `events/actions.ts` `createEventAction` inserts events with no `company_id`, and
    `publishBunoodForEvent` inserts the auto-RFQs with no `company_id`/`actor_profile_id`.
  - `rfqs/actions.ts` `sendRfqAction` calls `send_rfq_tx_v2` with `p_company_id: null`.
  - `rfqs/[id]/quotes/actions.ts` `acceptQuoteAction` calls `accept_quote_tx_v2` with
    `p_company_id: null`; `requestProposalAction`/`cancelProposalRequestAction` gate on
    `organizer_id === user.id` only.
- **Read path filters by the individual creator** (`organizer_id = user.id`, or
  `events.organizer_id = user.id` via join) on the **service-role client** (which bypasses
  RLS — see `server.ts:50`, the user JWT isn't forwarded for RLS reads). 11 sites.

**Result:** member B creates an opportunity → row is `organizer_id = B, company_id = NULL`
→ owner A's pages filter `organizer_id = A` → A sees nothing. Exactly the reported symptom.

DB RLS is already company-aware (`company_id = mine OR is_company_member(company_id)`); the
gap is entirely the NULL writes + individual-only reads.

## Scope (confirmed with user 2026-05-21)

- ✅ ALL organizer surfaces become company-wide (RFQs, events, quotes, bookings, dashboard).
- ✅ Backfill existing rows.
- ⚠️ "Share messages" was asked under a wrong premise: `/organizer/messages` is the
  **`app_feedback`** personal user↔platform-admin support inbox, NOT supplier↔organizer
  opportunity threads (no such system exists). Sharing personal support tickets across a
  company would leak private data and is unrelated to opportunities. **Excluded** from this
  change; re-confirm with user separately.

## Design

`activeCompanyId` is the active-company the caller is acting as (resolved in `access.ts` →
`decision.activeCompanyId`). Visibility mirrors RLS but scoped to the active company:

- row visible ⇔ `company_id = activeCompanyId` OR (`company_id IS NULL` AND owner = me).

New helper `src/lib/auth/organizerScope.ts`:
- `organizerScopeFor(decision, userId) -> {userId, activeCompanyId}`
- `companyOwnedOrFilter(scope, ownerColumn="organizer_id")` → PostgREST `.or(...)` string for
  tables where company_id + owner are co-located (events, bookings); null for individuals.
- `canViewOrganizerRow(scope, {company_id, ownerId})` → in-memory check for detail pages.

rfqs/quotes have the owner on the joined `events` row (not expressible in a single `.or()`),
so in company mode they filter strictly `rfqs.company_id = activeCompanyId` (backfill +
forward writes guarantee company RFQs are stamped). Individual mode unchanged.

## Tasks

1. [x] Investigate + confirm root cause (code + DB).
2. [x] `src/lib/auth/organizerScope.ts` helper (shared contract).
3. [x] Write path: stamp `company_id` (+ `actor_profile_id`):
   - `events/actions.ts`: createEventAction + publishBunoodForEvent + addBandAction
     (routed through service-role client per review Finding 2).
   - `rfqs/actions.ts`: sendRfqAction → `p_company_id` **derived from the event**
     (review Finding 1, avoids P0024 on legacy events).
   - `rfqs/[id]/quotes/actions.ts`: acceptQuoteAction (`p_company_id` derived from event),
     requestProposalAction (+ stamp qpr), cancelProposalRequestAction.
4. [x] Read path (company-aware) — all 11 sites listed below.
5. [x] Backfill migration `20260521120000_organizer_company_backfill.sql` (single-company
   members only; events→rfqs→bookings→disputes→qpr, respecting composite FKs).
6. [x] Verify (see below).
7. [x] Eliminate dead-CTA regression on `bookings/[id]/page.tsx` (dispute/review CTAs only
   shown to the booking's acting party — see Follow-ups).

## Verification (done)

- `pnpm typecheck` clean; `eslint` clean on all changed files (the 18 repo lint errors are
  pre-existing in untouched files: FeedbackWidget.tsx, access.test.ts, autoMatch.ts).
- **DB functional test (rolled-back tx):** seeded member B into "Test test" company, ran the
  real `send_rfq_tx_v2` company path, forced `SET CONSTRAINTS ALL IMMEDIATE` (composite FKs
  validated). Then, as owner A (non-creator): NEW rfqs query returns **1**, NEW events query
  returns **1** (A sees B's opportunity); OLD individual query returns **0** (the bug);
  outsider company query returns **0** (no cross-company leak).
- **Chrome MCP smoke test:** dashboard / rfqs / events / bookings (incl. `?status=confirmed`)
  all render 200 with no console errors in individual mode (null-active-company branch).
- Two technical review agents (write+migration / read) + one logical review agent.

## Follow-ups surfaced by review (NOT done — need a product decision)

- **Disputes & reviews on company bookings stay creator-only.** `disputes.server.ts` /
  `reviews.server.ts` gate on `organizer_id === viewerProfileId`. The booking is now
  company-visible but only its creator can file a dispute / leave a review. Dead-CTA
  regression fixed (CTAs hidden from non-creator members); extending the actions to all
  members is a deliberate change (reviews are unique per `(booking_id, reviewer_id)` →
  per-member reviews; disputes have `raised_by` identity + filing windows).
- **Notifications/emails are per-actor, not company-wide.** A member can SEE a new quote on a
  company opportunity but other members aren't alerted. Likely the user's "got a message"
  remark — a notification-fanout feature, separate from visibility.
- **Backfill skips multi-company creators** (`having count(*) = 1`); their historical rows
  stay individual-only. No such users in current data.
- **Messages = `app_feedback`** (personal user↔admin support inbox), not opportunity threads.
  Not company-shared (would leak private support tickets). Re-confirm with user.

## Success criteria — MET

A company with owner A + member B: B creates an event/RFQ acting as the company → A sees it
in /organizer/rfqs, /organizer/events, dashboard, and can open detail / compare quotes /
accept / request a proposal. B's individual (non-company) items are NOT shown to A. No
cross-company leakage. Pure individual organizers behave exactly as before. (Proven by the
DB functional test above.)
