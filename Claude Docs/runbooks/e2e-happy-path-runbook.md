# E2E Happy-Path Runbook — "Sign-up → Accept Quote"

> **Audience.** An AI agent driving a real browser (Chrome automation, Playwright, etc.) against the local dev build, plus a human reading along to follow the story.
> **Target.** Arabic locale. `http://localhost:3000`. Local Supabase.
> **Success.** An event exists, an RFQ was sent, a supplier quoted, the organizer accepted, a **booking** row is `awaiting_supplier`, and a **48-hour soft-hold** block is live on the supplier's calendar.

This runbook is written on **two parallel tracks** for every step:

- **🧑 Real-life perspective.** What a non-technical user (the persona) is trying to do, what they see, what they click, what they feel. This is the layer the agent uses to decide "what's the next human action."
- **⚙️ Technical perspective.** Exact URL, form field `name=` attributes, server actions, RPCs, DB effects, state transitions, and the observable signals (redirects, toasts, status flips, notification rows). This is the layer the agent uses to verify the step actually worked.

Every step ends with **✅ Verify** (what "done" looks like) and **🛠 If it fails** (how to diagnose).

---

## Table of contents

- [0. Preflight (technical only)](#0-preflight-technical-only)
- [Cast & conventions](#cast--conventions)
- [Act 1 — A supplier joins the market](#act-1--a-supplier-joins-the-market)
- [Act 2 — An organizer plans an event](#act-2--an-organizer-plans-an-event)
- [Act 3 — The organizer sends the RFQ](#act-3--the-organizer-sends-the-rfq)
- [Act 4 — The supplier quotes](#act-4--the-supplier-quotes)
- [Act 5 — The organizer accepts](#act-5--the-organizer-accepts)
- [Act 6 — Final verification](#act-6--final-verification)
- [Appendix A — Known UX gotchas](#appendix-a--known-ux-gotchas)
- [Appendix B — Triage table](#appendix-b--triage-table)
- [Appendix C — Clean reset](#appendix-c--clean-reset)

---

## 0. Preflight (technical only)

Run once before the scenario starts. The agent should assert every item below before typing the first letter of the story.

| # | Check | Command / URL | Expected |
|---|---|---|---|
| P1 | Local Supabase up | `pnpm db:start` (runs `supabase start`) | Prints studio, inbucket, db URLs |
| P2 | Migrations + taxonomy seed applied | `pnpm dlx supabase db reset` | Categories table populated (8 parents / 19 children) |
| P3 | Demo users seeded | `pnpm seed` | 1 admin, 2 organizers, 25 suppliers (first 8 already `approved`) |
| P4 | Dev server running | `pnpm dev` | `✓ Ready` on `http://localhost:3000` |
| P5 | Root responds 200 | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` | `200` |
| P6 | Inbucket mail UI | open `http://localhost:54324` | Renders the inbox (used only if a step ever requires an email link) |
| P7 | Locale set to Arabic | Browser cookie `NEXT_LOCALE=ar`, or click the `AR` toggle in the header | UI direction flips to RTL |

> **Email confirmations are disabled locally** (`supabase/config.toml: enable_confirmations = false`), so sign-ups do **not** require clicking a confirmation link. Inbucket is informational only.

### Environment snapshot the agent should record

```
base_url:            http://localhost:3000
locale:              ar
supabase_db:         postgresql://postgres:postgres@localhost:54322/postgres
inbucket:            http://localhost:54324
seeded_admin_email:  (read from scripts/seed-users.ts output)
```

---

## Cast & conventions

**Two new personas** sign up during the story. Both are invented for this run (no seed data reuse) so each end-to-end execution is exercising the real signup + onboarding flow, not shortcuts.

| Persona | Role | Short bio (for the agent to "be") |
|---|---|---|
| **Rakan** | Supplier | 34, owns a small catering company in Riyadh specialising in corporate coffee breaks and light lunches. Just heard about Sevent from a friend and wants to get in front of event organizers. |
| **Noura** | Organizer | 29, an in-house event manager at a tech company in Riyadh. Her team just greenlit an internal summit in 3 weeks and she needs to book a caterer fast. |

A **third persona — the Admin — is already seeded**. The agent signs in as the seeded admin only to approve Rakan. After that, the admin disappears from the story.

**Date convention.** Use dates ~21 days in the future so the event window is comfortably after "today" and outside any stale soft-holds. For a run on `2026-04-23`, use event start `2026-05-14 18:00` / end `2026-05-14 23:00` (Asia/Riyadh).

**Credential convention.** Use disposable but legible emails:

```
rakan-<run-id>@test.sevent.local
noura-<run-id>@test.sevent.local
```

`<run-id>` = 8 hex chars generated at the start of the run. This keeps reruns unique and grep-able.

**Selector priority for the agent.**
1. Form `name=` attributes — stable across locales. Use these first.
2. Route URLs — stable.
3. Arabic visible text — use only where no `name=` exists (radio cards, buttons inside Radix wrappers, etc.).

---

# Act 1 — A supplier joins the market

## Scene 1.1 — Rakan opens the app in Arabic

> **🧑 Real life.** Rakan got a WhatsApp from a friend: "يا رجل، في منصة جديدة للفعاليات اسمها Sevent — سجّل عليها."  He opens the link on his laptop. The site looks clean, right-to-left, Arabic by default.
>
> **⚙️ Technical.**
> - Navigate to `http://localhost:3000/` with `NEXT_LOCALE=ar` cookie (or click `AR` toggle in header if cookie not set).
> - Observe `<html dir="rtl" lang="ar">` on the root element.
>
> **✅ Verify.** Page header is right-aligned, the menu items (`طلبات العروض`, `الفعاليات`, `لوحة التحكم`, `الحجوزات`) flow right-to-left.
>
> **🛠 If it fails.** If the page renders in English, the locale cookie wasn't set. Open DevTools → Application → Cookies and set `NEXT_LOCALE=ar`, then hard-reload.

## Scene 1.2 — Rakan creates his supplier account

> **🧑 Real life.** He clicks "انضمّ كمزوّد" / "Sign up as supplier" from the landing page. The form asks for his email, his mobile, a password, and has a box to accept the terms. He notices there's no Google sign-in for suppliers — he types everything himself.
>
> **⚙️ Technical.**
> - URL: `/sign-up/supplier`
> - Form fields (from `src/app/(auth)/sign-up/supplier/form.tsx`):
>   | `name=` | Value to enter | Validation |
>   |---|---|---|
>   | `email` | `rakan-<run-id>@test.sevent.local` | valid email |
>   | `phone` | `512345678` (9 digits starting with `5`, **no** `+966`) | regex `^5\d{8}$` |
>   | `password` | `Password123!` | min 8 chars |
>   | `termsAccepted` | checked | must be `true` |
> - Submit → server action `signUpSupplierAction` in `src/app/(auth)/actions.ts`.
> - Under the hood: `supabase.auth.signUp` with `user_metadata.role = "supplier"`, then a service-role write stamps `profiles.terms_accepted_at = now()` (RLS bypass because the user is still unconfirmed at that instant).
>
> **✅ Verify.**
> - Redirect to `/sign-in?confirm=1&role=supplier`.
> - DB: `select id, role, terms_accepted_at from profiles where id in (select id from auth.users where email = '<email>');` → one row with `role='supplier'`, non-null `terms_accepted_at`.
>
> **🛠 If it fails.** Phone regex is the usual culprit. The field expects `5XXXXXXXX` (9 digits) — it rejects `+9665...`, `05...`, or `5XXXXXXX` (only 8 digits).

## Scene 1.3 — Rakan signs in for the first time

> **🧑 Real life.** He types the email and password he just created and hits "Sign in." The site does something a bit unusual: it doesn't dump him on a dashboard — it takes him to a page asking whether he's a freelancer or a company.
>
> **⚙️ Technical.**
> - URL: `/sign-in`
> - Fields: `email`, `password`.
> - On success, `resolveAccessForUser` (in `src/lib/auth/access.ts`) inspects `profiles.role` + `suppliers.legal_type`. Because `suppliers.legal_type` is null on a brand-new supplier, the decision is `bestDestination = "/supplier/onboarding/path"` (see `src/lib/auth/featureMatrix.ts:105`).
>
> **✅ Verify.** URL becomes `/supplier/onboarding/path`.

## Scene 1.4 — Rakan picks his legal type

> **🧑 Real life.** Two big cards: "Freelancer (أفراد)" and "Company (شركة)." Rakan has a CR for his small catering company, so he picks Company and clicks Continue.
>
> **⚙️ Technical.**
> - Radio → value `company` (or `freelancer`).
> - Server action `submitOnboardingPathAction` creates/updates the `suppliers` row for this profile and sets `legal_type = 'company'`.
> - Redirect to `/supplier/onboarding`.
>
> **✅ Verify.**
> - DB: `select legal_type, status from suppliers where profile_id = '<profile_id>';` → `legal_type='company'`, `status='in_onboarding'`.

## Scene 1.5 — Rakan fills out "about my business" (Step 1)

> **🧑 Real life.** Screen says "Tell us about your business." He types:
> - Representative name: his full name, `راكان الحارثي`
> - Business name: `مطبخ راكان للضيافة`
> - Bio: a one-liner about corporate coffee breaks
> - Base city: Riyadh (الرياض)
> - Service areas: Riyadh + neighbours (الرياض، الخرج، الدرعية)
> - Languages: Arabic + English
>
> Each field auto-saves as he tabs out. He sees a small "Saved" toast.
>
> **⚙️ Technical.**
> - URL: `/supplier/onboarding` (step 1 of the shadcn wizard).
> - Debounced autosave per field → `submitOnboardingStep1` (in `src/app/(onboarding)/supplier/onboarding/actions.ts`).
> - Writes to `suppliers(representative_name, business_name, bio, base_city, service_area_jsonb, languages_jsonb)`.
> - Validation (Zod `OnboardingStep1`): `representative_name` 2–120, `business_name` 2–120, `bio` optional ≤500, `base_city` required slug, `service_area_jsonb` non-empty array, `languages_jsonb` ≥1 of `["en","ar"]`.
>
> **✅ Verify.**
> - DB: `select representative_name, business_name, base_city, service_area_jsonb, languages_jsonb from suppliers where profile_id = '<profile_id>';` — all set.
> - "Next" becomes enabled after all required fields are valid.

## Scene 1.6 — Rakan picks his categories (Step 2)

> **🧑 Real life.** A cloud of category chips appears. He picks two: **Catering — Buffet** and **Catering — Coffee breaks**. Below, a segments section appears — he picks **Corporate** and **Private**.
>
> **⚙️ Technical.**
> - Server action `submitOnboardingStep2`.
> - Upserts into `supplier_categories (supplier_id, category_id)` for each selected child category (slug like `catering-buffet`, `catering-coffee`).
> - Updates `suppliers.segments_jsonb = ['corporate', 'private']`.
> - **Critical for matching later:** the organizer's RFQ auto-match query filters on exactly these `supplier_categories` rows matching `rfqs.subcategory_id`. If Rakan doesn't pick "Catering — Coffee breaks" here, Noura won't see him in Act 3.
>
> **✅ Verify.**
> - DB: `select c.slug from supplier_categories sc join categories c on c.id = sc.category_id where sc.supplier_id = '<supplier_id>';` → contains `catering-coffee`.

## Scene 1.7 — Rakan (optionally) uploads docs (Step 3)

> **🧑 Real life.** Logo upload, IBAN certificate, company profile. Rakan uploads a small PNG logo but skips the rest — he knows he can come back later.
>
> **⚙️ Technical.**
> - `submitOnboardingStep3` → `uploadDocumentAction(file, type)` → Supabase storage (`supplier-logos`, `supplier-docs` buckets) → inserts into `supplier_documents(supplier_id, document_type, file_key)`.
> - **Optional step.** None of the three docs is required to reach `pending_review`, but admins usually hold up approval if IBAN is missing for a Company supplier.
>
> **✅ Verify.**
> - If Rakan uploaded the logo: `select document_type, file_key from supplier_documents where supplier_id = '<supplier_id>';` has `logo`.
> - It's fine for this runbook if Step 3 is skipped entirely.

## Scene 1.8 — Rakan submits for review

> **🧑 Real life.** Big button at the bottom: "Submit for review." He clicks. A confirmation screen appears: "Thanks — we'll email you within 24 hours." In reality the admin approval happens immediately in our test.
>
> **⚙️ Technical.**
> - Final action transitions `suppliers.status` from `in_onboarding` → `pending_review`.
>
> **✅ Verify.**
> - DB: `select status from suppliers where profile_id = '<profile_id>';` → `pending_review`.

## Scene 1.9 — The admin approves Rakan

> **🧑 Real life.** _(This scene is from the admin's perspective, then we return to Rakan.)_ The Sevent admin opens her verifications queue, sees Rakan, skims his business info, and clicks Approve.
>
> **⚙️ Technical.**
> - Agent signs out (clear session) and signs in as the seeded admin (`admin@sevent.local` or whatever `scripts/seed-users.ts` set — check its output).
> - Admin lands on `/admin/dashboard`.
> - Navigate to `/admin/verifications`.
> - Click Rakan's row → `/admin/verifications/<supplier_id>`.
> - Click the Approve button → `approveSupplierAction` in `src/app/(admin)/admin/verifications/actions.ts:161`.
> - That action sets `suppliers.status = 'approved'`, `suppliers.verification_status = 'approved'`, and publishes (`is_published = true`).
>
> **🛠 Shortcut for the agent (if the admin queue is out of scope).** You can run a raw SQL update as a one-liner against local Supabase — but doing it this way is a test shortcut, not a real user path:
> ```sql
> update suppliers
>   set status = 'approved', verification_status = 'approved', is_published = true
>   where profile_id = (select id from auth.users where email = '<rakan-email>');
> ```
> Prefer the UI path where feasible — it exercises more surface area.
>
> **✅ Verify.**
> - DB: `select status, verification_status, is_published from suppliers where profile_id = '<rakan-profile_id>';` → `('approved','approved',true)`.
> - Rakan's `profiles` row still has `role='supplier'`.

---

# Act 2 — An organizer plans an event

The agent signs the admin out and switches to a fresh browser context (or incognito) for Noura.

## Scene 2.1 — Noura creates her organizer account

> **🧑 Real life.** Noura lands on the same homepage but clicks "I'm an organizer." The form is slightly simpler than the supplier one — full name, email, password. There's also a "Continue with Google" button; she ignores it and types everything.
>
> **⚙️ Technical.**
> - URL: `/sign-up/organizer`
> - Fields (`src/app/(auth)/sign-up/page.tsx` + shared form):
>   | `name=` | Value | Validation |
>   |---|---|---|
>   | `fullName` | `نورة العتيبي` | 2–120 chars |
>   | `email` | `noura-<run-id>@test.sevent.local` | valid email |
>   | `password` | `Password123!` | min 8 chars |
> - Server action `signUpAction` → `supabase.auth.signUp` with `user_metadata.role='organizer'`.
>
> **✅ Verify.**
> - Redirect to `/sign-in?confirm=1&role=organizer`.
> - DB: `select role from profiles where id = (select id from auth.users where email = '<noura-email>');` → `organizer`.

## Scene 2.2 — Noura signs in

> **🧑 Real life.** She signs in. The dashboard loads immediately — no onboarding wall for organizers.
>
> **⚙️ Technical.**
> - `resolveAccessForUser` sees `role='organizer'` → `bestDestination = "/organizer/dashboard"` (`src/lib/auth/featureMatrix.ts:89`).
>
> **✅ Verify.** Lands on `/organizer/dashboard`. Nav chrome reads Arabic (`لوحة التحكم`, `الفعاليات`, `طلبات العروض`, `الحجوزات`).

## Scene 2.3 — Noura creates an event

> **🧑 Real life.** She clicks "الفعاليات" then "إنشاء فعالية جديدة." The form asks what kind of event, what city, venue address, when it starts and ends, guest count, budget range, and an optional note.
>
> **⚙️ Technical.**
> - URL: `/organizer/events/new`.
> - React-Hook-Form fields (`src/app/(organizer)/organizer/events/new/event-form.tsx`):
>   | Field | Value | Notes |
>   |---|---|---|
>   | `event_type` | `corporate` | enum: wedding / corporate / private / other |
>   | `city` | `riyadh` | must be a known city slug |
>   | `client_name` | `فريق المنتج الداخلي` | optional |
>   | `venue_address` | `مؤسسة أخرى • الرياض` | required |
>   | `starts_at` | `2026-05-14T18:00` (datetime-local) | |
>   | `ends_at` | `2026-05-14T23:00` | must be after `starts_at` |
>   | `guest_count` | `120` | optional positive int |
>   | `budget_min_sar` | `15000` | SAR decimal, converted server-side to halalas |
>   | `budget_max_sar` | `25000` | must be ≥ `budget_min_sar` |
>   | `notes` | `استراحة قهوة صباحية + غداء خفيف` | optional ≤500 chars |
> - Server action `createEventAction`.
> - On success, redirects to `/organizer/events/<event_id>`.
>
> **✅ Verify.**
> - URL contains the new event id.
> - DB: `select id, event_type, city, starts_at, ends_at, budget_range_min_halalas, budget_range_max_halalas from events where organizer_id = '<noura-profile_id>';` — one row, `budget_range_min_halalas = 1500000`, `budget_range_max_halalas = 2500000` (SAR × 100).
>
> **🛠 If `ends_at must be after starts_at`.** Timezone pitfall — `datetime-local` inputs are interpreted in the browser's local zone. Confirm both timestamps are strictly increasing before submitting.

---

# Act 3 — The organizer sends the RFQ

This is the most complex scene. Four wizard steps. The agent must follow in order; step 3 blocks step 4 until a non-empty shortlist is chosen.

## Scene 3.1 — Noura opens the new-RFQ wizard

> **🧑 Real life.** From her dashboard she clicks "طلب عرض جديد." Four tabs at the top: `الفعالية والفئة`, `المتطلبات`, `القائمة المختصرة`, `المراجعة والإرسال`.
>
> **⚙️ Technical.**
> - URL: `/organizer/rfqs/new` (optional `?event_id=<id>` preselect).
> - Client-side reducer (see `useReducer` in `src/app/(organizer)/organizer/rfqs/new/page.tsx`) holds all state. Each tab is gated by prior completion.

## Scene 3.2 — Step 1: pick event + category

> **🧑 Real life.** She picks her newly created event from a dropdown, then picks "Catering" as the parent category and "Coffee breaks" as the subcategory.
>
> **⚙️ Technical.**
> - Fields: `event_id`, `category_id`, `subcategory_id` (all required).
> - `subcategory_id` must map to `categories.slug = 'catering-coffee'`.
> - The reducer derives `kind = 'catering'` from the parent slug (→ used to pick which requirements schema to show in step 2).
>
> **✅ Verify.** Step-1 tab shows a green check and step 2 unlocks.

## Scene 3.3 — Step 2: requirements

> **🧑 Real life.** She types estimated headcount (`120`) and picks "Coffee + light bites" from the preset options. Everything else is optional.
>
> **⚙️ Technical.**
> - The form is dynamic (varies with `kind`). For `kind='catering'`, representative fields: `headcount`, `dietary_restrictions`, `bar_service` (boolean). All optional in the schema.
> - Saved into `rfqs.extension_jsonb` on submit at step 4.
>
> **✅ Verify.** No validation error, step 3 unlocks.

## Scene 3.4 — Step 3: shortlist (this is where Rakan must appear)

> **🧑 Real life.** The page shows "suggested suppliers for you" with Rakan in the list (and likely some seeded approved suppliers too). Noura leaves Rakan ticked and removes one seeded supplier she doesn't like.
>
> **⚙️ Technical.**
> - Action: `previewAutoMatchAction({ event_id, category_id, subcategory_id })` — hits `fetchAutoMatchCandidates` (`src/lib/domain/matching/query.ts`).
> - **Match gate:** supplier must satisfy **all** of:
>   - `suppliers.status = 'approved'`
>   - `suppliers.is_published = true`
>   - `suppliers.base_city` matches the event city OR event city ∈ `suppliers.service_area_jsonb`
>   - one row in `supplier_categories` where `category_id = subcategory_id` of the RFQ
> - **If Rakan doesn't appear** in the auto-match list, one of those gates failed — see 🛠 below.
> - Organizer can also manually add suppliers via `searchApprovedSuppliersAction(subcategory_id, q)`.
>
> **✅ Verify.** Rakan's business name is in the shortlist checkbox list with a tick. Click step 4.
>
> **🛠 If Rakan is missing:**
> | Symptom | Likely cause |
> |---|---|
> | No suppliers at all | Seed didn't run; re-run `pnpm seed`; confirm first 8 suppliers are approved |
> | Seed suppliers appear but not Rakan | Check `suppliers.is_published` is true (approval usually flips this; confirm in DB) |
> | Rakan has wrong city | He picked Riyadh in step 1.5 and his service area includes Riyadh — the event is also Riyadh. Verify `suppliers.base_city = 'riyadh'`. |
> | Rakan has wrong category | Check `select c.slug from supplier_categories sc join categories c on c.id = sc.category_id where sc.supplier_id = '<rakan_supplier_id>';` includes `catering-coffee` |

## Scene 3.5 — Step 4: review + send

> **🧑 Real life.** She double-checks everything and picks a response deadline. Three cards: 24, 48, 72 hours. She picks **24 ساعة** because she's in a hurry. She clicks "إرسال الطلب."
>
> **⚙️ Technical.**
> - Field: `responseDeadlineHours` (radio) = `24`.
> - Server action `sendRfqAction` (`src/app/(organizer)/organizer/rfqs/actions.ts`):
>   1. Inserts into `rfqs(organizer_id, event_id, subcategory_id, status='sent', response_deadline_hours, extension_jsonb)`.
>   2. For each supplier in shortlist inserts `rfq_invites(rfq_id, supplier_id, status='invited', source)`.
>   3. Calls `createNotification(user_id=supplier.profile_id, kind='rfq.invitation', payload={rfq_id, supplier_id})` per invite.
> - Redirect to `/organizer/rfqs/<rfq_id>/quotes` (compare page, initially empty).
>
> **✅ Verify.**
> - URL contains the new `rfq_id`.
> - DB: `select status from rfqs where organizer_id = '<noura-profile_id>' order by created_at desc limit 1;` → `sent`.
> - DB: `select supplier_id, status from rfq_invites where rfq_id = '<rfq_id>';` includes Rakan's supplier id with `status='invited'`.
> - DB: `select kind from notifications where user_id = '<rakan-profile_id>' order by created_at desc limit 1;` → `rfq.invitation`.
>
> **🛠 If the radio cards look misaligned in RTL.** Confirmed fix in `src/app/layout.tsx` (wraps the tree in `<DirectionProvider dir={dir}>`). If the app wasn't restarted after that change, do a hard reload.

---

# Act 4 — The supplier quotes

Agent signs Noura out and signs Rakan back in (or switches to Rakan's browser context).

## Scene 4.1 — Rakan sees the invite

> **🧑 Real life.** Rakan signs in. The navbar has a small red dot on the bell. He clicks it and sees "You've been invited to quote on a corporate event in Riyadh."  He also sees the invite in his RFQs page.
>
> **⚙️ Technical.**
> - `resolveAccessForUser` sees an approved supplier → `bestDestination = '/supplier/rfqs'`.
> - `/supplier/rfqs` lists rows from `rfq_invites` where `supplier_id = <rakan_supplier_id>` and `status in ('invited','quoted')`.
> - The bell pulls from `notifications where user_id = <rakan_profile_id> and viewed_at is null`.
>
> **✅ Verify.** The invite row is visible, event city = Riyadh, deadline shown.

## Scene 4.2 — Rakan opens the quote builder

> **🧑 Real life.** He clicks the invite → then "Prepare quote." A big form loads with line items, a subtotal section, and some policy fields.
>
> **⚙️ Technical.**
> - URL: `/supplier/rfqs/<invite_id>/quote`.
> - Page pre-computes a draft via `composePrice()` from Rakan's packages + pricing rules.
> - Because Rakan skipped adding packages in step 2 of onboarding (this runbook does not author packages), the draft will fall back to `source = 'free_form'`.

## Scene 4.3 — Rakan composes the quote

> **🧑 Real life.** He keeps it simple. One line: **"استراحة قهوة لـ 120 شخص"** at **SAR 34** per person. He adds a SAR 1,500 setup fee and a 10% deposit. He writes cancellation terms and lists "Coffee, tea, baked goods" as inclusions. He gives it a 48-hour expiry.
>
> **⚙️ Technical.**
> - Source radio: `source = 'free_form'`.
> - Line items (JSON hidden input `name="line_items"`):
>   ```json
>   [{
>     "kind": "free_form",
>     "label": "استراحة قهوة",
>     "qty": 120,
>     "unit": "person",
>     "unit_price_halalas": 3400,
>     "total_halalas": 408000
>   }]
>   ```
> - Addons: `setup_fee_sar = 1500` → 150000 halalas; `deposit_pct = 10`.
> - Terms: `payment_schedule`, `cancellation_terms`, `inclusions`, `exclusions`.
> - `expires_at` = now + 48h (ISO).

## Scene 4.4 — Rakan sends the quote

> **🧑 Real life.** He clicks "إرسال العرض." A success toast confirms: "Your quote is on its way to the organizer."
>
> **⚙️ Technical.**
> - Server action `sendQuoteAction` (`src/app/(supplier)/supplier/rfqs/[id]/quote/actions.ts`).
> - Clamps all money to integer halalas.
> - RPC `upsert_quote_revision_tx(rfq_id, supplier_id, source, snapshot_jsonb)`:
>   1. Upserts `quotes(rfq_id, supplier_id, status='sent', current_revision_id=<new>)`.
>   2. Inserts `quote_revisions(quote_id, version=1, source='free_form', snapshot_jsonb)`.
>   3. Updates `rfq_invites.status = 'quoted'`.
> - `createNotification(user_id=noura_profile_id, kind='quote.received', payload={supplier_id, rfq_id, quote_id, revision_id, version, total_halalas})`.
> - Redirect to `/supplier/rfqs/<invite_id>` showing the submitted state.
>
> **✅ Verify.**
> - DB: `select status, current_revision_id from quotes where rfq_id = '<rfq_id>' and supplier_id = '<rakan_supplier_id>';` → `sent`, non-null revision.
> - DB: `select status from rfq_invites where rfq_id = '<rfq_id>' and supplier_id = '<rakan_supplier_id>';` → `quoted`.
> - DB: `select kind from notifications where user_id = '<noura_profile_id>' order by created_at desc limit 1;` → `quote.received`.

---

# Act 5 — The organizer accepts

Agent switches back to Noura.

## Scene 5.1 — Noura returns and sees the quote

> **🧑 Real life.** She signs in, sees the bell badge. She clicks "طلبات العروض" → her RFQ → "Compare quotes."
>
> **⚙️ Technical.**
> - `/organizer/rfqs/<rfq_id>/quotes` — compare page. Sees one row (Rakan) with Total, Expires at, Submitted time.
> - **Heads-up for the agent:** this page currently ships with English literals (see `Claude Docs/` i18n-leak notes). Visible text includes "Compare quotes", "Supplier", "Total", "Expires", "Submitted", "Accept", "View snapshot". Don't rely on Arabic visible text here.

## Scene 5.2 — Noura reviews the full snapshot (optional but realistic)

> **🧑 Real life.** She clicks "View snapshot" to eyeball terms. She reads the inclusions, exclusions, and cancellation clause. Looks fine.
>
> **⚙️ Technical.**
> - URL: `/organizer/rfqs/<rfq_id>/quotes/<quote_id>`.
> - Read-only detail page. Top CTA is "Back to compare" — no accept button here **by design**. Clicking Accept has to happen on the compare table.

## Scene 5.3 — Noura clicks Accept

> **🧑 Real life.** Back to compare. She clicks **Accept** on Rakan's row. The page reloads and she's on a booking confirmation page: "Your supplier has 48 hours to confirm the booking."
>
> **⚙️ Technical.**
> - Server action `acceptQuoteAction` (`src/app/(organizer)/organizer/rfqs/[id]/quotes/actions.ts`).
> - Invokes RPC `accept_quote_tx(p_quote_id, p_organizer_id=<noura_profile_id>, p_soft_hold_minutes=2880)` (constant `SOFT_HOLD_MINUTES = 2880` = 48h).
> - The RPC, atomically:
>   1. Locks `events → rfqs → quotes → suppliers` in order.
>   2. Creates `bookings(event_id, supplier_id, status='awaiting_supplier', confirm_deadline=now()+'48h')`.
>   3. Creates `availability_blocks(supplier_id, booking_id, reason='soft_hold', released_at=null, expires_at=now()+'48h', starts_at=event.starts_at, ends_at=event.ends_at)`.
>   4. Sets the accepted quote `status='accepted'`, `accepted_at=now()`.
>   5. Flips all sibling quotes on the same RFQ to `status='rejected'`, `rejected_at=now()` (here there are no siblings, so this is a no-op).
>   6. Returns `{ booking_id, block_id }`.
> - Best-effort notifications after commit:
>   - To Rakan: `quote.accepted` and `booking.awaiting_supplier` (payload includes `confirm_deadline`).
>   - To Noura: `booking.created`.
>   - To any rejected-sibling suppliers: `quote.rejected` with reason `another_quote_accepted`.
> - `revalidatePath` on `/organizer/rfqs/<rfq_id>/quotes`, `/organizer/bookings`, `/supplier/bookings`.
> - Redirect: `/organizer/bookings/<booking_id>`.
>
> **🛠 Error taxonomy (from the action's `messageForError`):**
> | Code | Meaning |
> |---|---|
> | `P0002` | Quote not found |
> | `P0003` | Already accepted |
> | `P0004` | Quote is no longer sendable |
> | `P0005` | Missing revision (supplier must resend) |
> | `P0006` | Organizer mismatch |
> | `P0007` | Supplier no longer available (date conflict) |
> | `P0010` | RFQ not bookable (wrong status) |
> | `P0012` | Invalid soft-hold duration |

---

# Act 6 — Final verification

All of the following should be true. The agent runs these queries against local Postgres (`psql postgresql://postgres:postgres@localhost:54322/postgres -f check.sql`) and prints a ✅/❌ report.

```sql
-- 1. The RFQ is sent
select status from rfqs where id = '<rfq_id>';             -- expect: 'sent'

-- 2. The invite is quoted
select status from rfq_invites
 where rfq_id = '<rfq_id>' and supplier_id = '<rakan_supplier_id>';  -- expect: 'quoted'

-- 3. The quote is accepted with a revision
select status, accepted_at is not null as has_acceptance,
       current_revision_id is not null as has_revision
  from quotes
 where rfq_id = '<rfq_id>' and supplier_id = '<rakan_supplier_id>'; -- expect: ('accepted', t, t)

-- 4. A booking exists, awaiting supplier
select status, confirm_deadline > now() as deadline_in_future
  from bookings
 where event_id = '<event_id>' and supplier_id = '<rakan_supplier_id>'; -- expect: ('awaiting_supplier', t)

-- 5. A soft-hold block exists and is active
select reason,
       released_at is null as still_active,
       expires_at > now() as not_expired
  from availability_blocks
 where supplier_id = '<rakan_supplier_id>' and booking_id = '<booking_id>';
-- expect: ('soft_hold', t, t)

-- 6. Notifications fired
select kind, count(*) from notifications
 where created_at > now() - interval '10 min'
 group by kind order by kind;
-- expect rows at minimum: rfq.invitation (1), quote.received (1),
--                         quote.accepted (1), booking.awaiting_supplier (1),
--                         booking.created (1)
```

**UI-side final screen.** Noura is on `/organizer/bookings/<booking_id>` showing status `awaiting_supplier` with the 48-hour confirm window. Rakan, if he reloads `/supplier/bookings`, sees the same booking pending his confirmation.

---

# Appendix A — Known UX gotchas

Problems you'll actually hit. Each one is something the agent should be robust to rather than fail on.

1. **English leak on the compare / quote detail pages.** The files under `src/app/(organizer)/organizer/rfqs/[id]/quotes/**` have hardcoded English strings (`Compare quotes`, `Supplier`, `Total`, `Expires`, `Submitted`, `Accept`, `View snapshot`, `Back to compare`, `Line items`, `Totals`, etc.). In Arabic mode the chrome is RTL + Arabic but these labels remain English. Use `name=` and URLs for selection, not visible text.

2. **Radio-card misalignment in RTL (fixed).** `src/app/layout.tsx` now wraps the tree in a client-side `<DirectionProvider dir={dir}>` so Radix primitives stop stamping `dir="ltr"` on their root DOM. If you see the deadline radios sitting on the visual left of each card, the fix hasn't been picked up — hard-reload after the dev server recompiles.

3. **Supplier first redirect.** Right after supplier sign-up the bestDestination is `/supplier/onboarding/path` (not `/supplier/onboarding`). The path picker screen is the legal-type selector. The onboarding wizard itself is only reachable once `legal_type` is set.

4. **Auto-match is strict.** `status='approved'` AND `is_published=true` AND category match AND city/service-area match. Missing any one and the supplier silently vanishes from step 3. Always verify in DB if a shortlist is unexpectedly empty.

5. **Email confirmations are off locally.** Don't wait for an email. Inbucket exists but is not on the happy path.

6. **Phone format.** Exactly 9 digits, starts with `5`, no `+966`, no `0`. `512345678`, not `0512345678` or `+966512345678`.

---

# Appendix B — Triage table

| Symptom | Most likely cause | Fastest check |
|---|---|---|
| Sign-up returns `invalid_phone` | Phone not `^5\d{8}$` | retype 9 digits |
| Sign-in loops back to `/sign-in` | Cached Supabase session collision | Clear cookies, retry |
| Supplier redirect to `/supplier/onboarding/path` repeatedly | `suppliers.legal_type` is null | Confirm Scene 1.4 fired |
| Step 3 shortlist empty | Match gate failure | Run the 4 DB checks in Scene 3.4 🛠 box |
| Step 4 submit → "something went wrong" | Usually Zod extension validation | Check server logs for which field was rejected |
| `Accept` on compare page returns P0007 | Soft-hold already exists for overlapping window | `select * from availability_blocks where supplier_id = '...' and released_at is null;` — release or reset |
| `Accept` returns P0010 | RFQ status not `sent` (maybe `cancelled` / `expired`) | `select status from rfqs where id = '...';` |
| Booking page 404 after accept | Redirect raced revalidate | Reload once — record is there, cache was stale |
| Chrome extension disconnected when agent tries to drive browser | Extension disabled | re-enable, reload page |

---

# Appendix C — Clean reset

Between runs, the fastest way to start fresh:

```bash
# 1. Nuke and reseed local DB
pnpm dlx supabase db reset      # drops DB, reapplies migrations + seed.sql
pnpm seed                       # recreates demo users

# 2. Kill any stale Next dev servers (the port-3000 lock can survive a crash)
#    On Windows PowerShell:
Get-Process -Name node -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -like "*Sevent*" } | Stop-Process -Force

# 3. Restart dev
pnpm dev

# 4. Clear browser state for the test origin
#    (cookies + local storage for http://localhost:3000)
```

After reset, re-run this runbook from Scene 0 (preflight). A full pass — preflight → all 6 acts → verification — should take an AI agent roughly **8–12 minutes** in Arabic on a warm dev server.

---

*End of runbook.*
