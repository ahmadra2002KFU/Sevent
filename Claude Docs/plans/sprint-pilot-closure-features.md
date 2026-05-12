# Sprint Plan — Pilot Closure: Features (2026-05-12 → 2026-05-25)

> **Status:** FINAL — Phase 1 + Phase 2 review folded in. Scope decision locked: **Slice 5 (mutual payment-state) is cut from this sprint** at user's direction. Pilot will track payments manually until a follow-up sprint.
> **Goal of this file:** durable working doc for the sprint. Captures *what we know*, *what we're building*, *where every wire connects*. Survives across sessions.
> **Review record:** opencode gpt-5.5 plan-review log at `C:\Users\Ahmad\.claude\open-review\jobs\8671af925292\or-mp2hdrrh-ddb849.log` lines 88-191.

---

## 🚨 Live-deploy alert (verify before sprint kickoff)

User asserted the platform is live at `seventsa.com` (app) and `api.seventsa.com` (Supabase Kong).
Read-only check (Phase 1):

| URL | Result | Interpretation |
|---|---|---|
| `https://seventsa.com` | **ECONNREFUSED** | Either app process isn't running, or Cloudflare Tunnel route for `seventsa.com` isn't bound to `localhost:3000` |
| `https://api.seventsa.com/rest/v1/` | `HTTP 401 Unauthorized` | ✅ Kong is up, tunnel route is correct; 401 is the expected response without an `apikey` header |

**Action:** ask the user to verify the app process (`pm2 status sevent` or `systemctl status sevent`) and the tunnel mapping for `seventsa.com` → `localhost:3000`. **Don't block local feature development on this** (per opencode's recommendation), but production E2E acceptance can't be trusted until the app tunnel responds.

---

## Context

Sevent (Saudi events marketplace, Next.js 16 + self-hosted Supabase) has shipped Sprints 1–3 and most of Sprint 4 (quote engine, accept_quote_tx, soft-holds, supplier confirm). Audit (this conversation + `Claude Docs/codebase-inventory-2026-05-11.md` + opencode gpt-5.5 plan-agent report at `or-mp2fax63-e90ab1.log`) confirms these **product features are missing or stub-only:**

| Missing feature | Evidence | Severity |
|---|---|---|
| Contract PDF generation after `confirm_booking_tx` | No `@react-pdf/renderer` dep; no `src/lib/contracts/`; `contracts` bucket exists but unused; storage policy for party read explicitly deferred at `supabase/migrations/20260504000000_storage_buckets.sql:154-157` AND those policies were dropped/recreated in `supabase/migrations/20260505010000_p1_rls_initplan_sweep.sql:502-511` | **Blocker** |
| Review submission UI + double-blind publication | No `src/app/**/reviews/**`; aggregation exists in `src/lib/domain/supplierProfile.ts:50-53,166-170` but no insert path | **Blocker** |
| Dispute open + evidence + admin workspace | No `src/app/**/disputes/**`; `disputes` + `dispute_evidence` schema-only; no `dispute-evidence` storage bucket | **Blocker** |
| Lifecycle pg_cron jobs | `pg_cron` extension is enabled at `supabase/migrations/20260420000000_extensions_and_profiles.sql:12-13` but **zero `cron.schedule()` calls exist anywhere**; pg_cron installed in `extensions` schema (no repo-defined `cron` role) | **Blocker** |
| Mutual off-platform payment state | `bookings.payment_status` enum exists at `supabase/migrations/20260420000100_marketplace_schema.sql:43-45` (`'unpaid' \| 'deposit_paid' \| 'balance_paid' \| 'paid'`); zero src/ writes; no actor/timestamp columns | **Blocker** (review pending — may cut, see § Scope Decision) |

User decisions locked from prior question round:
- Mutual payment-state: **organizer marks "sent", supplier confirms "received"**, admin can override.
- Doc gating: **stay permissive** for now — no required-doc validation lands this sprint.
- Deploy: **already live** (per user) at `seventsa.com` / `api.seventsa.com` — sprint avoids deploy work but must verify the app is reachable.
- **Out of scope** explicitly: Terms / Privacy / consent / sentinel removal / legal copy. **Features only.**

