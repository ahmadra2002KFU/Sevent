# Testing Badge for Marketplace Opportunities

_Last updated: 2026-05-21_

## Why this exists

For continuous development we need to push **real-looking opportunities** into the
live marketplace without misleading suppliers. A "testing badge" lets an admin
flag any opportunity (RFQ published to the marketplace) as a test. Suppliers can
still apply to it — it behaves like any other opportunity — but it is clearly
**labelled "Testing"** and **sorted to the bottom** of the list so it never
crowds out real demand. When testing is done, a single **global kill switch**
hides every testing opportunity from suppliers at once.

## Behaviour contract

| Actor | What they see / can do |
|-------|------------------------|
| **Admin** | Mark / unmark any RFQ as testing (RFQ detail page). Filter the RFQ list by testing / real. Flip a global switch to hide all testing opportunities from suppliers. |
| **Supplier — switch OFF** | Testing opportunities appear in the marketplace, badged "Testing", sorted **after** all real opportunities. They can open and **apply** normally; the detail page shows a heads-up notice. |
| **Supplier — switch ON** | Testing opportunities **disappear entirely** from the marketplace — both the list and the direct detail URL (hard-gated by RLS, returns 404). |

A testing opportunity is a fully real, applyable RFQ. The flag only changes
**presentation** (label + sort) and **global visibility** (kill switch). The
apply flow is unchanged and untouched.

## Data model

Migration: `supabase/migrations/20260521110000_rfq_testing_badge.sql`

1. **`rfqs.is_testing boolean not null default false`** — the per-RFQ flag.
   Existing and future RFQs are real unless an admin marks them.
   - Index `rfqs_marketplace_testing_browse_idx` on
     `(is_published_to_marketplace, status, is_testing, sent_at desc)` (partial,
     `where is_published_to_marketplace`) supports the new browse ordering.
2. **`public.app_settings`** — a singleton settings table. The
   `id boolean primary key default true` + `check (id)` pattern forces exactly
   one row. Holds platform-wide switches; today just
   **`hide_testing_opportunities boolean`** (the global kill switch), plus
   `updated_at` / `updated_by` for audit.
3. **`public.testing_opportunities_hidden() → boolean`** — `SECURITY DEFINER`,
   `search_path = public`. The single source of truth for "is the kill switch
   on?". Definer rights let it read `app_settings` without granting suppliers
   direct read. Granted to `anon, authenticated, service_role` so it can be
   called inside both the marketplace function and the RLS policy.

## Enforcement (two coordinated points, one source of truth)

Both keyed off `public.testing_opportunities_hidden()`:

1. **`marketplace_opportunities_for_supplier(p_supplier_id, p_limit)`** — the
   bounded candidate function used by the supplier list. Signature/return type
   unchanged (`rfq_id` only). Body now:
   - `and (r.is_testing = false or not public.testing_opportunities_hidden())`
     — drops testing candidates when the switch is on.
   - `order by r.is_testing asc, r.sent_at desc nulls last` — testing rows last,
     so the `LIMIT` favours real opportunities.
2. **RLS policy `rfqs: marketplace supplier read`** — the **hard gate**.
   Re-created with the same clause: a testing RFQ is only readable while the
   switch is off. This is what makes the opportunity **detail page** 404 for a
   hidden testing RFQ (`getMarketplaceOpportunity` reads via the user client and
   relies on this policy), not just the list.

`app_settings` has RLS enabled with admin-only read/update policies as
defence-in-depth — the admin server actions write via the service-role client
(which bypasses RLS), so suppliers/organizers can never touch it.

## Application code

### Domain (`src/lib/domain/marketplace.ts`)
- `MarketplaceOpportunity` DTO gains `is_testing`.
- The list hydration query selects `is_testing`; after UI filtering, results are
  re-sorted **testing-last** with a stable sort (`Number(a.is_testing) -
  Number(b.is_testing)`), preserving the `sent_at desc` order within each group.
  (The SQL `LIMIT` ordering and the TS re-sort agree.)
- `getMarketplaceOpportunity` (detail) selects + returns `is_testing` so the
  detail page can show the notice. RLS handles the global-hide 404.

### Supplier UI
- `src/app/(supplier)/supplier/opportunities/page.tsx` — list cards show a
  "Testing" badge (`semantic-warning`) and a muted warning surface when
  `is_testing`.
- `src/app/(supplier)/supplier/opportunities/[id]/page.tsx` — a warning Alert
  ("This is a testing opportunity…") above the apply form. Apply still works.

### Admin UI
- `src/app/(admin)/admin/(monitor)/rfqs/actions.ts` — server actions:
  - `setRfqTestingAction` — mark / unmark a single RFQ (`requireRole("admin")`,
    service-role write). Posts the desired next value (`is_testing` =
    `"true"`/`"false"`) so a toggle is one idempotent submit. Revalidates the
    admin + supplier surfaces.
  - `setHideTestingOpportunitiesAction` — flip the global flag.
- `_components/RfqTestingToggle.tsx` — the per-RFQ toggle card on the RFQ detail
  page.
- `_components/HideTestingSwitch.tsx` — the global kill switch atop the RFQ list.
- `_components/RfqFilters.tsx` — adds a `testing` filter dimension
  (`all` / `yes` / `no`), URL-driven like the existing status/published filters.
- `(monitor)/rfqs/page.tsx` — reads the global flag, renders the switch + a
  per-row "Testing" badge, applies the testing filter.
- `(monitor)/rfqs/[id]/page.tsx` — renders the toggle and a "Testing" summary row.

### Types & i18n
- `src/lib/supabase/types.ts` — `RfqRow.is_testing` + `AppSettingsRow`.
- `src/messages/{en,ar}.json` — `supplier.opportunities.testingBadge`,
  `supplier.opportunities.detail.testingNotice`, and `admin.rfqs.testing.*`,
  `admin.rfqs.globalHide.*`, `admin.rfqs.filter.testing*`.

## How to operate it

1. **Mark an opportunity as testing**: Admin → RFQs → open an RFQ → "Testing
   opportunity" card → **Mark as testing**. The list now shows a Testing badge
   on that row, and suppliers see it badged + last.
2. **Hide everything during a quiet period**: Admin → RFQs → top of page →
   **Hide testing** on the "Hide testing opportunities from suppliers" switch.
   Every testing opportunity vanishes from the supplier marketplace immediately.
   Click **Show testing** to bring them back (badged, last).
3. **Find/triage testing rows**: use the **Any kind / Testing only / Real only**
   filter on the RFQ list.

## Verification performed (2026-05-21)

- `pnpm typecheck` — passes. `eslint` on all changed files — clean (the repo's
  pre-existing lint errors are in unrelated files: `FeedbackWidget.tsx`,
  `access.test.ts`, `autoMatch.ts`).
- DB behaviour, in a rolled-back transaction against the local stack
  (`supabase_db_sevent`), with one real + one testing published/sent RFQ for an
  approved+published supplier:
  - **Switch OFF** → `marketplace_opportunities_for_supplier` returns both, the
    testing one **last** even though it was sent more recently (testing ordering
    dominates `sent_at`).
  - **Switch ON** → `testing_opportunities_hidden()` = true, function returns
    **only** the real opportunity.
  - `pg_policies` confirms `rfqs: marketplace supplier read` carries the
    `testing_opportunities_hidden` clause, and `app_settings` RLS is enabled.
- Not browser-tested end-to-end (Chrome MCP scripting is blocked in this
  environment; dev server is unstable under automation). The UI is wired through
  the verified data layer and typechecks/lints clean.
