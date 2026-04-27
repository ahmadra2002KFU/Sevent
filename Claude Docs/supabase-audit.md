# Supabase / Postgres Audit — Sevent (local stack)

**Date:** 2026-04-27
**Scope:** Full audit of local self-hosted Supabase stack against the official `supabase-postgres-best-practices` skill rubric.
**Method:** Four parallel analyzer agents, each scoped to one track (schema, RLS, queries, connections/locks). Findings cite the specific reference rule and file:line.
**Status:** Findings only — no code has been changed. Awaiting approval on the priority order before applying fixes.

> Local-stack note: every fix below works via `supabase/migrations/*.sql` or `supabase/config.toml` + `supabase db reset` / `supabase start`. No cloud-dashboard steps.

---

## P0 — Fix first (security / correctness)

### P0-1. Privilege escalation in supplier booking RPCs
- **Rule:** `security-privileges.md`, `security-rls-basics.md`
- **Files:**
  - `supabase/migrations/20260504082000_supplier_booking_confirm.sql:47-107` and `:111-191`
  - `supabase/migrations/20260504082100_fix_supplier_booking_confirm_ambiguity.sql:20-139`
- **Problem:** `confirm_booking_tx(p_booking_id, p_supplier_id)` and `cancel_booking_supplier_tx(p_booking_id, p_supplier_id, p_reason)` are `SECURITY DEFINER` and `GRANT EXECUTE ... TO authenticated`. The only ownership check is `if v_supplier_id is distinct from p_supplier_id then raise` — a tautology that compares the booking's stored `supplier_id` to the value the **caller passed in**. Any authenticated user who learns a booking's supplier UUID can confirm or cancel it, releasing the calendar block, flipping the RFQ back to `sent`, and rejecting the accepted quote.
- **Fix:** Inside both functions, resolve the caller's supplier from `auth.uid()` and compare against the booking. Drop the `p_supplier_id` parameter — never trust caller-supplied identity in a definer function granted to `authenticated`.
  ```sql
  if not exists (
    select 1 from public.suppliers s
    where s.id = v_supplier_id and s.profile_id = (select auth.uid())
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  ```
  Also update the calling Server Actions in `src/app/(supplier)/supplier/...` to stop passing `p_supplier_id`.

### P0-2. Missing FK indexes will seq-scan on cascade
- **Rule:** `schema-foreign-key-indexes.md`
- **Files & columns** (all `supabase/migrations/20260420000100_marketplace_schema.sql` unless noted):
  - `bookings.accepted_quote_revision_id` (L646)
  - `bookings.quote_id` (L644) — partial unique exists but not all rows
  - `bookings.rfq_id` (L645)
  - `bookings.cancelled_by` (L657), `disputes.raised_by`/`resolved_by` (L729/L735), `quote_revisions.author_id` (L559), `rfqs.cancelled_by` (L437), `suppliers.verified_by` (L102), `availability_blocks.created_by` (L355), `supplier_docs.reviewed_by` (L200)
  - `quote_proposal_requests.requested_by` in `20260504080000_quote_proposal_requests.sql:64`
- **Problem:** Each unindexed FK forces a sequential scan on cascade/lookup; deleting a profile or quote_revision will scan whole tables.
- **Fix:** One migration creating btree indexes on every column above. Examples:
  ```sql
  create index bookings_accepted_quote_revision_idx on public.bookings(accepted_quote_revision_id);
  create index bookings_quote_id_idx on public.bookings(quote_id);
  create index bookings_rfq_id_idx on public.bookings(rfq_id);
  -- ...etc
  ```

---

## P1 — Real performance / scaling / contention

### Connection / locks

- **P1-1. Pooler is disabled** — `supabase/config.toml:40-50` has `[db.pooler] enabled = false`; `default_pool_size = 20` is dead config. Under any concurrency burst Postgres' raw `max_connections` is the only backstop.
  - **Fix:** Set `enabled = true`. Transaction mode is safe — no named PREPARE statements anywhere in the code.
- **P1-2. `send_rfq_tx` is not idempotent** — `20260504060000_send_rfq_tx_allow_empty.sql:42-108`. Double-click or Server Action retry creates duplicate RFQs; `FOR UPDATE` only serializes, doesn't dedupe.
  - **Fix:** Add `pg_advisory_xact_lock(...)` keyed on `(event_id, category_id, subcategory_id)` plus a duplicate-recent-row check, OR a partial unique index `unique (event_id, category_id, subcategory_id) where status = 'sent'`.
- **P1-3. `confirm_booking_tx` / `cancel_booking_supplier_tx` lack `lock_timeout` + `statement_timeout`** — every other `_tx` RPC sets `set local lock_timeout='5s'; set local statement_timeout='15s';` — these two don't (`20260504082100_fix_supplier_booking_confirm_ambiguity.sql:33-71, 82-138`). A stuck organizer write blocks supplier confirms indefinitely.
  - **Fix:** Add the two `set local` lines after `begin` in each.