---

## Scope (LOCKED — 4 features, Slice 5 cut)

1. **Lifecycle pg_cron foundation** — narrowed to `expire_soft_holds` + `auto_mark_completed`. Review/dispute cron jobs ship inside their feature slices (per opencode review §3, §5).
2. **Contract PDF pipeline** — generate immutable PDF from accepted `quote_revisions` snapshot on supplier confirm; store in `contracts` bucket; party-only RLS for download.
3. **Reviews** — submission UI for both sides on completed bookings, double-blind publication cron, leverage existing aggregation in supplier profile.
4. **Disputes** — open + reason/description, evidence upload (files + notes) for both parties, admin workspace with full context + resolution writer; correct interaction with review publication.
5. ~~**Mutual off-platform payment state**~~ — **CUT from this sprint** (user decision 2026-05-12). Defer to a follow-up sprint. Pilot will track payments manually via admin/Studio. Slice 5 design notes below preserved for future implementation.

## Out of scope (explicit — do not let these leak in)

- Terms / Privacy / legal copy / draft banner / organizer consent checkbox
- `__TEMP_AWAITING_LEGAL__` sentinel removal (defer to compliance sprint)
- Required-doc validation in onboarding
- Linux deploy / Cloudflare Tunnel / VPS work (verify-only)
- UI redesign / design-system rework (redesign coming for parts of platform)
- Tap / escrow / ZATCA / Wathq / Nafath (post-pilot per `plan.md`)
- Generated Supabase types (defer)
- Stray root scripts cleanup (`approve.ts`, `set-supplier-state.ts`, `update-supplier.ts`) — defer
- Playwright golden paths + RLS matrix (stretch only)
- Full Arabic translation pass
- Partial-refund flow (explicitly out — but Slice 5 design must not paint us into a corner)

---

## Phase 1 — Validated facts (durable reference)

All facts below are read from code/migrations on 2026-05-12. Cite as ground truth when implementing.

### 1.1 `bookings` table — `supabase/migrations/20260420000100_marketplace_schema.sql:642-661`

Columns relevant to this sprint:
- `id uuid PK`
- `rfq_id uuid NOT NULL` → `rfqs.id`
- `quote_id uuid NOT NULL` → `quotes.id`
- `accepted_quote_revision_id uuid NOT NULL` → `quote_revisions.id` (immutable snapshot FK)
- `organizer_id uuid NOT NULL` → `profiles.id`
- `supplier_id uuid NOT NULL` → `suppliers.id`
- `contract_pdf_path text NULL` — **target column for contract PDF feature; currently never written**
- `confirmation_status booking_confirmation_status NOT NULL DEFAULT 'awaiting_supplier'` → enum `'awaiting_supplier' | 'confirmed' | 'cancelled'`
- `payment_status booking_payment_status NOT NULL DEFAULT 'unpaid'` → enum `'unpaid' | 'deposit_paid' | 'balance_paid' | 'paid'`
- `service_status booking_service_status NOT NULL DEFAULT 'scheduled'` → enum `'scheduled' | 'in_progress' | 'completed' | 'disputed'`
- `awaiting_since timestamptz`, `confirm_deadline timestamptz`, `confirmed_at timestamptz`, `cancelled_at timestamptz`, `cancelled_by uuid → profiles`, `completed_at timestamptz`
- `created_at`, `updated_at`

**Implications for payment-state feature:** the existing enum has no `*_sent` values. Add audit columns + enforce transitions via Server Actions (not via trigger only — opencode §3 risk).

### 1.2 `quote_revisions` table — `marketplace_schema.sql:555-569`

- `id uuid PK`, `quote_id uuid NOT NULL`, `version int NOT NULL`, `author_id uuid NOT NULL`, `snapshot_jsonb jsonb NOT NULL`, `content_hash text NOT NULL`, `created_at timestamptz`
- `UNIQUE(quote_id, version)`

**`snapshot_jsonb` shape** (typed in `src/lib/domain/quote.ts:41-69` as `QuoteSnapshot`): see source.

