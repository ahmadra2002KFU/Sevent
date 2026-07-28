# Organizer Teams / Companies — Process Review

> **Status update — 2026-07-28, same day:** F1–F5 have all been **fixed and
> verified**. See [teams-companies-fixes.md](./teams-companies-fixes.md) for what
> changed and how each fix was proven. F6–F8 remain open product decisions.

Date: 2026-07-28
Scope: the organizer-side company ("team") model — schema, onboarding, invites,
membership management, and how company context propagates through the product.
Reviewed by reading source + migrations and querying the local DB. Findings
marked **code-verified** were confirmed by reading the relevant code path end to
end; none were reproduced by driving the running app.

---

## 1. What the model actually is

**Teams are organizer-side only.** Suppliers have no team concept — a supplier is
still a single `profiles` row joined to one `suppliers` row. "Organizer signs
with a team" means an organizer account operates *as* a company, with multiple
member accounts sharing one workspace.

### Tables (migrations `20260518110000`, `20260518130000`)

| Table | Purpose |
|---|---|
| `organizer_companies` | One row per company. `slug` unique. Finance columns (`cr_number`, `vat_number`, `billing_email`) have column-level `SELECT` revoked from `authenticated`/`anon`. |
| `organizer_memberships` | `(company_id, profile_id)` PK. Role `owner`/`admin`/`member`. Soft-delete via `removed_at`. Partial unique index enforces exactly one active owner. |
| `organizer_invites` | sha256-hashed token, 7-day TTL, partial unique index = one pending invite per `(company, lower(email))`. `role <> 'owner'` check. |
| `organizer_membership_events` | Append-only audit log. |

`company_id` was added as nullable to `events`, `rfqs`, `bookings`, `disputes`,
`quote_proposal_requests`, with **deferrable composite FKs** guaranteeing the
acting profile is a current member of the stamped company.

### The three entry paths

`/organizer/onboarding/company-choice` offers:

1. **Individual** → `markAsIndividualAction` sets `organizer_legal_type='individual'`
   via a conditional `UPDATE ... WHERE organizer_legal_type IS NULL` (closes a
   prior TOCTOU with concurrent company creation).
2. **Create company** → routes to the form; `create_organizer_company_tx` creates
   the company + owner membership + sets `organizer_legal_type='company'` in one
   transaction.
3. **I was invited** → client-side same-origin validation of a pasted invite URL,
   then routes to the hardened accept page. No backend involved.

Choosing "company" on the picker does **not** persist anything — `legal_type` is
only written when a company is actually created or an invite is accepted. Good.

### Active-company resolution (`src/lib/auth/activeCompany.ts`)

Priority order, every candidate re-validated against the live membership list:

1. HMAC-signed `?company=<id>:<ts>:<sig>` query param (60s TTL; verified in
   middleware where async Web Crypto is available)
2. `sevent_active_company` HttpOnly cookie
3. `profiles.last_active_company_id`
4. Single membership → auto-resolve
5. Multiple memberships, no signal → most-recently-joined

The forwarded `x-sevent-access` header carries the company fields inside the HMAC
payload with a **tighter 15s TTL** than the 60s access TTL, so a removed member's
acting window closes fast. This is careful work.

### Read scoping (`src/lib/auth/organizerScope.ts`)

Organizer pages read through the service-role client, so DB RLS never runs on
those reads. The predicate is re-expressed in the query:

```
company_id = activeCompanyId  OR  (company_id IS NULL AND organizer_id = userId)
```

Applied consistently across dashboard, events, rfqs, bookings, quotes — list
pages via `companyOwnedOrFilter`, detail pages via `canViewOrganizerRow`. No
unscoped organizer surface found.

### Kill switch

`IS_COMPANY_FEATURES_ENABLED`. When not `'true'`, every organizer resolves to the
pre-refactor single-user contract. Currently `true` in `.env.local`.

---

## 2. Findings

### F1 — A removed member is locked out of the product (code-verified)

`remove_company_member_tx` (migration `20260519120000`, line ~438) clears
`profiles.last_active_company_id` but **leaves `organizer_legal_type='company'`**.

For a user whose only membership was removed:
- `legal_type='company'` + zero memberships → `buildOrganizerDecision` emits
  state `organizer.no_company` (`src/lib/auth/access.ts:264`)
