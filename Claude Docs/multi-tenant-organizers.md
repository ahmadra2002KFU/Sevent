> **Implementation status (2026-05-18):** Planned. PR 1 lands the schema, RLS, composite FKs, and feature-flag scaffold described here; the runtime feature flag `IS_COMPANY_FEATURES_ENABLED` ships disabled until PR 3. UI and cron fan-out are PR 4-6.

# Sevent — Multi-Tenant Organizers (dual-identity model)

This is the canonical reference for the dual-identity model used by company
organizers in Sevent. If you ever wonder *"does `events.organizer_id` mean the
company actor or the legal entity?"* — read this document. The short answer is
**both**, depending on whether `events.company_id IS NULL`.

This doc covers only the **data model and access** surface. The PR phasing,
verification plan, and risk register live in
`C:\Users\Ahmad\.claude\plans\i-want-you-to-cosmic-sketch.md`. Email templates
are tracked separately in `Claude Docs/email-templates/`.

---

## 1. The dual-identity rule (TL;DR)

When `company_id IS NULL`, the row belongs to an **individual organizer**, and
the legacy `organizer_id` / `reviewer_id` / `raised_by` / `requested_by` columns
are **both the actor and the legal owner** — exactly the pre-refactor meaning.
When `company_id IS NOT NULL`, the **legal owner is the company**, and the
legacy column is now the **human actor who performed the action** on the
company's behalf.

---

## 2. Why we didn't rename `organizer_id` to `actor_profile_id`

Renaming the FK column would have rippled across 38+ source files (every server
action, every RLS predicate, every join in `src/lib/domain/`) and the `RESTRICT`
FK on `bookings.organizer_id` would have fought us mid-migration. We kept the
existing names to keep diff blast-radius small and to allow individual organizers
to remain on the exact same code path with zero observable behavior change. A
new explicit `actor_profile_id` column was added on **`bookings`, `rfqs`, and
`quote_proposal_requests` only** — these are the three tables where the original
columns served double duty (booker / requester) and dual audit was missing
entirely. Everywhere else, the column-name shift is documentation-only.

---

## 3. Table-by-table identity map

| Table | Legacy actor column | New `company_id` column | New explicit actor column | Note |
|---|---|---|---|---|
| `events` | `organizer_id` | `company_id` (FK RESTRICT) | — (reuses `organizer_id`) | Composite FK: `(company_id, organizer_id) REFERENCES organizer_memberships(company_id, profile_id) DEFERRABLE INITIALLY DEFERRED`. |
| `bookings` | `organizer_id` | `company_id` (FK RESTRICT) | `actor_profile_id` (FK SET NULL) | `organizer_id` stays because of the existing RESTRICT FK to `profiles`; the next-major migration can drop it after backfill. Composite FK is on `(company_id, actor_profile_id)`. |
| `rfqs` | (inherited via `event_id → events`) | `company_id` (FK RESTRICT) | `actor_profile_id` (FK SET NULL) | Denormalized `company_id` so RLS predicates don't need to join `events`. Composite FK: `(company_id, actor_profile_id)`. |
| `disputes` | `raised_by` | `company_id` (FK RESTRICT) | — (reuses `raised_by`) | `company_id` is derived from the booking row at insert. Composite FK: `(company_id, raised_by)`. |
| `quote_proposal_requests` | `requested_by` | `company_id` (FK RESTRICT) | `actor_profile_id` (FK SET NULL) | Was missed in the original refactor pass — caught in review. Composite FK: `(company_id, actor_profile_id)`. |
| `reviews` | `reviewer_id` | — (unchanged in PR 1) | — | Reputation aggregation is an open question — see section 10. |
| `notifications` | `user_id` (recipient) | — (unchanged) | — | Per-user recipient by construction; fan-out is a write-time concern, not an RLS one. |
| `quote_revisions` | `author_id` | — (unchanged) | — | Authored on the supplier side; never carries an organizer-company identity. |

All composite FKs are `DEFERRABLE INITIALLY DEFERRED` so multi-row writes
(e.g. `accept_quote_tx_v2` which touches bookings + availability_blocks + quotes
in a single tx) don't trip the constraint mid-statement.

---

## 4. RLS predicate pattern

Every organizer-scoped RLS policy follows the same shape. Old form:

```sql
using (organizer_id = (select auth.uid()))
```

New form, applied uniformly across `events`, `rfqs`, `rfq_invites`, `quotes`,
`quote_revisions`, `bookings`, `disputes`, `dispute_evidence`,
`quote_proposal_requests`, and the contracts storage bucket policy:

```sql
using ((company_id is null and organizer_id = (select auth.uid()))
       or public.is_company_member(company_id))
```

The two `OR` branches are **mutually exclusive at runtime** — exactly one fires
per row, gated on whether `company_id` is null. Postgres can't use a single
index to serve both branches, so the migration ships **two partial indexes per
table**: one keyed on `organizer_id` (or actor column) `WHERE company_id IS
NULL`, one keyed on `company_id` `WHERE company_id IS NOT NULL`. See
`supabase/migrations/20260518111000_organizer_companies_existing_table_columns.sql`
for the pattern (`events_individual_idx`, `events_company_idx`, etc.).