**Helper to read:** `parseQuoteSnapshot()` at `src/lib/domain/quote.ts:194-198`.

**Contract PDF must render directly from `snapshot_jsonb`** — never re-derive (would invalidate content_hash).

### 1.3 `contracts` storage bucket — `supabase/migrations/20260504000000_storage_buckets.sql:24-26` + `:153-168` (originally), then **dropped+recreated** in `supabase/migrations/20260505010000_p1_rls_initplan_sweep.sql:502-511`

```sql
insert into storage.buckets (id, name, public) values ('contracts','contracts',false);
```
- `public: false`, no MIME/size cap.
- Current effective policies (per the later sweep): `admin read`, `admin all`. Party-read deferred.
- **Sprint's contract-RLS migration must drop the policies by their CURRENT names (defined in 20260505010000), not the original migration**.

### 1.4 Supplier confirm flow — `src/app/(supplier)/supplier/bookings/[id]/actions.ts:51-110`

Flow today:
1. `requireAccess("supplier.bookings") → { decision, admin }`
2. Validate `booking_id` from FormData
3. `admin.rpc("confirm_booking_tx", { p_booking_id, p_supplier_id })`
4. *(NEW HOOK POINT)* — after RPC success, before notification: load accepted quote_revision + parties + event, render PDF, upload, persist `contract_pdf_path`, **then** revalidate.
5. `createNotification(organizer_id, "booking.confirmed", {...})`
6. `revalidatePath(...)` for supplier + organizer routes
7. Return `{ status, message }`

**`confirm_booking_tx` RPC** at `supabase/migrations/20260504082100_fix_supplier_booking_confirm_ambiguity.sql:20-71`:
- Locks `bookings` row, transitions to `'confirmed'`, soft_holds → `'booked'`, returns only the booking_id (must re-query for revision).
- P0 patched: `20260505000000_p0_revoke_booking_rpc.sql` restricts EXECUTE to `service_role` only ✅.

`BookingActions` uses `useActionState` at `src/app/(supplier)/supplier/bookings/[id]/BookingActions.tsx:41-48` — **revalidation must happen AFTER `contract_pdf_path` persists** for the download button to render same-tick (opencode §4).

### 1.5 `reviews` table — `marketplace_schema.sql:695-720`

- `id`, `booking_id` (FK cascade), `reviewer_id`, `reviewee_id` (**profiles**, not suppliers — opencode §4), `ratings_jsonb` (`{overall, value, punctuality, professionalism}`), `text`, `submitted_at`, `window_closes_at`, `published_at`, `suppressed_for_dispute boolean DEFAULT false`
- `UNIQUE(booking_id, reviewer_id)`
- RLS: reviewer self read/insert, **public read where `published_at IS NOT NULL`** (`marketplace_schema.sql:717-718`), admin read

**Crucial finding (opencode §1):** `suppressed_for_dispute` flag does NOT hide reviews from public — public RLS only checks `published_at`. The state machine (`Claude Docs/state-machines.md:108-110`) says to **clear `published_at` on dispute open**; the publish cron re-publishes after resolution.

### 1.6 `disputes` table — `marketplace_schema.sql:726-764`

- `status dispute_status NOT NULL DEFAULT 'open'` → enum `'open' | 'investigating' | 'resolved' | 'closed'`
- `reason_code text NOT NULL` (text, not enum — P2-6 audit flag, leaving as-is)
- `description text NOT NULL`, `opened_at`, `resolved_at`, `resolved_by`, `resolution_jsonb`
- Indexes on `booking_id`, `status`
- RLS: party read, party open, admin all

**`disputes.opened_at` must be ≤ `bookings.completed_at + 7d`** per `state-machines.md:19`. This is a server-action gate, not a cron job.

### 1.7 `dispute_evidence` table — `marketplace_schema.sql:766-808`