- `organizer.no_company` grants `allowedRoutePrefixes` of only
  `/organizer/onboarding/company`, `/invite/organizer`, `/auth`, `/sign-out`
  (`src/lib/auth/featureMatrix.ts:157`)
- Middleware redirects anything else to `bestDestination`
  (`src/proxy.ts:87`)

Consequences:
- They cannot reach `/organizer/dashboard` and lose access to any **individual**
  events/bookings they own (`company_id IS NULL`, `organizer_id = them`).
- They cannot reach `/organizer/onboarding/company-choice` to re-declare as an
  individual — it is not under any allowed prefix (`isRouteAllowed` matches on
  exact or `prefix + "/"`, and `/organizer/onboarding/company-choice` is neither).
- The **"Back to choice" button** on the company-creation page
  (`.../onboarding/company/page.tsx:31`) links straight into that blocked route —
  a guaranteed middleware bounce.

Only escape: create a brand-new company.

**Fix:** in `remove_company_member_tx`, reset `organizer_legal_type` to `NULL`
(or `'individual'`) when the target has no remaining active memberships. Add
`/organizer/onboarding/company-choice` to the `organizer.no_company` allowed
prefixes as a second line of defence.

### F2 — Company identity never reaches any email (code-verified)

`src/lib/notifications/templates/_shared/organizerIdentity.ts` implements
`formatOrganizerIdentity()` — bilingual `"Acme Events — via Sara"`. Five
templates accept an `organizerCompanyName` prop.

**Every call site passes literal `null`:**

- `(organizer)/organizer/rfqs/[id]/quotes/actions.ts:348, :440`
- `(supplier)/supplier/rfqs/[id]/quote/actions.ts:649`
- `(supplier)/supplier/bookings/[id]/actions.ts:301, :454`

The `:649` site carries the comment *"PR 2: passive null. PR 3+ resolves from
rfqs.company_id joined to organizer_companies.name when present."* — that
follow-up was never done.

Effect: a supplier working with "Acme Events" always sees an individual's
personal name in every quote/booking email. The company brand is invisible
externally, which undercuts the point of the feature.

**Fix:** resolve `company_id → organizer_companies.name` at each of the 5 sites
and pass it through.

### F3 — Real-time notifications don't fan out to the team (code-verified)

Migration `20260519110000` added `notify_organizer_party(company_id, organizer_id, kind, payload)`
which inserts one notification per current member. It is used by **only the three
cron functions** (`expire_soft_holds`, `auto_mark_completed`, `close_stale_disputes`).

Every event-driven organizer notification still targets a single user:

- `(supplier)/supplier/rfqs/[id]/quote/actions.ts:631, :682` — quote sent / revised
- `(supplier)/supplier/rfqs/[id]/proposal-upload/actions.ts:194`
- `(supplier)/supplier/rfqs/actions.ts:83`
- `(supplier)/supplier/bookings/[id]/actions.ts:283, :437`

So when a supplier quotes a company RFQ, only the teammate who created the RFQ is
notified — in-app **and** by email. An owner monitoring the company pipeline gets
nothing. This is the highest-impact functional gap for day-to-day team use.

**Fix:** route these through `notify_organizer_party` (or an application-layer
equivalent that also handles the email recipient list).

### F4 — UI offers three actions the server rejects (code-verified)

PR 7 added admin↔admin guard rails server-side; the UI was not updated to match.

| Surface | Offered | Server response |
|---|---|---|
| `settings/members/members-table.tsx:130` | admin sees role dropdown on another **admin**'s row | `P0058 adminCannotChangeAdmin` |
| `settings/members/members-table.tsx:196` | admin sees Remove on another **admin**'s row | `P0059 adminCannotRemoveAdmin` |
| `settings/invites/invites-panel.tsx:122` | admin sees "Admin" in the invite role select | `P0061 adminCannotInviteAdmin` |

Root cause on the invites side: `page.tsx:67` passes only a boolean `canManage`
(owner OR admin) — the panel cannot distinguish the two.

**Fix:** pass `viewerRole` through to both components and gate the controls on
`viewerRole === 'owner'` where the server requires owner.

