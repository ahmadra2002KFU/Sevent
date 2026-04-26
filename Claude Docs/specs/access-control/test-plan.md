# Access Control — Integration Test Plan

**Reader:** AI agent performing end-to-end verification.
**Target:** `D:/Mufeed/Sevent/Code` (this repo).
**Date authored:** 2026-04-22.
**Scope:** verify the access-control refactor described in `Claude Docs/specs/access-control/analysis.md` — 10 findings from CRITICAL to LOW across middleware, sign-in, supplier surfaces, organizer surfaces, and onboarding.

You are the second agent. The first agent wrote the code + applied migrations. Your job is to run the app and confirm the fixes actually work end-to-end. No code changes unless a bug is found — then stop and report.

---

## 0. Orient

### 0.1 What changed (so you know what to test)

One shared resolver at `src/lib/auth/access.ts` now computes an `AccessDecision` (role + 11-state supplier state machine → feature flags + `bestDestination` + `allowedRoutePrefixes`). Every caller reads from the same file: middleware (`src/proxy.ts`), sign-in action, `TopNav`, supplier/organizer layouts, every page loader, every server action. State → features in `src/lib/auth/featureMatrix.ts`.

Key behavioral changes vs. before the refactor:

1. **Sign-in `next` param is sanitized.** Off-origin URLs, `javascript:`, `//evil.com`, paths outside the user's role prefix are rejected → user falls back to `decision.bestDestination`.
2. **Agency role is admitted at `/organizer/*`.** No more redirect loop between proxy and page-level `requireRole`.
3. **Supplier state gates are real.** Pending / rejected / in-onboarding suppliers cannot reach `/supplier/catalog`, `/supplier/calendar`, `/supplier/bookings`, `/supplier/rfqs`, `/supplier/profile`. Nav items for those surfaces are filtered out of `TopNav`. Direct URL hits redirect.
4. **Approved suppliers cannot re-open the path picker** (`/supplier/onboarding/path`) — would overwrite `legal_type`.
5. **Organizer pages that previously skipped `requireRole` now gate via `requireAccess("organizer.events"|"organizer.rfqs"|…)`.**
6. **Onboarding step 2 is atomic** — `delete + insert` on `supplier_categories` replaced with one RPC call `replace_supplier_categories`.
7. **Rejected supplier** sees a read-only dashboard + resubmission CTA. All other supplier surfaces blocked.
8. **Dead code removed** — agency is no longer in the sign-up role enum.

### 0.2 What did NOT change (don't waste time re-testing these; if they break, it's a regression bug)

- Admin UI at `/admin/*` (except that admin still has godmode — can access any supplier/organizer surface).
- Session revocation on role demotion — **deliberately out of scope for this patch** (known gap; admin approve/reject doesn't kick the supplier's active session).
- RLS tightening on `packages`, `pricing_rules`, `availability_blocks`, `supplier_docs` INSERT/UPDATE — **out of scope** (application-layer gates catch it; RLS is the deferred follow-up).
- Supabase SSR user-JWT forwarding bug — unchanged; callers still use `authenticateAndGetAdminClient()` pattern via the admin client in the resolver.

---

## 1. Environment

### 1.1 Prerequisites (should already be true)

- **Node/npm** installed; run from `D:/Mufeed/Sevent/Code`.
- **Supabase local** is running. Verify:
  ```bash
  npx supabase status
  ```
  Expected: "supabase local development setup is running" + Studio at `http://127.0.0.1:54323` + Mailpit at `http://127.0.0.1:54324`.
- **Migrations applied.** Verify:
  ```bash
  npx supabase migration list --local
  ```
  Every row in the output should have BOTH `Local` and `Remote` columns populated (same timestamp). The most recent timestamp should be `20260504010000`.
- **Dev server** running on `http://localhost:3000`. Verify: `curl -sI http://localhost:3000 | head -1` → `HTTP/1.1 200 OK`. If not running, start with `npm run dev` in the repo root.

### 1.2 Tools you have

