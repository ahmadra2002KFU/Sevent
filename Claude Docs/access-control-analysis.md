# Access Control Analysis — Auth, Onboarding & Routing

**Status:** Forensic analysis only. No code changes. Proposed architecture at the end awaits approval.
**Date:** 2026-04-22
**Scope:** auth, sign-up, sign-in, onboarding, and routing for suppliers, organizers, and agencies.
**Inputs:** four parallel Explore agents + one Codex second-opinion pass.

---

## 1. TL;DR — The real bug in one paragraph

Routing today is **role-gated**, but supplier access is really a function of `role + onboarding state + verification state`. The app computes `journeyState` in the supplier dashboard and nowhere else, so every other surface (middleware, login redirect, nav, dashboard quick-links, page loaders, server actions) independently re-checks a weaker subset of the same contract — usually just "is this a supplier?" or "does a supplier row exist?". On top of that, the auth helper `authenticateAndGetAdminClient()` hands out an **RLS-bypassing service-role client**, so every missed state check is no longer a UX leak — it's a real authorization gap. The sign-in `next` parameter is also trusted verbatim, which lets the user (or an attacker) override the role-based redirect entirely.

**The #1 thing the prior solo codex analysis understated:** this is not a nav/routing bug first — it's server-side authorization drift. Fixing nav links without fixing page/action-layer state checks leaves the back-end open.

---

## 2. Confirmed findings (all agents agree)

| # | Finding | Evidence |
|---|---------|----------|
| 1 | Middleware only checks `profiles.role` | `src/proxy.ts:16-18`, `src/proxy.ts:31-61` |
| 2 | Sign-in redirect is role-only when no `next` supplied | `src/app/(auth)/actions.ts:159-180` |
| 3 | `next` query param is trusted verbatim — open redirect / access bypass | `src/app/(auth)/sign-in/page.tsx:13-16`, `src/app/(auth)/actions.ts:159` |
| 4 | `TopNav` renders full supplier nav regardless of state | `src/components/nav/TopNav.tsx:24-44`, `src/components/nav/MobileNavSheet.tsx:83-105` |
| 5 | Dashboard `locked` disables only `customizeProfile`; catalog/calendar/bookings quick-links stay active | `src/app/(supplier)/supplier/dashboard/page.tsx:462`, lines 651-694 |
| 6 | Supplier pages gate on "has supplier row", not on verification | `catalog/loader.ts:33-58`, `calendar/actions.ts:26-45`, `bookings/page.tsx:138-161`, `rfqs/page.tsx:102-123`, `profile/page.tsx:50-64` |
| 7 | Server actions gate on role, not state | `catalog/actions.ts:78`, `calendar/actions.ts:58`, `profile/actions.ts:65`, onboarding path/wizard actions |
| 8 | Agency role drift: `requireRole(["organizer","agency","admin"])` allows it, `src/proxy.ts:53-61` redirects it | `organizer/dashboard/page.tsx:84`, `src/proxy.ts:43-61` |

---

## 3. New findings surfaced by the agents

### 3.1 Open-redirect / privilege bypass via `next` (CRITICAL)
`signInAction` at `src/app/(auth)/actions.ts:159-180`:
```
let target = parsed.data.next ?? "/"
if (!parsed.data.next && userId) { ...role-based fallback... }
redirect(target)
```
- If `next` is present, role-based routing is **skipped entirely**.
- `next` is a plain string — no same-origin check, no prefix allowlist, no `new URL()` parse.
- `src/app/(auth)/sign-in/form.tsx:57-63` forwards it verbatim.
- Consequences:
  - A supplier can land on `/admin/*` URL shells (middleware then redirects, but the intent is trusted).
  - Protocol-relative URLs (`//evil.com`) or absolute URLs may escape the origin.
  - In staging, a bookmarked deep link survives an auth lapse regardless of current state.

### 3.2 Service-role client = RLS bypass (CRITICAL — under-stated by prior analysis)
`src/lib/supabase/server.ts:33-42, 47-57, 96-123, 126-149` — `authenticateAndGetAdminClient()` and `requireRole()` return a **service-role client** that bypasses RLS. Pattern across the app: "authenticate user, then query with admin client and manually filter by `user.id`."
- If a query forgets `.eq("supplier_id", user.id)` or `.eq("organizer_id", user.id)`, there is **no backstop**. IDOR.
- This is already present in organizer pages: `organizer/events/[id]/page.tsx:124`, `organizer/events/page.tsx:61`, `organizer/rfqs/[id]/page.tsx:154`, and `supplier/dashboard/page.tsx:251` call `authenticateAndGetAdminClient()` **without** a prior `requireRole()` — so any authenticated user (including one with no profile role) is accepted, gated only by inline filters.