Always wrap `auth.uid()` and `public.is_admin()` in `(select …)` — the
project's standing convention (see `Claude Docs/supabase-audit.md` P1-5) and
required for the predicate not to evaluate the helper once per row.

---

## 5. The `is_company_member` helper

Defined in
`supabase/migrations/20260518120000_organizer_companies_helpers.sql`.
The full signature:

```sql
create or replace function public.is_company_member(_company_id uuid)
returns boolean
language sql stable
set search_path = public, pg_catalog
as $$
  select _company_id is not null and exists (
    select 1 from public.organizer_memberships m
     where m.company_id = _company_id
       and m.profile_id = auth.uid()
       and m.removed_at is null
  );
$$;
```

Key properties:

- **`STABLE`, NOT `SECURITY DEFINER`, NOT `LEAKPROOF`.** This is the single most
  important design choice in the helper. `STABLE` lets the planner inline the
  function into the surrounding predicate, which in turn lets the partial
  `_company_idx` indexes get picked. (`LEAKPROOF` would be a further planner
  hint but requires superuser, and Supabase's `postgres` role isn't one — so we
  rely on `STABLE` alone, which is sufficient for inlining in our RLS context.)
  A `SECURITY DEFINER` wrapper would block
  inlining and force a `FunctionScan` per row.
- **Relies on the self-read RLS policy on `organizer_memberships`** (`profile_id
  = (select auth.uid())`) so it does not need elevated privileges. Adding
  `SECURITY DEFINER` would also create a leakage surface — a caller could probe
  membership of arbitrary `(company_id, profile_id)` pairs.
- **Soft-deleted memberships are excluded** via `removed_at IS NULL`. A removed
  member loses access on their next request; see section 11 for the TTL caveat.
- **`_company_id IS NULL` short-circuits to false.** This is the whole reason
  the OR predicate works — when an individual-organizer row reaches the second
  branch, the helper returns false cheaply and Postgres falls back to the first
  branch via the partial index.
- **Explicit `SET search_path = public, pg_catalog`** to block schema-hijack
  attacks (Trail of Bits checklist; see `Claude Docs/supabase-audit.md` P1-7).

A sibling `is_company_admin(_company_id uuid)` exists with the same shape,
filtering on `role IN ('owner','admin')`. It is used by server actions, not by
RLS — per-company role gating is action-level (see plan section
"Authorization").

---

## 6. Active-company resolution order

When a request arrives, the resolver in
`src/lib/auth/access.ts:150` (the cached `resolveAccessForUser`) and its helpers
in `src/lib/auth/activeCompany.ts` walk this chain to populate
`AccessDecision.activeCompanyId`:

1. **Signed query param `?company=<uuid>`** — HMAC-signed, 60s TTL, required for
   email-callback flows where the user clicks a link before a cookie exists.
2. **HttpOnly cookie `sevent_active_company`** — per-browser default for normal
   navigation; written on every successful resolve.
3. **`profiles.last_active_company_id`** — DB-side fallback (FK with `ON DELETE
   SET NULL`); authoritative when neither cookie nor signed param is present.
4. **Auto-resolve** — if exactly one current membership exists, pick it. If
   multiple exist with no signal, pick the most-recently-joined.

Every resolver call **must** verify `activeCompanyId ∈ availableCompanyIds` and
clear stale cookies / DB columns when a member has been removed since their
last successful resolve. Rejected designs (JWT custom claim, `set_config`
GUC) and their failure modes are documented in the plan under
"Active-company resolution".

---

## 7. Composite FK enforcement

The invariant is: **a row with `company_id IS NOT NULL` must have its actor
column equal to a current member of that company.** This is enforced by
`<table>_actor_is_company_member_fk` constraints in
`supabase/migrations/20260518112000_organizer_companies_composite_fks.sql`,
all `DEFERRABLE INITIALLY DEFERRED`. Composite FKs are ~0.05 ms per insert
against ~0.3–0.5 ms for an equivalent trigger and require no PL/pgSQL frame.

Postgres tuple-equality with NULLs is the trick that makes this work for
individuals: a composite FK `(company_id, actor_col) REFERENCES
organizer_memberships(company_id, profile_id)` **does not fire when
`company_id IS NULL`**, regardless of the actor column's value. Individual
organizers therefore see zero behavior change — the constraint is invisible to
them.

Soft-delete on `organizer_memberships` is consequently **mandatory, not
optional** — a hard `DELETE` would cascade-block via the composite FK chain from
every `events`/`bookings`/`rfqs`/`disputes` row the member ever touched. Removal
is `UPDATE organizer_memberships SET removed_at = now() …`, run inside
`remove_company_member_tx`.

---

## 8. Cron jobs that fan out

As of PR 1, four pg_cron jobs still notify only the row's legacy actor column
(`bookings.organizer_id`, `disputes.raised_by`, etc.). For company organizers
this means only the actor sees the notification — colleagues do not. Fan-out
to every current member lands in **PR 6**.