- **P1-4. Lock-order inversion in `cancel_booking_supplier_tx`** — locks `bookings → quotes → rfqs` while the documented invariant (and `accept_quote_tx`) is `events → rfqs → quotes`. Deadlock window with concurrent `accept_quote_tx`.
  - **Fix:** After the bookings `FOR UPDATE`, explicitly `perform 1 from public.rfqs where id = v_rfq_id for update;` before mutating quotes/rfqs.

### RLS performance

- **P1-5. Bare `auth.uid()` un-wrapped in dozens of policies** — initplan footgun, the canonical 5–10× RLS slowdown. Hits the largest tables (`bookings`, `quotes`, `availability_blocks`, `notifications`).
  - Files (representative, not exhaustive): `20260420000000_extensions_and_profiles.sql:133,139,141,144,147,159,170,176`; `20260420000100_marketplace_schema.sql:127,131,132,154,179,185,187,212,216,218,251,253,295,297,332,334,380,382,419,451,453,488,497,505,511,516,520,522,584,592,598,603,605,616,624,632,674,677,679,714,716,750,759,761,792,793,798,804,827,829,830`; `20260504051000_rfqs_marketplace_rls.sql:27,40`; `20260504080000_quote_proposal_requests.sql:114`; `20260504000000_storage_buckets.sql:76,84,88,96,111,119,127,131,139`; `20260504005000_supplier_logos_bucket.sql:38,46,50,58`.
  - **Fix:** One sweep migration replacing `auth.uid()` with `(select auth.uid())` in every USING/WITH-CHECK clause. Same treatment for unwrapped `public.is_admin()` callsites → `(select public.is_admin())`.
- **P1-6. `profiles` admin policies recursively read `profiles`** — `20260420000000_extensions_and_profiles.sql:144,156-161,167-178`. Inline subqueries on `public.profiles` from policies on `public.profiles`. Other migrations already moved away from this via `is_admin()`.
  - **Fix:** Replace inline subqueries with `(select public.is_admin())`.
- **P1-7. Two security-relevant functions lack `set search_path`** — `guard_supplier_verification` (`20260504010000_guard_supplier_verification_service_role.sql:15-28`), `storage_supplier_id_from_path` and `storage_path_owner_profile` (`20260504000000_storage_buckets.sql:29-46, 48-56`). Inconsistent with other definer helpers.
  - **Fix:** Add `set search_path = public, pg_catalog` to each.

### Queries (src/)

- **P1-8. N+1 in portfolio reorder** — `src/app/(supplier)/supplier/portfolio/actions.ts:286-301` runs 2N awaited `.update()` calls.
  - **Fix:** New RPC `reorder_supplier_media(p_supplier_id, p_ids uuid[])` that does a single `UPDATE ... CASE WHEN id = ... THEN n` statement.
- **P1-9. N+1 in matching response-rate fan-out** — `src/lib/domain/matching/query.ts:229-231` calls `responsiveness.ts:35-39` once per surviving supplier in the public marketplace ranker.
  - **Fix:** `computeResponseRatesBulk(supplierIds)` — one query against `rfq_invites` with `= any($1)` plus JS grouping, OR a `vw_supplier_response_rate_30d` view.
- **P1-10. Slug-collision sequential probes** — `src/lib/onboarding/slug.ts:17-32` walks `-2`, `-3`, ... up to 50 awaited `count` queries.
  - **Fix:** One regex query `select slug from suppliers where slug ~ '^<base>(-\d+)?$' limit 100`, pick smallest free integer in JS.
- **P1-11. Unbounded listings (no `.range()` / `.limit()`)** — `src/app/(organizer)/organizer/rfqs/page.tsx:101-111`, `events/page.tsx:60-66`, `src/app/(supplier)/supplier/rfqs/page.tsx:117-128`, `src/app/(admin)/admin/verifications/page.tsx:109-120`. Each pulls full nested joins.
  - **Fix:** Add `.range(from, to)` + `searchParams.page`, mirroring the working pagination in `bookings/page.tsx:180`.

### Schema indexing

- **P1-12. Zero GIN indexes on JSONB** — `pricing_rules.config_jsonb`, `rfqs.requirements_jsonb`, `quote_revisions.snapshot_jsonb`, `reviews.ratings_jsonb`, `disputes.resolution_jsonb`, `notifications.payload_jsonb`, `suppliers.profile_sections_order`. Any `@>` / `?` lookup will seq-scan.
  - **Fix:** GIN on the columns actually queried with containment, e.g. `create index pricing_rules_config_gin on public.pricing_rules using gin (config_jsonb jsonb_path_ops);`. Apply selectively — not all are hot.
- **P1-13. No full-text search infra** — bilingual EN/AR marketplace browse will need it. Today only btree on `business_name`/`name` doesn't exist; any `ILIKE '%term%'` will seq-scan.
  - **Fix:** Generated `tsvector` column on `suppliers` (`business_name` + `bio`) and `packages` (`name` + `description`) with GIN, using `'simple'` config (bilingual data).