- **Chrome MCP** tools: load via `ToolSearch select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__form_input,mcp__claude-in-chrome__find,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__get_page_text,mcp__claude-in-chrome__read_console_messages,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__read_network_requests,mcp__claude-in-chrome__gif_creator`. Use `tabs_context_mcp` first.
- **psql** via `npx supabase db ...` or direct `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.
- **Supabase Studio** at `http://127.0.0.1:54323` — SQL editor + table browser + Auth → Users + Storage.
- **Mailpit** at `http://127.0.0.1:54324` — catches dev sign-up confirmation emails. Every sign-up creates a confirmation email you must click to activate the user.

### 1.3 Test accounts

The repo has a seed script. Run it to create baseline users:
```bash
npm run seed
```
(This runs `tsx scripts/seed-users.ts`. Read that script before running if you want to know what credentials it creates.)

You will also need to **create new accounts during testing** — specifically one fresh supplier to walk through the state machine. Use disposable email addresses like `test-YYYYMMDD-HHMM-supplier@example.com` so you can re-run the suite.

**Admin simulation** — instead of logging in as admin to approve/reject via `/admin/verifications`, you may directly flip the DB row. Both paths test the supplier-side code (which is what matters). Direct SQL is faster and more reliable for this test plan:

```sql
-- Approve a supplier by their profile email:
update public.suppliers
set verification_status = 'approved',
    verified_at = now(),
    is_published = true
where profile_id = (
  select id from auth.users where email = 'test-YYYYMMDD-HHMM-supplier@example.com'
);

-- Reject:
update public.suppliers
set verification_status = 'rejected',
    verification_notes = 'Test rejection — documents unclear',
    verified_at = null,
    is_published = false
where profile_id = (
  select id from auth.users where email = 'test-YYYYMMDD-HHMM-supplier@example.com'
);
```

Run these via Supabase Studio's SQL editor at `http://127.0.0.1:54323/project/default/sql/new`.

---

## 2. Test execution protocol

Work phase-by-phase. Do not skip ahead. Each test case has:

- **ID** — reference in your final report (e.g., `P1-04`).
- **Pre** — state that must hold before the test runs.
- **Do** — the action.
- **Expected** — what must happen for PASS.
- **Fail signals** — what to look for if the fix is broken.
- **Evidence** — what to capture in your report.

For each case, record `PASS`, `FAIL`, or `BLOCKED` (e.g., if prerequisite unmet) with a one-line note. Capture browser console errors every time you switch tests — a silent 500 looks the same as a passing test.

**Golden rule for failures:** if a fail signal fires, stop the phase, capture evidence (page text, console, network tab for the failing request, current URL), and move on to the next phase. Do not try to fix — report only.

---

## 3. Phase 1 — Security fixes (CRITICAL)

These close the findings the analysis flagged as CRITICAL. If any fail, the refactor is not done.

### P1-01 · `next` param: reject off-origin URL