| Cron job | Migration | Fan-out lands in |
|---|---|---|
| `expire_soft_holds` | `supabase/migrations/20260512100000_lifecycle_cron_jobs.sql:34-121` | PR 6 |
| `auto_mark_completed` | `supabase/migrations/20260512100000_lifecycle_cron_jobs.sql:132-190` | PR 6 |
| `close_stale_disputes` | `supabase/migrations/20260512150000_close_stale_disputes_cron.sql:49-52` | PR 6 |
| `enqueue_message_reminders` | `supabase/migrations/20260514120000_message_reminder_cron.sql:59+` | PR 6 |

The fan-out treatment replaces the single `INSERT INTO notifications` with a
`FOR EACH member IN organizer_memberships WHERE company_id = b.company_id AND
removed_at IS NULL` loop, falling back to the legacy column when `company_id IS
NULL`. The existing `email_outbox` trigger at
`supabase/migrations/20260513120100_notifications_after_insert_email.sql:51-119`
keys per-`user_id` and naturally handles the resulting N rows without
de-dup work.

---

## 9. Email templates that carry company name

PR 2 adds an `organizerCompanyName: string | null` prop to five existing
templates:

- `src/lib/notifications/templates/organizer/BookingConfirmed.tsx`
- `src/lib/notifications/templates/organizer/BookingCreated.tsx`
- `src/lib/notifications/templates/organizer/QuoteReceived.tsx`
- `src/lib/notifications/templates/organizer/BookingCancelledBySupplier.tsx`
- `src/lib/notifications/templates/supplier/QuoteAccepted.tsx`

Display rule, applied identically inside each template:

- When `organizerCompanyName` is non-null, render
  `"<Company Name> — via <Actor Name>"`.
- When null, fall back to the actor name only (legacy behavior).

Supplier-side callers (e.g. `src/app/(supplier)/supplier/rfqs/[id]/quote/actions.ts`)
pass both fields. New invite/membership emails (`MemberInvited.tsx`,
`MemberJoined.tsx`) are introduced in PR 4 and only render company-mode copy.

---

## 10. Open questions (deferred from PR 1)

1. **Reviews reputation aggregation.** Should `reviews` gain a nullable
   `reviewer_company_id` column so suppliers see "Acme Events Co. has 4.2
   stars" rather than per-employee reputation? PR 1 ships **no change**;
   reputation continues to attribute to the individual reviewer until this is
   decided.
2. **Invite email strict-match.** Currently the invite-accept flow is **loose
   with a warning page** — a user signed in with a different email may accept,
   but `accepted_by` records the actual user. Strict match was rejected because
   KSA users frequently hold multiple identities. Sign-off explicit before PR 5.
3. **Dual citizen support.** A user who is both an individual organizer (with
   legacy events) AND a company member is covered by the schema (different
   `company_id` values on different rows), but the "My events" switcher entry
   that surfaces both inboxes lands in **PR 6**.
4. **Per-company branding.** `organizer_companies.logo_path` ships in PR 1, but
   the supplier-side email templates that render it (RFQ-sent, booking-update)
   land in PR 2. Confirm the ordering is acceptable for early multi-user
   customers.
5. **PDPL / GDPR data export.** Out of scope for this refactor; flagged as a
   follow-up task.

---

## 11. Risks and gotchas

- **`ForwardableAccess` HMAC header TTL (`src/lib/auth/access.ts:38`).** The
  current 60s TTL gives a just-removed member a 60s window to act on signed
  headers. PR 1 reduces the TTL specifically for company-scoped fields to
  **15s**; the legacy role/state fields keep the 60s budget to avoid breaking
  in-flight forward chains.
- **Soft-delete on memberships is required, not optional.** Anyone implementing
  a "delete teammate" admin tool must call `remove_company_member_tx` (which
  sets `removed_at`), never `DELETE FROM organizer_memberships`. Hard-deletes
  break the composite FK chain on every event/booking/RFQ the member ever
  touched.
- **`bookings.organizer_id ON DELETE RESTRICT` is kept.** "Leaving a company"
  is a membership soft-delete, which is cascade-safe. "Delete `auth.users`
  account" remains RESTRICT-blocked until the user's bookings reach a terminal
  state — same behavior as today.
- **Verify planner inlining.** Before deploying RLS migrations, run
  `EXPLAIN (ANALYZE, VERBOSE)` on a representative organizer query against
  `events` / `bookings`. The plan **must not** contain `FunctionScan` for
  `is_company_member`; if it does, the helper has lost `STABLE` or the
  partial index spec is wrong. See plan section "Verification → Performance"
  for the full check.
- **Composite FK + ambiguous overload.** When v2 RPCs land in PR 2, every
  function-creating migration must end with `NOTIFY pgrst, 'reload schema'`.
  Failing to do so returns PostgREST 404s until the next process restart — same
  failure mode that bit `send_rfq_tx` in commit 381127a.
