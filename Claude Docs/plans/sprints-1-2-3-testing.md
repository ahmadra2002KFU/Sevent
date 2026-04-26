# Sevent — Sprint 1+2+3 intensive testing log

**Date:** 2026-04-16
**Purpose:** Capture findings, in-session fixes, and platform quirks from the live organizer → supplier → admin walkthrough so a solo dev (or future collaborator) can re-enter the project before Sprint 4 without re-learning the gotchas.

---

## 1. Context

- **Session date:** 2026-04-16.
- **Stack under test:** Next.js 16.2.3 (webpack, not Turbopack), self-hosted Supabase running locally via Supabase CLI on `127.0.0.1:54321` (API), with Studio on `:54323` and Mailpit on `:54324`. Database seeded via `pnpm db:reset && pnpm seed`.
- **Branch HEAD entering the session:** `88416f2` — Sprint 3 code-complete, pre-live-testing.
- **Session goal:** walk every Sprint 1+2+3 flow end-to-end against a real DB — public browse, auth, organizer dashboard, event CRUD, RFQ wizard + send, supplier inbox, admin queue, emails — and fix anything that broke under real use before Sprint 4 starts.

---

## 2. Setup snapshot

### Ports

| Port  | Service                 |
|-------|-------------------------|
| 54321 | Supabase API (PostgREST + GoTrue + Storage) |
| 54322 | Postgres                |
| 54323 | Supabase Studio         |
| 54324 | Mailpit (SMTP inbox)    |
| 3000  | Next.js dev server      |

### `.env.local` shape (keys, not values)

| Key | Purpose | Format note |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | API base URL | `http://127.0.0.1:54321` in dev |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key | New `sb_publishable_*` format (not legacy JWT) |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key for server-only code | New `sb_secret_*` format (not legacy JWT) |
| `APP_URL` | Used in email links + auth redirects | `http://localhost:3000` in dev |
| `GMAIL_APP_PASSWORD` | SMTP password for transactional mail | Gmail app-password, not account password |

### Seed output

`pnpm seed` (after `pnpm db:reset`) produces: 1 admin, 2 organizers, and 25 suppliers. The first 8 suppliers are both `status='approved'` and `is_published=true`; the remaining 17 are seeded as draft/pending for use in the admin verifications queue.

Approved-supplier → subcategory → min_qty reference (for auto-match testing):

| # | Supplier                 | Subcategory          | City    | min_qty (packages) |
|---|--------------------------|----------------------|---------|--------------------|
| 1 | Riyadh Grand Ballroom    | venue-ballroom       | Riyadh  | 1                  |
| 2 | Olive Garden Venue       | venue-outdoor        | Riyadh  | 1                  |
| 3 | Capital Conference Hall  | venue-conference     | Riyadh  | 1                  |
| 4 | Sufra Catering           | catering-buffet      | Riyadh  | 50, 100            |
| 5 | Chef's Table             | catering-plated      | Riyadh  | 1                  |
| 6 | Qahwa House              | catering-coffee      | Riyadh  | 1                  |
| 7 | Lens Studio              | photo-wedding        | Riyadh  | 1                  |
| 8 | Corporate Shots          | photo-corporate      | Riyadh  | 1                  |

---

## 3. Issues found and fixes landed in-session

| # | Symptom | Root cause | Commit |
|---|---|---|---|
| 1 | next-intl `INVALID_KEY` thrown from `RootLayout`, surfacing as a 500 on any Server Action | Flat dotted key `"supplier.rfqInbox"` in `messages/{en,ar}.json` — next-intl expects nested namespaces, not dotted strings | `173d98e` |
| 2 | `auth.uid()` evaluated to null inside PostgREST RLS during Server Actions even though `auth.getUser()` returned the user | `@supabase/ssr@0.10.2` + new `sb_publishable_*` key format: the JWT was identified correctly but not forwarded as the `Authorization` header on the PostgREST call, so the RLS self-read of `profiles` returned zero rows | `b7e0701` |
| 3 | Service-role client's writes were still being rejected by RLS | `createSupabaseServiceRoleClient` used `@supabase/ssr`'s `createServerClient` with user cookies attached, so PostgREST preferred the cookie-borne user JWT over the service-role key. Switched to plain `@supabase/supabase-js` `createClient` with `persistSession=false` and no cookie handler | `4ef2942` |
| 4 | supplier-1 could reach `/organizer/events` — proxy role gate was open-by-default | Same user-cookie RLS desync as #2 meant `actualRole` came back null, and `if (actualRole && …)` fell through instead of denying. Rewrote to read role via the service-role client and fail-closed on missing profile | `2025c51` |
| 5 | `/supplier/dashboard` still showed the Sprint-1 stub | Real content never landed in Sprint 2/3 scope. Replaced with summary card, verification badge, invites preview, upcoming bookings empty state, and an onboarding CTA | `6d44043` |
| 6 | `sendRfqAction` hung with Postgres "stack depth limit exceeded" (infinite RLS recursion) | `rfq_invites.organizer write` WITH CHECK joins `rfqs`, and `rfqs.invited supplier read` USING joins `rfq_invites` — policy evaluation recursed forever. Routed the two writes through service-role after explicit organizer-ownership check in app code. Defer proper fix to a `send_rfq_tx` SECURITY DEFINER RPC (Sprint 4/6) | `fbddbc7` |
| 7 | Landing page nav only had sign-in/up — no way for a visitor to reach `/categories` | `src/app/(public)/page.tsx` omitted the Browse link. Added, using the pre-existing `nav.browse` i18n key. Grouped with #6 | `fbddbc7` |
| 8 | `/admin/dashboard` was still the Sprint-1 `<h1>Admin dashboard</h1>` stub | Never upgraded. Replaced with verification-queue preview, RFQ monitor, supplier status tiles, and notifications stream | `fbddbc7` |