- **Pre:** Signed out. Chrome tab on any URL.
- **Do:** Navigate to `http://localhost:3000/sign-in?next=https://evil.com`. Sign in with a known organizer account.
- **Expected:** Redirected to `http://localhost:3000/organizer/dashboard` (or the user's role home). **Not** to `evil.com`.
- **Fail signal:** Browser navigates to `https://evil.com/` — resolver's sanitizer is broken.
- **Evidence:** final URL after sign-in redirect.

### P1-02 · `next` param: reject protocol-relative

- **Pre:** Signed out.
- **Do:** Navigate to `http://localhost:3000/sign-in?next=//evil.com`. Sign in with any valid account.
- **Expected:** Lands on role-home on the same origin. Not `//evil.com`.
- **Fail signal:** URL becomes `http://evil.com/...`.

### P1-03 · `next` param: reject cross-role

- **Pre:** Signed out.
- **Do:** Navigate to `http://localhost:3000/sign-in?next=/admin/dashboard`. Sign in with a **supplier** account (non-admin).
- **Expected:** Lands on `/supplier/dashboard` (or the resolver's `bestDestination` for that supplier's state — see phase 2).
- **Fail signal:** Lands on `/admin/dashboard` (or gets redirected mid-render looking glitchy).

### P1-04 · `next` param: accept valid in-role path

- **Pre:** Signed out. You have an **approved** supplier account (create and approve via Phase 2 first if needed, or use seed data).
- **Do:** Navigate to `http://localhost:3000/sign-in?next=/supplier/catalog`. Sign in as that approved supplier.
- **Expected:** Lands on `/supplier/catalog` and the page renders without errors.
- **Fail signal:** Redirected to `/supplier/dashboard` — sanitizer incorrectly rejected the valid path.

### P1-05 · `next` param: reject `javascript:` scheme

- **Pre:** Signed out.
- **Do:** Navigate to `http://localhost:3000/sign-in?next=javascript:alert(1)`. Sign in with any account.
- **Expected:** Lands on role-home. No alert fires.
- **Fail signal:** Alert dialog opens OR URL bar shows `javascript:`.

### P1-06 · Middleware gates supplier pages by state

- **Pre:** Signed in as a **pending** supplier (has suppliers row, `verification_status='pending'`). Create one via Phase 2 P2-01 through P2-07 first if you don't have one.
- **Do:** Type `http://localhost:3000/supplier/catalog` into the address bar and press Enter.
- **Expected:** 302 or in-app redirect to `http://localhost:3000/supplier/dashboard`. Page body renders the `PendingReviewChecklist`.
- **Fail signal:** Catalog page renders its form or its "complete onboarding" error card — gate is broken.
- **Evidence:** final URL + first heading on page.

### P1-07 · Middleware gates: calendar/bookings/rfqs/profile

- **Pre:** Same pending supplier from P1-06.
- **Do:** One by one, navigate to:
  - `/supplier/calendar`
  - `/supplier/bookings`
  - `/supplier/rfqs`
  - `/supplier/rfqs/<any-uuid>`
  - `/supplier/profile`
- **Expected:** Each redirects to `/supplier/dashboard`.
- **Fail signal:** Any one of them renders.

### P1-08 · TopNav filters by feature for pending supplier

- **Pre:** Signed in as pending supplier, on `/supplier/dashboard`.
- **Do:** Inspect the top navigation bar.
- **Expected:** Only **Dashboard** and **Onboarding** items are visible. Catalog / Calendar / RFQs / Bookings / Profile are NOT in the nav.
- **Fail signal:** More than 2 labeled nav items appear (excluding the notification bell icon, logo, language switcher, user menu).
- **Evidence:** text content of all nav `<a>` items.

### P1-09 · Agency at `/organizer/*` — no redirect loop

- **Pre:** You need a user with `profiles.role = 'agency'`. If no seed covers this, create one:
  ```sql
  -- After sign-up as an organizer, flip their role in SQL:
  update public.profiles
  set role = 'agency'
  where id = (select id from auth.users where email = 'test-agency@example.com');
  ```
- **Do:** Sign in as that agency user. Visit `/organizer/dashboard` — should render. Then navigate to `/organizer/events/new`.
- **Expected:** `/organizer/events/new` page renders (the new-event form). No redirect. No loop.
- **Fail signal:** URL flickers between `/organizer/events/new` → `/organizer/dashboard` → back (loop), or redirected to `/`.
- **Evidence:** confirm page heading is "New Event" (or equivalent i18n) and the URL stays on `/organizer/events/new`.

### P1-10 · Organizer IDOR retrofit — cross-role access

- **Pre:** Signed in as a **supplier** (any state).
- **Do:** Navigate to `/organizer/events`.
- **Expected:** Middleware redirects to `/supplier/dashboard` (or wherever the supplier's bestDestination is).
- **Fail signal:** `/organizer/events` renders an (empty) page instead of redirecting.

### P1-11 · Onboarding path re-entry blocked for approved supplier

- **Pre:** Signed in as an **approved** supplier (complete Phase 2 first).
- **Do:** Navigate to `/supplier/onboarding/path` directly.
- **Expected:** Redirected to `/supplier/dashboard`.
- **Fail signal:** Path picker renders and lets you re-select legal_type.

---

## 4. Phase 2 — Supplier state machine (end-to-end)

Walk one supplier from sign-up to approved and to rejected. Use one fresh email (substitute `YYYYMMDD-HHMM` below with the current timestamp so tests are re-runnable).

### P2-01 · Fresh sign-up → no_row state

- **Pre:** Signed out. Fresh email `test-YYYYMMDD-HHMM-supplier@example.com`.
- **Do:** Go to `/sign-up/supplier`. Fill email, phone (use `501234567`), password (≥8 chars), check T&C, submit.
- **Expected:** Redirected to `/sign-in?confirm=1&role=supplier`. Mailpit has a new email with a confirmation link.
- **Evidence:** email subject line + confirmation link in Mailpit.

### P2-02 · Confirm email + sign in → lands on path picker

- **Do:** In Mailpit, click the confirmation link. Then on sign-in form, sign in with the new credentials.
- **Expected:** Lands on `/supplier/onboarding/path`. Page shows freelancer-vs-company choice. `TopNav` is NOT present (the onboarding layout is minimal).
- **Fail signal:** Lands on any other URL.

### P2-03 · `supplier.no_row` — direct dashboard URL bounces

- **Do:** While on path picker, try `/supplier/dashboard` directly.
- **Expected:** Redirected back to `/supplier/onboarding/path`.
- **Fail signal:** Dashboard renders (with missing data).

### P2-04 · Pick path → in_onboarding

- **Do:** On path picker, choose either "Freelancer" or "Company", submit.
- **Expected:** Lands on `/supplier/onboarding` (wizard step 1).
- **Fail signal:** 500 error, or redirects somewhere else.
- **Verify DB:**
  ```sql
  select id, legal_type, verification_status from public.suppliers
  where profile_id = (select id from auth.users where email = 'test-YYYYMMDD-HHMM-supplier@example.com');
  ```
  Expected: one row, `legal_type` = your choice, `verification_status` = 'pending'.

### P2-05 · Dashboard is read-only during in_onboarding

- **Do:** Navigate to `/supplier/dashboard` directly.
- **Expected:** Renders `PendingReviewChecklist`. Side-card "prepare your catalog" CTA is a **disabled button**, not a link. Clicking it does nothing.
- **Fail signal:** CTA is a real Link and navigates to `/supplier/catalog`.
- **Evidence:** HTML of the `<button>` or `<a>` for the CTA — should have `disabled` attribute.

### P2-06 · Path picker locked once legal_type set

- **Do:** From dashboard, try `/supplier/onboarding/path`.
- **Expected:** Redirected back to `/supplier/dashboard` (no_row state has ended; user is now in_onboarding).
- **Fail signal:** Path picker re-renders.

### P2-07 · Complete wizard steps 1 → 2 → 3 → pending_review

- **Do:** From `/supplier/onboarding`, fill wizard:
  - Step 1: representative name, business name, CR or National ID, base city, service area, languages.
  - Step 2: pick ≥1 subcategory + ≥1 market segment.
  - Step 3: upload a logo (small PNG), an IBAN PDF (any dummy PDF), optionally a company profile PDF.
- **Expected:** After step 3, wizard confirms submission. DB row now has `verification_status='pending'` + `supplier_docs` has the iban row + `supplier_categories` has ≥1 row.
- **Verify DB:**
  ```sql
  select (select count(*) from public.supplier_docs where supplier_id = s.id) as docs,
         (select count(*) from public.supplier_categories where supplier_id = s.id) as cats,
         s.verification_status
  from public.suppliers s
  where s.profile_id = (select id from auth.users where email = 'test-YYYYMMDD-HHMM-supplier@example.com');
  ```
  Expected: `docs >= 1`, `cats >= 1`, `verification_status = 'pending'`.
- **State is now `pending_review`.** TopNav still shows only Dashboard + Onboarding. P1-06 / P1-07 should still block direct catalog/calendar/bookings/rfqs/profile access — re-run one of them if unsure.

### P2-08 · Admin approve → supplier.approved

- **Do:** Via Supabase Studio SQL editor, run:
  ```sql
  update public.suppliers
  set verification_status = 'approved',
      verified_at = now(),
      is_published = true
  where profile_id = (select id from auth.users where email = 'test-YYYYMMDD-HHMM-supplier@example.com');
  ```
- **Back in the supplier browser**, hard-refresh `/supplier/dashboard` (Ctrl+Shift+R to bypass cache).
- **Expected:** `ApprovedCelebration` screen renders (first-time-approved branch). It has a large "You're verified!" hero. TopNav now shows the full set: Dashboard, Onboarding, Catalog, Calendar, RFQs, Bookings, Profile.
- **Fail signal:** Still renders pending checklist.
- **Evidence:** nav item count + heading text.

### P2-09 · Approved supplier can reach every feature

- **Do:** One at a time, click each TopNav item. Navigate to:
  - `/supplier/catalog`
  - `/supplier/calendar`
  - `/supplier/bookings`
  - `/supplier/rfqs`
  - `/supplier/profile`
- **Expected:** All render without error. Empty states are fine (new supplier has no packages / bookings / RFQs yet).
- **Fail signal:** Any of them redirects, 500s, or shows the "complete onboarding" message.
- **Evidence:** for each, capture URL + main heading.

### P2-10 · Admin reject → supplier.rejected

- **Do:** SQL:
  ```sql
  update public.suppliers
  set verification_status = 'rejected',
      verification_notes = 'Test rejection',
      verified_at = null,
      is_published = false
  where profile_id = (select id from auth.users where email = 'test-YYYYMMDD-HHMM-supplier@example.com');
  ```
- **Hard-refresh** `/supplier/dashboard`.
- **Expected:** Renders `PendingReviewChecklist` in rejected mode (red/warn styling, may include the rejection note). TopNav drops back to Dashboard + Onboarding only. Catalog CTA in the side-card is disabled.
- **Fail signal:** Still renders approved dashboard, or 500s, or nav still shows the full set.

### P2-11 · Rejected supplier cannot access any locked surface

- **Do:** Try each URL directly (re-run P1-06 and P1-07 equivalents):
  - `/supplier/catalog`
  - `/supplier/calendar`
  - `/supplier/bookings`
  - `/supplier/rfqs`
  - `/supplier/profile`
- **Expected:** All redirect to `/supplier/dashboard`.
- **Fail signal:** Any renders.

---

## 5. Phase 3 — Regression sweep

Non-access-control things that could have broken from the refactor. Use an **approved supplier** + an **organizer** account.

### P3-01 · Supplier: create + toggle + delete a package

- **Pre:** Signed in as approved supplier.
- **Do:** `/supplier/catalog` → click "New package" → fill form (name, category, base price, unit, min qty) → save. Then toggle active → save. Then delete.
- **Expected:** Row appears, toggle updates `is_active`, delete removes it. No console errors.

### P3-02 · Supplier: create + edit + delete availability block

- **Do:** `/supplier/calendar` → click "New block" → pick a future date range → save. Edit the block → save. Delete.
- **Expected:** Block appears, edits persist, delete removes it.

### P3-03 · Supplier: customize profile

- **Do:** `/supplier/profile` → change accent color → reorder sections → save.
- **Expected:** Save succeeds. Hard-refresh to confirm persistence.

### P3-04 · Organizer: create event

- **Pre:** Signed in as an organizer.
- **Do:** `/organizer/events/new` → fill event form → submit.
- **Expected:** Redirects to the event detail page. DB row present in `public.events`.

### P3-05 · Organizer: send an RFQ

- **Pre:** Event from P3-04 exists. ≥1 approved supplier in the matching subcategory (your P2 supplier qualifies if you picked a matching one).
- **Do:** From the event detail, start an RFQ. Pick a subcategory. Review auto-matches. Send.
- **Expected:** RFQ row appears + `rfq_invites` rows created + the chosen supplier gets a notification.

### P3-06 · Supplier: send a quote on the incoming RFQ

- **Pre:** Supplier from P2 is approved and is a match target. Sign in as them.
- **Do:** `/supplier/rfqs` → click the invite → Send Quote → fill form → submit.
- **Expected:** Quote is created, invite status becomes `quoted`, organizer gets a notification.

### P3-07 · Notifications bell render on every role

- **Do:** Sign in as supplier, check bell icon renders with badge count if any. Same for organizer. Same for admin.
- **Expected:** Icon + optional number badge. No console errors.

### P3-08 · Console is clean across the visit

- **Do:** Throughout phases 1–3, keep the DevTools Console tab open. Note every `ERROR`-level log.
- **Expected:** The only redirects in the log are `NEXT_REDIRECT` thrown by `requireAccess` — those are expected (Next.js framework signal). No uncaught promise rejections, no 5xx response logs, no missing-module errors, no React hydration mismatch warnings.
- **Fail signal:** Any console error that isn't `NEXT_REDIRECT`.
- **Evidence:** use `mcp__claude-in-chrome__read_console_messages` with `pattern: "error|uncaught|Warning: "` and report what comes back.

---

## 6. Reporting

### 6.1 Write your report to

`Claude Docs/specs/access-control/test-results.md`

### 6.2 Format

```markdown
# Access Control Test — Results

**Date:** YYYY-MM-DD HH:MM
**Tester:** <agent name/version>
**Commit:** <git rev-parse HEAD>
**Test user emails used:**
- Supplier: test-YYYYMMDD-HHMM-supplier@example.com
- Organizer: ...
- Agency: ...

## Summary
- Phase 1: N/11 passed
- Phase 2: N/11 passed
- Phase 3: N/8 passed
- Overall: PASS / FAIL

## Per-case results

### P1-01 `next`: off-origin URL
- Status: PASS / FAIL / BLOCKED
- Evidence: <final URL observed>
- Notes: ...

### P1-02 ...
...

## Failures (if any)

For each failed case:
- Case ID
- Reproduction steps taken
- Expected behavior (from plan)
- Actual behavior observed
- Console errors captured
- Network errors captured
- Current URL + page title
- Suspected root cause (1–2 sentences)
- Suggested next action

## Environment notes

Anything weird — slow responses, flaky behavior, Mailpit missing emails, etc.
```

### 6.3 Stop conditions

Stop and report immediately if any of these happen:

- Phase 1 has ≥2 failures → the core refactor isn't working; do not continue.
- Dev server returns 500 on any page more than once → framework-level issue; not worth further testing.
- Any DB query returns an unexpected shape (e.g., `suppliers` row missing columns we expect) → migration didn't fully apply.
- Chrome MCP connection drops and you can't recover after 2 attempts.

Otherwise: work every case, PASS/FAIL each, then return the final report path.

---

## 7. Quick reference — URL ↔ feature ↔ required state

Use this as a cheat-sheet when triaging a failing redirect. The leftmost state that grants the feature is the **minimum** state required; states below it also work (higher states are strictly more permissive for the same feature).

| URL | Feature key | Allowed states |
|-----|-------------|----------------|
| `/supplier/onboarding/path` | `supplier.onboarding.path` | `supplier.no_row` only |
| `/supplier/onboarding` (wizard) | `supplier.onboarding.wizard` | `in_onboarding`, `pending_review`, `approved`, `rejected` |
| `/supplier/dashboard` | `supplier.dashboard` | `in_onboarding`, `pending_review`, `approved`, `rejected`, `suspended` |
| `/supplier/catalog` | `supplier.catalog` | `approved` only |
| `/supplier/calendar` | `supplier.calendar` | `approved` only |
| `/supplier/bookings` | `supplier.bookings` | `approved` only |
| `/supplier/rfqs`, `/supplier/rfqs/[id]` | `supplier.rfqs.view` | `approved` only |
| `/supplier/rfqs/[id]/quote` (send quote) | `supplier.rfqs.respond` | `approved` only |
| `/supplier/profile` | `supplier.profile.customize` | `approved` only |
| `/organizer/dashboard` | `organizer.dashboard` | `organizer.active`, `agency.active`, `admin.active` |
| `/organizer/events/*` | `organizer.events` | same as above |
| `/organizer/rfqs/*` | `organizer.rfqs` | same as above |
| `/organizer/bookings/*` | `organizer.bookings` | same as above |
| `/admin/*` | `admin.console` | `admin.active` only (admin can also reach supplier + organizer surfaces) |

If a test case expects redirect and instead gets a render (or vice versa), the feature matrix (`src/lib/auth/featureMatrix.ts`) vs. the gate in the page/action is where the bug will be.

---

## 8. If you find a bug

Do not attempt to fix. Capture:

1. Case ID.
2. Exact reproduction command / URL.
3. Page text / screenshot if visual.
4. Console errors (`read_console_messages`).
5. Network requests in the last 30 seconds for the page (`read_network_requests`).
6. The state of `public.suppliers` for the test user (run the SQL from §1.3).

Record in the failures section of the report and move on to the next case.