### 3.3 Shell-supplier misclassification (HIGH)
A user who picks a path (creates supplier row) but abandons the wizard is classified as "under review" rather than "continue onboarding":
- `dashboard/page.tsx:277-279` redirects to `/supplier/onboarding/path` only if `legal_type IS NULL`.
- But the schema makes `legal_type` NOT NULL after path picker (`20260420000100_marketplace_schema.sql:91-99`), so the "missing legal_type" signal fires only in an impossible state.
- After path picker creates the shell row with `verification_status='pending'` (`path/actions.ts:58-75`), the dashboard falls through to the pending-review UI (`dashboard/page.tsx:328-339, 432-449`).
- `PendingReviewChecklist` links directly to `/supplier/catalog` (`components/supplier/onboarding/PendingReviewChecklist.tsx:347-353`), and the catalog loader happily admits any supplier with a row. **So an abandoned wizard user lands in catalog.**

### 3.4 Verification revocation is partial (HIGH)
Admin rejection flips `is_published=false` and `verification_status='rejected'` (`admin/verifications/actions.ts:295-304`).
- **Public visibility** revokes immediately via RLS (`marketplace_schema.sql:124-125, 242-246, 286-290, 371-375`).
- **Private supplier surfaces** keep working: RFQ inbox/detail, quote builder, send-quote action, decline action, bookings, calendar, profile editor, catalog — all ignore `verification_status`.
- A rejected supplier can still send quotes and mutate bookings. That is the worst live behaviour in this set.

### 3.5 Orphan mutations by non-approved suppliers (MEDIUM)
No RLS policy on `packages`, `pricing_rules`, `availability_blocks`, `supplier_docs` gates inserts on verification status. A rejected or in-onboarding supplier can create rows that never render. Data garbage, not a direct leak — but a cleanup debt.

### 3.6 Agency role causes a redirect loop at `/organizer/events/new` (MEDIUM)
- `organizer/dashboard/page.tsx:84` allows `["organizer","agency","admin"]`.
- `src/proxy.ts:53` fires when `actualRole !== expectedRole && actualRole !== "admin"`. For `/organizer/*` and role=`agency`, this is true — agency gets redirected to `/organizer/dashboard`.
- Agency user on dashboard clicks "New event" → proxy kicks them back to dashboard → loop.
- Escape hatch: pages using `authenticateAndGetAdminClient()` (e.g. `organizer/events/[id]/page.tsx`) skip proxy's role check and render — inconsistent.

### 3.7 Email confirmation is Supabase-config-dependent (MEDIUM)
- `signInAction` does not check `email_confirmed_at`. If Supabase's "require email confirm" is off (or gets toggled), unconfirmed users sign in and the proxy sees only role.
- No app-layer guard against unconfirmed login.

### 3.8 Session revocation gap (LOW / TOOLING)
- No code path signs other sessions out on role demotion or suspension.
- Next protected request is re-checked, so roles don't "coast" forever — but tokens remain valid client-side until natural expiry.

### 3.9 Data-integrity race in onboarding step 2 (LOW)
`supplier/onboarding/actions.ts:225-238` deletes all `supplier_categories` rows then re-inserts outside a transaction. If the insert fails, the supplier is left with zero categories but a "submitted" signal elsewhere. Resolver should treat zero categories as `in_onboarding`, not `pending_review`.

### 3.10 Dead/latent code
- Organizer sign-up action references an `agency` fallback even though the sign-up form only exposes `organizer` (`actions.ts:14,175`).
- Google OAuth action appends `&role=...` but the sign-in page never reads it (`actions.ts:200`).
- Celebration banner depends on `first_seen_approved_at` + a 7-day window on `verified_at`; missing timestamp = silent no-op.

---

## 4. Supplier state machine (consolidated)

| State | Predicate | `journeyState` today | Routes that **should** be allowed |
|-------|-----------|----------------------|-----------------------------------|
| `no_supplier_row` | no row in `suppliers` for user | redirected to path picker (if dashboard detects; see §3.3 — detection is broken) | `/supplier/onboarding/path` only |
| `needs_path` | row exists, `legal_type IS NULL` (effectively impossible per schema) | same | `/supplier/onboarding/path` only |
| `in_onboarding` | row exists, `verification_status='pending'`, missing docs or missing categories | misclassified as `reviewing` | `/supplier/onboarding/*`, dashboard (read-only) |
| `pending_review` | `verification_status='pending'`, has docs AND categories | `reviewing` | dashboard (read-only) |
| `approved` | `verification_status='approved'` | `live` | everything |
| `rejected` | `verification_status='rejected'` | `rejected` | dashboard (read-only), onboarding (re-submit) |
| `suspended` (future) | admin-controlled flag | not modelled | dashboard (read-only) |

The **current derivation** in `dashboard/page.tsx:441-449` is pure logic but lives only in the dashboard. It is not a shared resolver.