- `kind dispute_evidence_kind NOT NULL` → enum `'file' | 'note'`
- `file_path text NULL`, `text_note text NULL`
- CHECK: exactly one of file_path/text_note non-null per kind
- `visible_to_other_party boolean DEFAULT true`
- RLS: party read (joins through disputes→bookings), party write with `submitted_by = auth.uid()`, admin all

### 1.8 Storage buckets that exist — `storage_buckets.sql`

`supplier-portfolio`, `supplier-docs`, `contracts`, `supplier-logos`, `feedback-screenshots`.
**No `dispute-evidence` bucket.** Add as new migration with party-only RLS.

### 1.9 Public profile review aggregation — `src/lib/domain/supplierProfile.ts:50-53,166-170,255-269` + `src/app/(public)/s/[slug]/page.tsx:145,261-297`

Already loads + aggregates published reviews. Type `PublicSupplierReviewSummary = { count: number; average_overall: number | null }`. **No work on read side.** Submission must produce rows that satisfy the existing filter (`published_at IS NOT NULL`).

### 1.10 Booking detail pages

- **Organizer** `src/app/(organizer)/organizer/bookings/[id]/page.tsx`:
  - Already shows `<CompanyProfileDownloadButton>` at L254-262 when confirmed — exact pattern to copy.
  - Action `getCompanyProfileUrlAction` mints signed URL.
- **Supplier** `src/app/(supplier)/supplier/bookings/[id]/page.tsx`:
  - `<BookingActions>` at L168 — review/dispute/payment CTAs below.
- **Booking lists** do NOT load `service_status` — extend queries for the new CTAs.

### 1.11 Admin monitor — `src/app/(admin)/admin/(monitor)/`

Tabs: `rfqs`, `applications`, `proposals` via `MonitorTabs`. Layout at `(monitor)/layout.tsx`. **Adding a `disputes` tab is a drop-in.**

### 1.12 Notifications API — `src/lib/notifications/inApp.ts:11-30,44-63` + `email.ts:48-92`

`createNotification({ supabase, user_id, kind, payload? })`. 17 kinds today. None for review/dispute/payment-state. Every callsite hand-fans-out — no `notifyBookingTransition` helper (write one as part of slice work).

### 1.13 pg_cron + pooler — `supabase/config.toml:40-50` + `extensions_and_profiles.sql:12-13`

- `pg_cron` extension installed in schema `extensions`.
- Pooler enabled, transaction mode.
- **No repo-defined `cron` role.** Verify EXECUTE grants locally via SQL before committing the cron migration (opencode §1).

### 1.14 Locale helpers (for PDF/email render)

- `src/lib/domain/formatDate.ts`: `fmtDate`, `fmtDateTime`.
- `src/lib/domain/money.ts`: `formatHalalas({locale, withCurrency})`, etc.
- `src/lib/zod/i18n.ts`: `registerZodLocale`.

### 1.15 Server-action convention

```typescript
type ActionState = { status: "success" | "error"; message: string }
// inside: const { decision, admin } = await requireAccess("…")
// admin = service-role SupabaseClient
```

### 1.16 Migration timestamps

Most recent: `20260505100000_messaging_unread_simplification.sql`. Next slots **`20260512XXXXXX`+**.

### 1.17 State machine reference — `Claude Docs/state-machines.md`

- Soft-hold expiry pseudo-SQL: L61-77.
- Review publish precondition: L103-107 ("no open/investigating dispute" is a top-level prerequisite).
- Dispute → reviews behavior: L108-110 ("clear `published_at`, do not just set `suppressed_for_dispute`").
- Dispute filing window: L19 (7 days from `completed_at`).

### 1.18 `guard_supplier_verification` trigger — `supabase/migrations/20260504010000_guard_supplier_verification_service_role.sql:20-24`

Only blocks `suppliers.verification_status` changes by non-service-role. **Does NOT block payment column writes** — safe to write payment columns via standard server actions.

---

## Phase 4 — Implementation slices (revised post-review)

### Slice 1 — pg_cron foundation, narrowed (days 1-2)

**Scope reduced per opencode §3, §5:** only `expire_soft_holds` + `auto_mark_completed` here. Review/dispute cron jobs ship inside their feature slices.