All eight fixes verified against `git log --oneline main`. #6, #7, #8 were grouped into `fbddbc7`.

---

## 4. What's working (confirmed during the walk)

- **Public browse.** `/categories` renders the 8 parent cards; `/categories/[parent]?city=Riyadh` renders approved suppliers with the city filter applied.
- **Auth.** Sign-in and sign-up work for both roles; post-login redirect lands on the correct role dashboard (organizer → `/organizer/dashboard`, supplier → `/supplier/dashboard`).
- **Organizer dashboard.** Stats cards + upcoming events list populate from real data.
- **Event CRUD.** Create/edit/delete round-trips cleanly; budget fields convert SAR → halalas via `sarToHalalas` and back.
- **RFQ wizard.** All 4 steps behave: (1) event + category pick, (2) extension block rendered per subcategory, (3) auto-match shortlist with scoring, (4) review + send. Send fires invites and redirects.
- **Supplier inbox.** `/supplier/rfqs` lists incoming invites; decline action works and hides the row.
- **Sprint 2 carryovers.** Supplier calendar, catalog (packages + pricing rules), onboarding wizard, and public `/s/[slug]` page all render correctly with seed data.
- **Admin verifications.** Queue at `/admin/verifications` lists pending suppliers; approve and reject both work and fire email.
- **Email.** Mailpit at `:54324` captures every outbound email (supplier approved, supplier rejected, etc.).
- **Tests.** 16 Vitest tests pass — 1 money smoke + 15 auto-match cases.
- **Static quality.** Typecheck and lint are clean.

---

## 5. Known data-alignment caveats

- **Approved-supplier coverage is narrow by design.** Only 8 of 25 seeded suppliers are `approved + published`, and they cover just 8 subcategories: `venue-ballroom`, `venue-outdoor`, `venue-conference`, `catering-buffet`, `catering-plated`, `catering-coffee`, `photo-wedding`, `photo-corporate`. All 8 are Riyadh-based.
- **Any other subcategory or city returns 0 auto-match results.** This is correct, not a bug. To test Jeddah, decor, entertainment, florals, etc., first approve more suppliers via the admin verifications queue (the other 17 seeded suppliers cover those categories).
- **Qty-range filter is real and will silently exclude.** Supplier-4 (Sufra Catering) has packages with `min_qty=50` and `min_qty=100`. An event with `guest_count=20` will filter Sufra out — correct behavior. Use `guest_count ≥ 50` when testing catering-buffet auto-match.

---

## 6. Environment / platform caveats

- **`pnpm exec next build` fails on the D:\ drive.** exFAT filesystem + webpack's `readlink` implementation hits EISDIR. Dev server (`pnpm dev --webpack`) works fine. Production builds must run on Linux or NTFS — WSL2, a native Ubuntu host, or CI. Deferred to Sprint 6.
- **Turbopack is disabled.** Both `dev` and `build` scripts pass `--webpack` for the same exFAT reason. Do not remove the flag without re-testing on the D:\ drive.
- **`scripts/seed-users.ts` reads `.env`, not `.env.local`.** Either `export NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… && pnpm seed` inline, or patch the script to `config({ path: '.env.local' })`. This cost time this session — fix it before the next seed cycle.
- **Agent `isolation: "worktree"` is unavailable in the current harness** (no `WorktreeCreate` hook registered). Sprint 3 lanes therefore ran sequentially. Sprint 4 should either land the hook or continue sequential planning.
- **`pnpm test` sometimes fails with `spawn EPERM`.** Windows AV / file-permission transient on Vitest's worker spawn. Usually passes on retry. Not a code issue; do not chase it.

---

## 7. Deferred / carried forward

- Google Places Autocomplete (plan.md Sprint 6).
- Pricing engine + Distance Matrix cache (Sprint 4).
- Booking state machine, incl. `accept_quote_tx` RPC with soft-hold → booked transition (Sprint 4).
- Proper `send_rfq_tx` SECURITY DEFINER RPC to replace the service-role workaround in `sendRfqAction` (Sprint 4 or 6).
- Admin RFQ detail page — the dashboard's RFQ rows are read-only previews and don't link to detail (plan.md Sprint 5).
- Arabic translation pass beyond stubs (v1.1).
- Sign-up role pre-select via `?role=organizer|supplier` query param — one-line plumbing, noted but deferred.

---

## 8. Sprint 4 kickoff rituals

Before writing any Sprint 4 code:

1. `pnpm db:start` (Docker Desktop must be running) and confirm the four ports in §2 are listening.
2. `pnpm db:reset && export NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… && pnpm seed`.
3. Walk the smoke path: landing → `/categories` → sign in as `organizer1` → create an event → send an RFQ → sign in as `supplier-5` → see the invite → decline it. All green means Sprint 1+2+3 are intact on the current HEAD.
4. Re-read the Sprint 4 section of `Claude Docs/plans/sprints.md` and all of `Claude Docs/pricing-examples.md` before touching code.
5. Start Sprint 4 with the Vitest pricing-engine test matrix — spec first, engine second. The 13 deterministic cases in `pricing-examples.md` are the acceptance bar.