---

## 5. State-by-route matrix (current vs required)

Legend: ✅ allowed, ❌ denied, ➡️ redirect-to-X. Left cell = current; right cell = required.

| Route | no_row | needs_path | in_onboarding | pending_review | approved | rejected |
|-------|--------|------------|---------------|----------------|----------|----------|
| `/supplier/dashboard` | ✅ / ➡️path | ✅ / ➡️path | ✅/✅ | ✅/✅ | ✅/✅ | ✅/✅ |
| `/supplier/onboarding/path` | ✅/✅ | ✅/✅ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| `/supplier/onboarding/*` | ✅/❌ | ✅/❌ | ✅/✅ | ✅/➡️dashboard | ✅/➡️dashboard | ✅/✅ |
| `/supplier/catalog` | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/✅ | ✅/❌ |
| `/supplier/calendar` | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/✅ | ✅/❌ |
| `/supplier/bookings` | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/✅ | ✅/❌ |
| `/supplier/rfqs` | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/✅ | ✅/❌ |
| `/supplier/profile` (customizer) | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/✅ | ✅/❌ |

The current column is wall-to-wall ✅ because every route trusts "role=supplier + maybe has row". The required column is what a shared resolver must enforce.

---

## 6. Layered authorization map

| Layer | Checks today | Gap | Risk |
|-------|--------------|-----|------|
| Middleware (`src/proxy.ts`) | `profiles.role` matches URL prefix; `admin` gets through everywhere | no state, no verification, rejects agency at `/organizer/*` | false-positives (agency loop), false-negatives (supplier state leak) |
| Layouts (`(supplier)/layout.tsx`, etc.) | nothing (pure presentation) | delegated entirely to page layer | none directly; amplifies page drift |
| Pages | mixed: some `requireRole()`, some `authenticateAndGetAdminClient()` | role-only; 4 files skip role check entirely | IDOR, state leak |
| Server actions | `requireRole("supplier")` or equivalent; state never checked | verification-status missing everywhere | rejected supplier can send quotes |
| DB RLS | ownership + public-read gate (`is_published AND verification_status='approved'`) | does not prevent owner mutations during non-approved state | orphan data, no backstop |
| Service-role client | bypasses RLS entirely | forgotten `.eq(owner_id, user.id)` filters | IDOR |

---

## 7. UI leak hit-list (top 10)

| # | Entry point | File:line | Target | Current gate | Severity |
|---|-------------|-----------|--------|--------------|----------|
| 1 | TopNav supplier items | `TopNav.tsx:24-44` | all supplier pages | role only | CRITICAL |
| 2 | MobileNavSheet | `MobileNavSheet.tsx:83-105` | same | role only | CRITICAL |
| 3 | Dashboard "Catalog" quick-link | `dashboard/page.tsx:651` | `/supplier/catalog` | none (ignores `locked`) | CRITICAL |
| 4 | Dashboard "Calendar" quick-link | `dashboard/page.tsx:660` | `/supplier/calendar` | none | CRITICAL |
| 5 | Dashboard "Bookings" quick-link | `dashboard/page.tsx:669` | `/supplier/bookings` | none | HIGH |
| 6 | Dashboard "RFQs" metric card | `dashboard/page.tsx:588` | `/supplier/rfqs` | none | HIGH |
| 7 | `PendingReviewChecklist` link | `PendingReviewChecklist.tsx:347-353` | `/supplier/catalog` | none | HIGH (mis-states the user as reviewing, then opens catalog) |
| 8 | Organizer quick-actions cards | `organizer/dashboard/page.tsx:301-318` | events/bookings/notifications | role only | MEDIUM (agency path inconsistent) |
| 9 | Approved supplier re-opens path picker | `/supplier/onboarding/path` | resets `legal_type` | role only | MEDIUM (data destruction) |
| 10 | Stats cards on supplier dashboard | `dashboard/page.tsx:540-569` | various | dimmed, still clickable | LOW-MEDIUM |

---

## 8. Proposed architecture (for user approval — not yet implemented)

### 8.1 Shared resolver
**Location:** `src/lib/auth/access.ts`

```ts
export type AccessState =
  | "unauthenticated"
  | "email_unconfirmed"
  | "forbidden"
  | "organizer.active"
  | "agency.active"
  | "admin.active"
  | "supplier.no_row"
  | "supplier.needs_path"       // reserved (currently schema-impossible)
  | "supplier.in_onboarding"
  | "supplier.pending_review"
  | "supplier.approved"
  | "supplier.rejected";

export type AccessDecision = {
  userId: string | null;
  role: AppRole | null;
  state: AccessState;
  bestDestination: string;             // the "home" for this state
  allowedRoutePrefixes: string[];      // e.g. ["/supplier/dashboard", "/supplier/onboarding"]
  features: {
    supplierDashboard: boolean;
    supplierOnboarding: boolean;
    supplierCatalog: boolean;
    supplierCalendar: boolean;
    supplierRfqRespond: boolean;
    supplierBookings: boolean;
    supplierProfileCustomize: boolean;
    organizerEvents: boolean;
    organizerBookings: boolean;
    adminConsole: boolean;
  };
};

export async function resolveAccessForUser(
  userId: string,
  opts?: { admin?: SupabaseClient },
): Promise<AccessDecision>;

export async function resolveAccessFromRequest(
  request: NextRequest,
): Promise<AccessDecision>; // for middleware
```