**Files to create**
- `supabase/migrations/20260512100000_lifecycle_cron_jobs.sql`

**Migration contents**
- Function `public.expire_soft_holds()` — implements `state-machines.md:61-77`: find expired `soft_hold` blocks → cancel `awaiting_supplier` bookings → release blocks → return quotes to `'sent'`. Fan-out notifications via service-role client. `SECURITY DEFINER` + `set search_path = public, pg_catalog`.
- Function `public.auto_mark_completed()` — bookings where `confirmation_status='confirmed' AND service_status='scheduled' AND <event.ends_at> < now() - interval '24h'` → set `service_status='completed'`, `completed_at=now()`. Set review `window_closes_at = completed_at + interval '14 days'` will be derived at review-submission time from `bookings.completed_at` (opencode §4 — server-side computation only, never `now() + 14d` from submission).
- `cron.schedule('expire-soft-holds', '*/5 * * * *', ...)` and `cron.schedule('auto-mark-completed', '0 * * * *', ...)`.
- Grants: verify locally what role pg_cron uses on this stack (NOT the assumed `cron` role) and grant only that role + `service_role`.

**Verify**
- SQL test: seed expired soft-hold + 25-h-ago confirmed scheduled booking → call each function explicitly → assert correct state.
- Run again → assert idempotent.

### Slice 2 — Contract PDF pipeline (days 2-4)

**Dependencies**
- `@react-pdf/renderer`.

**Files to create**
- `src/lib/contracts/ContractDocument.tsx` — React-PDF component rendering from a `QuoteSnapshot` + booking context. Bilingual via `locale` prop. Renders: parties, event details, line items table, totals, VAT, payment schedule, deposit %, cancellation terms, inclusions/exclusions, **content_hash footer** for verifiability. Loads Almarai font for ar; default for en.
- `src/lib/contracts/renderContract.ts` — `renderContract(input): Promise<Uint8Array>` via `renderToBuffer`.
- `src/lib/contracts/uploadAndPersist.ts` — deterministic path `contracts/{bookingId}/{accepted_quote_revision_id}.pdf` (opencode §3 — include revision id in path for immutability); uploads with `contentType: 'application/pdf'` and `upsert: false`; if upload errors with "already exists," reads existing object via `download()` to recover; persists `bookings.contract_pdf_path`.
- `src/app/(organizer)/organizer/bookings/[id]/get-contract-url.ts` (action) — 1-h signed URL after asserting caller is organizer of booking.
- `src/app/(supplier)/supplier/bookings/[id]/get-contract-url.ts` (action) — same for supplier.

**Files to edit**
- `src/app/(supplier)/supplier/bookings/[id]/actions.ts` `confirmBookingAction`:
  - After RPC success, load revision + parties + event.
  - Call `renderContract` + `uploadAndPersist` inside a `try/catch`.
  - On render failure: **leave `contract_pdf_path = NULL` so re-render can recover; fire admin notification `contract.render_failed`; return success to user (booking IS confirmed legally) with a soft "contract generation queued" message.** Idempotent retry path: a "retry contract render" admin action checks `contract_pdf_path IS NULL` and re-runs.
  - **Revalidate AFTER the upsert** so `BookingActions.useActionState` triggers re-render with the new path visible (opencode §4).
- `src/app/(organizer|supplier)/.../bookings/[id]/page.tsx` — `<ContractDownloadButton>` rendered when `contract_pdf_path !== null`.

**Migration to add**
- `supabase/migrations/20260512110000_contracts_party_read_rls.sql` — extend `storage.objects` policies for `bucket_id='contracts'`: organizer + supplier of the matching booking can SELECT objects whose `name` starts with `{bookingId}/`. Drop+recreate by the CURRENT policy names (defined in `20260505010000_p1_rls_initplan_sweep.sql:502-511`), not the original names from `20260504000000`.

**Verify**
- Local: confirm booking → PDF appears in storage → both parties download → unrelated user 403 → admin downloads.
- Re-run a failed render via admin action → second run produces the same path; no duplicate objects.
- Extract PDF text → contains the booking's total in SAR and the snapshot's `content_hash`.