- **P1-14. Composite index column-order issue** — `20260504050000_rfqs_marketplace.sql:40-42` has `(is_published_to_marketplace, status, sent_at desc) WHERE is_published_to_marketplace`. Leading boolean is constant inside the partial predicate.
  - **Fix:** `create index rfqs_marketplace_browse_idx on public.rfqs (status, sent_at desc) where is_published_to_marketplace;`.
- **P1-15. `categories.parent_id` index non-partial despite NULL parents** — `20260420000100:78`.
  - **Fix:** `create index categories_parent_idx on public.categories(parent_id) where parent_id is not null;` (drop the existing).

---

## P2 — Hygiene

- **P2-1.** No cluster-level `idle_in_transaction_session_timeout` or `statement_timeout`. Per-function `set local` is good but a buggy `psql` session can hold transactions forever.
  - **Fix:** Migration `alter database postgres set idle_in_transaction_session_timeout = '30s'; alter database postgres set statement_timeout = '60s';`.
- **P2-2.** `availability_blocks_guard_overlap` trigger takes `FOR UPDATE` on `suppliers` even on release-only updates (`20260420020000_sprint4_accept_quote.sql:48-94`).
  - **Fix:** Early-return when `tg_op='UPDATE' AND new.released_at IS NOT NULL AND old.released_at IS NULL`.
- **P2-3.** Public-read policies lack explicit `TO anon, authenticated`. Future PUBLIC revoke could silently break them. Tables: `categories`, `suppliers`, `packages`, `availability_blocks`, `supplier_media`, `supplier_categories`, `reviews`.
- **P2-4.** UUIDv4 PKs everywhere — random insertion fragments B-trees at scale. Switch new tables to `uuid_generate_v7` or identity bigint where the PK isn't user-facing.
- **P2-5.** `currency char(3)` should be `text` per skill rubric (`schema-data-types.md`); add a `check (currency = 'SAR')` if needed. Tables: `packages`, `pricing_rules`, `events`, `quotes`.
- **P2-6.** Unconstrained text "code" columns (`bookings.decline_reason_code`, `rfqs.cancellation_reason_code`, `notifications.kind`, `disputes.reason_code`) — should be enum or `check` constrained.
- **P2-7.** `add constraint` calls in `20260420000100:572-574, 684-689` aren't `if not exists`-guarded. Low risk on local CLI but breaks repeat-run hygiene.
- **P2-8.** `createSupabaseServiceRoleClient()` re-instantiated 84× across 21 files; fine because it's HTTP, but a module-scope singleton in Node runtime would shave parse/build cost.

---

## Clean (no action)

- snake_case identifiers, `timestamptz` everywhere, partial indexes used appropriately, GIST on `availability_blocks`, PostGIS columns OK
- No `select('*')` anywhere in `src/`
- No `.upsert()` calls (so no missing-`onConflict` issues)
- No client-side `SUPABASE_SERVICE_ROLE_KEY` leaks
- `.maybeSingle()` vs `.single()` correctly chosen at every callsite
- `getCurrentUser` is `react.cache`'d; admin client reused per request
- Batch inserts done via array inserts or batch RPCs
- `accept_quote_tx` lock order is documented and matches code (`events → rfqs → quotes (ORDER BY id) → suppliers`)
- `upsert_quote_revision_tx` has proper short-tx discipline
- No queue tables → no `SKIP LOCKED` needed
- No named PREPARE statements anywhere → transaction-mode pooler is safe to enable
- No prod-cloud assumptions (all fixes apply via migrations + config.toml)
- No partitioning needed — every table well below 100M rows

---

## Suggested execution order

1. **P0-1** — Fix the booking RPC privilege escalation (single migration + 2-3 Server Action call-site updates).
2. **P0-2** — One migration adding all missing FK indexes (~12 indexes, low risk, zero churn).
3. **P1-5 + P1-6 + P1-7** — One migration sweep for the RLS `auth.uid()` wrapping, recursive `profiles` policies, and missing `search_path`s. Big perf win, single deploy.
4. **P1-1** — Flip `[db.pooler] enabled = true` in `config.toml`, restart stack.
5. **P1-2 + P1-3 + P1-4** — Idempotency, timeouts, and lock-order in `_tx` RPCs (single migration, replaces three function bodies via `CREATE OR REPLACE`).
6. **P1-8 → P1-11** — `src/` query fixes + the `reorder_supplier_media` RPC. One PR per area.
7. **P1-12 → P1-15** — Index migration: GIN on hot JSONB, FTS infra for suppliers+packages, fix `rfqs_marketplace_browse_idx` and `categories_parent_idx`.
8. **P2-***  — Address opportunistically.

---

## Awaiting approval

Tell me which order to take (above is the recommendation), or if you want any item rescoped/skipped, before I touch code. The P0 booking RPC is the only one with security urgency — happy to start there alone if you'd rather see it land before the rest.