### F5 — The member spend cap can never be enabled (code-verified)

`organizer_companies.quote_acceptance_threshold_halalas` is enforced in
`accept_quote_tx_v2` (raises `P0060`), and the organizer action correctly maps
`P0060` (`.../rfqs/[id]/quotes/actions.ts:122`).

But `update_organizer_company_tx` (migration `20260519100000:322`) has **no
parameter for it**, and no UI or code path anywhere in `src/` writes the column
(grep for `quote_acceptance_threshold` returns zero hits outside migrations).

The column is permanently `NULL` = unlimited. A real financial control that is
plumbed end-to-end except for the one step that turns it on.

**Fix:** add the parameter to `update_organizer_company_tx` and a field on the
company settings form (owner-only).

### F6 — Messaging is per-user, not per-company (deliberate, but a real gap)

`src/lib/messaging/*` has no `company_id` anywhere; threads key on `user_id`.
Migration `20260519110000` states this explicitly: *"messaging threads are
per-user … and have no company concept, so fan-out doesn't apply."*

Consequence: a supplier↔organizer conversation about a company booking is visible
only to the individual who opened it. If that person leaves the company, the
thread is orphaned — no teammate can read or continue it. Worth a conscious
product decision rather than leaving it implicit.

### F7 — Dispute/review actions remain individual-only (deliberate)

`(organizer)/organizer/bookings/[id]/page.tsx:179`:

```ts
const canActOnBooking = row.organizer_id === user.id;
```

Documented as intentional — `disputes.server.ts` / `reviews.server.ts` still gate
on `organizer_id === viewerProfileId`, so the CTAs are hidden rather than shown
and rejected (good UX discipline). But the same leaver problem applies: once the
booking's creator is removed, **nobody** can file a dispute or leave a review on
that booking.

### F8 — Invite links are bearer tokens (deliberate — needs sign-off)

`invite/organizer/[id]/page.tsx:38-41` documents the choice: strict email match is
**not** enforced because KSA users commonly have multiple email identities; a
mismatch renders a warning banner only, and the accept RPC checks only
token + expiry + not-already-a-member.

So a forwarded invite email lets **any** organizer-role account claim the seat,
including at `admin` role. The token itself is strong (32 random bytes, sha256 at
rest, 7-day TTL, single-use, revocable, atomic resend). This is a defensible
trade-off, but since it is an admin-privilege grant path it deserves an explicit
decision rather than inheriting the default.

Mitigation if wanted: keep the loose match for `member`, require exact email match
for `admin` invites.

### F9 — Minor: no pre-check for already-a-member on invite creation

`createInviteAction` validates format and delegates to the RPC, which only checks
for a duplicate *pending* invite. Inviting someone who is already an active member
succeeds, sends an email, and fails at accept time with `alreadyMember`. Cheap to
pre-check in `create_organizer_invite_tx`.

---

## 3. What is solid

Worth stating plainly, because most of this is well built:

- Every mutation goes through a `SECURITY DEFINER` RPC with `lock_timeout` /
  `statement_timeout`, `FOR UPDATE` locking, stable errcodes, and an audit row.
- `resend_organizer_invite_tx` is atomic — a failed re-issue rolls back and leaves
  the original invite usable (fixes a prior revoke→create hole).
- `auto_promote_oldest_admin_to_owner` trigger prevents orphaned companies when
  the sole owner leaves.
- Sole-owner removal guard, one-active-owner partial unique index.
- Column-level `REVOKE` on the finance fields — defends even if RLS is bypassed.
- The 15s company-field TTL on the forwarded access header.
- Read scoping is applied uniformly; no organizer surface was found missing it.
- The backfill migration is idempotent and correctly conservative (only backfills
  creators who belong to exactly one company).

---

## 4. Suggested order of work

1. **F1** — user-facing lockout, small fix, highest severity.
2. **F3** — biggest day-to-day functional gap for teams.
3. **F4** — three small UI changes, removes visible errors.
4. **F2** — completes the company-branding story externally.
5. **F5** — enable the spend cap, or delete the column and the P0060 handling.
6. **F6 / F7 / F8** — product decisions, not bugs. Decide explicitly.
7. **F9** — cheap polish.