### Slice 3 — Review submission + publication (days 4-7)

Effort revised to **~3 days** (was 2; opencode §6).

**Files to create**
- `src/lib/domain/reviews.ts` — Zod (`ReviewInput`, `RatingsInput`); helpers: `reviewWindowFor(booking)` (returns `completed_at + 14d`), `canReview(booking, viewerProfileId, existingReview, openDisputeCount)`. **Window derived from `bookings.completed_at`, not from submission time** (opencode §4).
- Shared server helper `src/lib/domain/reviews.server.ts` — `resolveReviewContext(bookingId, viewerProfileId)` returns `{ role, reviewee_profile_id, window_open, has_existing, dispute_open }` so both organizer and supplier actions share authorization (opencode §3).
- `src/app/(organizer)/organizer/bookings/[id]/review/page.tsx` + `actions.ts`
- `src/app/(supplier)/supplier/bookings/[id]/review/page.tsx` + `actions.ts`
- `src/components/reviews/RatingPicker.tsx` (small client component for radio interaction).

**Migration to add**
- `supabase/migrations/20260512120000_publish_reviews_cron.sql` — function `public.publish_pending_reviews()` predicate **fixed per opencode §1, §3** to:
  ```
  no open/investigating dispute for booking
   AND (both parties submitted OR window_closes_at < now())
   AND published_at IS NULL
  ```
  Schedule: hourly.

**Files to edit**
- `src/lib/notifications/inApp.ts` — add `'review.requested' | 'review.submitted' | 'review.published'`.
- `src/app/(organizer|supplier)/.../bookings/[id]/page.tsx` — gate "Leave a review" CTA on `service_status='completed' AND no_open_dispute AND window_open AND no_existing_review_by_viewer`.
- Booking LIST page queries — load `service_status` so list CTAs render.
- `src/messages/{en,ar}.json` — review keys (`reviews.leaveReview`, `reviews.dimensions.*`, etc.).

**Verify**
- Both parties submit → publish cron tick → both appear on `/s/[slug]`.
- Duplicate submission rejected by unique constraint.
- Dispute opened between submission + publish (Slice 4 must clear `published_at` on open) → publish cron does NOT re-publish while dispute open.

### Slice 4 — Disputes: open + evidence + admin workspace (days 4-9)

Effort revised to **~5 days** (was 4; opencode §6). Parallels Slice 3 across two streams: stream A = DB/RLS/storage/state-machine effects, stream B = UI/actions.

**Migrations to add**
- `supabase/migrations/20260512130000_dispute_evidence_bucket.sql` — `dispute-evidence` bucket (private). Per opencode §3: storage policies allow SELECT by booking parties; **INSERT is service-role only** (Server Actions resolve party access before uploading). Path layout: `dispute-evidence/{dispute_id}/{submitter_profile_id}/{ts}-{safe_name}`.
- `supabase/migrations/20260512140000_dispute_open_close_triggers.sql` —
  - On dispute INSERT with status in (`'open'`, `'investigating'`): set `bookings.service_status='disputed'`; **clear `reviews.published_at` for that booking** (opencode §1, §3); leave `suppressed_for_dispute` as a denormalized convenience flag.
  - On dispute UPDATE to `'resolved'` or `'closed'` AND no other open/investigating dispute for the booking: set `bookings.service_status='completed'` (if it was `'disputed'`); flip `reviews.suppressed_for_dispute=false`; the next publish cron tick re-publishes reviews that meet conditions.
- `supabase/migrations/20260512150000_close_stale_disputes_cron.sql` — function `public.close_stale_disputes()`: disputes in `'open'`/`'investigating'` older than 30d → set `'closed'` with auto-resolution note (`{auto_closed: true, reason: 'stale_window'}`). Schedule: hourly.