### 8.2 Inputs the resolver needs
- `profiles.role`, `profiles.terms_accepted_at`.
- For suppliers: one supplier summary row (`id, legal_type, verification_status, is_published`) plus two completeness booleans (`hasDocs`, `hasCategories`) — ideally through one view or RPC to keep middleware roundtrips to one.

### 8.3 Caching
- In RSC pages/actions: wrap with React `cache()` keyed by `userId` — request-scoped only.
- In middleware: plain call, one decision per request. No `unstable_cache` (auth-sensitive, mutable).
- Do **not** persist decisions to Redis or similar — revocation latency is the enemy.

### 8.4 Integration points
1. **Middleware (`src/proxy.ts`)** calls `resolveAccessFromRequest`. If the requested URL is not in `allowedRoutePrefixes`, redirect to `bestDestination`.
2. **Sign-in action (`actions.ts:signInAction`)** replaces its role-lookup block with one resolver call. Redirect to `decision.bestDestination`. If a `next` is supplied, sanitize it (see §8.5), then verify it starts with one of `allowedRoutePrefixes`; otherwise fall back to `bestDestination`.
3. **Layout (`(supplier)/layout.tsx`, etc.)** calls the resolver once, passes `decision` to `TopNav` instead of a bare `role`.
4. **`TopNav`** filters items by `decision.features.*` instead of hardcoded per-role item lists.
5. **Each supplier page** calls the resolver and branches on `features` or explicit `state`. `authenticateAndGetAdminClient()` callers upgrade to `requireAccess(featureFlag)`.
6. **Each supplier server action** calls the resolver and verifies the relevant feature flag before mutating.
7. **Dashboard quick-links** read `decision.features` to either render enabled, disabled, or hidden.

### 8.5 `next` sanitization rules
- Accept only a single-leading-slash relative path.
- Reject anything starting with `//`, `\`, containing control chars, or containing a scheme (`http:`, `javascript:`, `data:`).
- Parse via `new URL(candidate, APP_URL)` and require same origin.
- Restrict to known app prefixes.
- If invalid, silently ignore and use `decision.bestDestination`.

### 8.6 What this does NOT fix (deliberately out of scope for v1)
- Session invalidation on role demotion (needs an admin tool + `auth.admin.signOut`).
- CSRF origin allowlist in `next.config.ts` (separate, simple change).
- Orphan `packages`/`availability_blocks` cleanup for historically-non-approved suppliers (one-off migration).
- Onboarding step 2 delete+insert wrapped in a transaction (separate refactor).

---

## 9. Recommended sequencing (tradeoff-aware, awaiting user decision)

**Option A — Narrow fix (1–2 days):** only sanitize `next`, add supplier-state checks to TopNav + dashboard quick-links + page loaders (catalog/calendar/bookings/rfqs/profile). No shared resolver. Fast, but perpetuates the drift.

**Option B — Shared resolver (3–5 days):** build `src/lib/auth/access.ts`, migrate middleware + sign-in + layouts + pages + actions incrementally. Each migration is a small PR. End-state is one-gate. Recommended.

**Option C — Resolver + RLS tightening (1–2 weeks):** option B plus RLS policies on child tables that reference supplier verification status, plus one-off cleanup of orphaned rows. Highest-assurance.

**My recommendation:** B. A is tempting but leaves the service-role IDOR risk in organizer pages untouched and leaves the next state machine drift waiting for the next feature to re-break it. C is the right end-state, but RLS on child tables is easy to get wrong and can break admin flows — schedule it as a follow-up.

---

## 10. Open questions for user

1. Should agency be allowed into `/organizer/*` at all? If yes, middleware needs to accept it (fix); if no, `requireRole(["organizer","agency","admin"])` sites need to drop it.
2. What should a rejected supplier see? Read-only dashboard + a re-submission CTA, or forced onboarding re-entry?
3. Is `supplier.needs_path` a real state (i.e. should we allow a null `legal_type`) or should we keep the NOT NULL and retire that branch of the state machine?
4. Does "suspended" need modelling now, or is admin deletion the current workaround?
5. Should sign-in fail closed when `email_confirmed_at IS NULL`, or keep deferring to Supabase config?