**Files to create**
- `src/lib/domain/disputes.ts` — Zod (`OpenDisputeInput`, `EvidenceInput`); helpers: `canOpenDispute(booking, viewerProfileId, now)` enforces 7-day window from `bookings.completed_at` (opencode §4 — server-action gate, not a cron); `REASON_CODES` list.
- `src/lib/domain/disputes.server.ts` — shared `resolveDisputeContext(disputeId, viewerProfileId)` for evidence + read paths.
- `src/app/(organizer)/organizer/bookings/[id]/dispute/page.tsx` + `actions.ts` — open + submit evidence.
- `src/app/(supplier)/supplier/bookings/[id]/dispute/page.tsx` + `actions.ts` — same.
- `src/app/(admin)/admin/(monitor)/disputes/page.tsx` + `[id]/page.tsx` + `[id]/actions.ts` — list (status filter), detail (booking timeline + accepted revision + evidence panel + resolution form), `resolveDisputeAction`, `closeDisputeAction`, `addAdminNoteAction`.
- `src/components/disputes/EvidenceUploader.tsx` (client component, drag-drop; upload happens via Server Action with service-role client — not direct client-to-bucket).

**Files to edit**
- `src/app/(admin)/admin/(monitor)/_components/MonitorTabs.tsx` — add "Disputes" tab.
- `src/lib/notifications/inApp.ts` — add `'dispute.opened' | 'dispute.evidence_submitted' | 'dispute.resolved' | 'dispute.closed'`.
- `src/messages/{en,ar}.json` — dispute keys.

**Verify**
- Open dispute on completed booking within 7d → accepted; outside 7d → rejected with friendly error.
- Both submit evidence (file + note) → admin sees full context with booking timeline + accepted revision.
- Admin resolves → `bookings.service_status` restored to `'completed'` → next publish cron tick re-publishes any reviews that pass conditions.
- Opening a dispute clears `published_at` on existing reviews (visible on `/s/[slug]` immediately).

### Slice 5 — Mutual payment-state — **CUT, design preserved for follow-up sprint**

> Not implementing this sprint. Design below kept verbatim so the next sprint can pick it up without re-planning.

Effort revised to **~2-2.5 days** (was 4; opencode §6).

**Migrations to add**
- `supabase/migrations/20260512160000_booking_payment_audit_columns.sql` — add to `bookings`: `payment_deposit_sent_at`, `payment_deposit_sent_by`, `payment_deposit_received_at`, `payment_deposit_received_by`, `payment_balance_sent_at`, `payment_balance_sent_by`, `payment_balance_received_at`, `payment_balance_received_by`. **No trigger to advance enum** (opencode §3). State transitions live in server actions.

**Files to create**
- `src/lib/domain/payments.ts` — `nextStep(currentStatus)`, `canMarkSent(viewerRole, status)`, `canConfirmReceived(viewerRole, status)`. Pure functions; reused by both actions.
- `src/app/(organizer)/organizer/bookings/[id]/payment-actions.ts` — `markDepositSentAction`, `markBalanceSentAction`. Each action: load booking, gate on role + monotonic state + no cancellation, write timestamp + actor columns AND update `payment_status` enum to the matching coarse value, fire notification, revalidate.
- `src/app/(supplier)/supplier/bookings/[id]/payment-actions.ts` — `confirmDepositReceivedAction`, `confirmBalanceReceivedAction`. Same shape; only flips `payment_status` once the supplier confirms receipt.

**Files to edit**
- `src/app/(organizer|supplier)/.../bookings/[id]/page.tsx` — render 2-step ladder UI showing each step's actor + timestamp; CTAs gated on viewer role + monotonic step.
- `src/lib/notifications/inApp.ts` — add `'payment.sent' | 'payment.received'`.

**Verify**
- Organizer "sent deposit" → supplier sees pending → supplier "received" → `payment_status='deposit_paid'` → repeat for balance → final `'paid'`.
- Notifications fire to the other side on every flip.
- Attempting "received" before matching "sent" rejected with explicit error.

### Slice 6 (stretch) — Playwright happy path + dispute path (days 9-10)

Only if Slices 1-5 land on schedule. Estimate 1.5-2 days.

---

## Sequencing graph (locked)

```
Day 1-2:   [Slice 1: cron foundation — soft-hold expiry + auto-complete]
Day 2-4:   [Slice 2: contract PDF pipeline + party-read RLS]
Day 4-7:   [Slice 3: reviews]            [Slice 4 stream A: DB/storage/state-machine] (parallel)
Day 7-9:   [Slice 4 stream B: UI + admin workspace]
Day 9-10:  [Slice 6 stretch: Playwright happy path + dispute path]
```

Hard serial dependencies (opencode §5):
- Slice 4 stream A (`dispute → service_status='disputed'`, clear `published_at`) **must land before** Slice 3's publish cron is trusted in production.
- Slice 2's contracts party-RLS migration must reference policy names from `20260505010000_p1_rls_initplan_sweep.sql:502-511`, not the original migration.

With Slice 5 cut, day-7-to-9 carries only Slice 4 stream B — comfortable margin for unexpected blockers, and Slice 6 (Playwright) is realistic, not stretch-only.

---

## Risks (revised)

1. **`@react-pdf/renderer` Arabic font support** — verify Almarai glyphs render on the Node 20 production runtime; fall back to embedded font.
2. **PDF render time inside Server Action** — start inline; if measured >2s, queue to a `LISTEN/NOTIFY` worker (opencode §7).
3. **pg_cron role grants** — repo has no `cron` role; verify EXECUTE grant target locally before committing the migration.
4. **Dispute trigger semantics** — clearing `published_at` is the correct mechanism per state machine; we must NOT regress this when the publish cron runs (predicate must exclude rows whose booking has any open/investigating dispute).
5. **Booking list query extensions** — adding `service_status` to existing list queries means touching organizer + supplier + admin list pages; risk of forgetting one.
6. **App tunnel** — production E2E blocked until `seventsa.com` responds.
7. **Tight scope vs. cut** — see Scope Decision; if user opts to keep all 5 features, parallel streams + stretch test cut are mandatory.

---

## Verification (sprint acceptance criteria)

End-to-end on local stack (and on `seventsa.com` once the app tunnel is back up):

1. ✅ Booking proceeds RFQ → quote → accept → confirm → PDF on both parties' detail pages → both download → unrelated user 403.
2. ✅ Completed booking allows both sides to submit one review each; publication cron publishes when both submit OR window closes, **provided no open dispute**; reviews appear on `/s/[slug]`.
3. ✅ Dispute opens → both submit evidence → admin sees full context + resolves → `service_status` flips correctly; reviews clear `published_at` on open, re-publish on resolve.
4. ✅ Payment cycle (if kept): organizer-sent → supplier-received × 2 steps; enum advances; notifications fire.
5. ✅ Lifecycle SQL test: each function runs idempotently against seeded fixtures.
6. ✅ All new server actions return `{ status, message }`; all new pages have `loading.tsx`; new notification kinds appear in inbox.

---

## Sprint+1 preview (titles only, for memory)

- Compliance & Hardening sprint: lawyer-approved Terms/Privacy text, organizer consent checkbox, `__TEMP_AWAITING_LEGAL__` sentinel removal, required-doc gating, GEA approval status check.
- Pilot dry-run with 2-3 friendly suppliers, blocker fixes only.
- Playwright golden paths + RLS matrix (if not stretched into this sprint).
- External pentest remediation.
- Pilot-supplier "claim profile" workflow.

---

## After approval

Once the user approves and exits plan mode:
1. **Mirror this file** into `Claude Docs/plans/sprint-pilot-closure-features.md` so the durable execution plan lives with the project (opencode §7).
2. **Diagnose the app tunnel** (`seventsa.com` ECONNREFUSED) — ssh + `pm2 status sevent` / `systemctl status sevent` + `cloudflared` config check. Not a coding task, but blocks production E2E.
3. **Open the TaskCreate task list** matching the 5-slice structure (1-4 + stretch tests).
4. **Start Slice 1** (cron foundation) — independent of the tunnel, can run on local stack first.

---

*Plan author: Claude (this session) with senior-engineer review from opencode gpt-5.5 plan-agent. Last updated: 2026-05-12 after Phase 1 + Phase 2 (review).*
