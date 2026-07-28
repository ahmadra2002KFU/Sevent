# Teams / Companies — F1–F5 Fixes

Date: 2026-07-28
Companion to [teams-companies-review.md](./teams-companies-review.md).
Branch: `feat/logo-rebrand`. Not committed — changes are in the working tree.

All five core findings are fixed and verified. F6–F8 were product decisions, not
bugs, and are deliberately untouched.

---

## Verification summary

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `vitest run` | 199 passed, 12 skipped (skips are `INTEGRATION=1`-gated DB tests) |
| `eslint` on changed areas | 0 errors |
| SQL scenario tests (rollback-wrapped, against the live local DB) | 9/9 pass |
| Dev server routes | `/`, `/categories`, `/sign-in` → 200; settings routes → 307 auth redirect |

New tests added: **46** (15 permission-mirror, 17 fan-out, 14 email-render).

---

## F1 — Removed member no longer locked out

**Migration** `20260728120000_organizer_company_membership_exit_fixes.sql`

1. `remove_company_member_tx` now resets `profiles.organizer_legal_type` to
   `NULL` when the removed member has **no remaining active membership**. NULL
   (not `'individual'`) is deliberate: it means "not declared", so the resolver
   yields `organizer.active`, the dashboard and the member's own individual rows
   come back, and the dismissible onboarding banner offers a clean re-entry into
   company creation. Writing `'individual'` would assert a choice the user never
   made and suppress that banner.
2. A one-time backfill frees anyone already trapped by the old behaviour.
3. New `reset_orphaned_company_legal_type(profile_id)` RPC — an atomic,
   race-free self-heal (the `NOT EXISTS` lives inside the `UPDATE`, so a
   concurrent company creation resolves correctly either way).

**App changes**
- `featureMatrix.ts` — added `/organizer/onboarding/company-choice` to the
  `organizer.no_company` allowed prefixes, so the company page's "back to
  choice" link can never be a dead bounce again.
- `company-choice/page.tsx` — calls the self-heal RPC before deciding whether to
  bounce. Non-fatal on error.

**Verified** (rollback-wrapped SQL against the live DB):
- removed member → `legal_type` becomes NULL ✓
- member of two companies leaving one → keeps `'company'` ✓
- then leaving the last one → resets ✓
- self-heal RPC heals an orphan ✓ and is a no-op for a real member ✓

## F4 — UI no longer offers actions the server rejects

**New** `src/lib/auth/companyPermissions.ts` — pure, client-safe predicates that
mirror the RPC guard rails exactly, with the source migration cited per rule:

| Predicate | Mirrors |
|---|---|
| `canChangeMemberRole` | P0056 owner rows, P0058 admin↔admin (self-demote allowed) |
| `canRemoveMember` | P0044 sole owner, P0059 admin↔admin (self-leave allowed) |
| `canInviteAtRole` | P0052 owner role, P0061 admin-cannot-mint-admin |

Wired into `members-table.tsx` and `invites-panel.tsx`; `invites/page.tsx` now
passes `viewerRole` rather than only a `canManage` boolean — that missing
distinction was the root cause of the invite half.

Pinned by **15 tests** including the two easy-to-miss exemptions (an admin *may*
demote themselves; anyone non-owner *may* leave).

## F5 — Member spend cap is now settable

**Migration** `20260728130000_organizer_company_spend_cap_settable.sql`
- `CHECK` constraint: cap is NULL or `>= 0` (added `NOT VALID` then validated,
  to avoid a long lock).
- `update_organizer_company_tx` replaced with a 10-arg version taking
  `p_quote_acceptance_threshold_halalas` **and** `p_update_threshold`. The
  explicit boolean is required because NULL is a *meaningful* value here
  (unlimited), so it cannot double as "leave unchanged" — without it, an admin
  saving the company profile would silently wipe the owner's cap.
- Cap changes are **owner-only** (new errcode **P0062**): it bounds what
  everyone else may commit the business to, so it should not be adjustable by
  the role it constrains.

**App changes** — owner-only field on the company settings form (entered in
whole SAR, stored as halalas), zod validation capped at 100,000,000 SAR,
`notOwner` + `thresholdInvalid` error codes, EN + AR strings.

**Verified** end to end: owner sets 5,000 SAR ✓ · admin's profile save preserves
it ✓ · admin setting it is refused with P0062 ✓ · owner clears to unlimited ✓ ·
negative rejected by CHECK ✓. Confirmed the live `accept_quote_tx_v2` reads the
column, so the enforcement loop is genuinely closed.

## F2 — Company identity now reaches every email

**New** `src/lib/notifications/companyIdentity.ts` —
`resolveOrganizerCompanyName()` and `resolveCompanyNameForBooking()`. Degrades to
`null` on lookup failure, which is exactly the pre-fix behaviour, so a missing
name can never block a lifecycle email.

All five call sites that hardcoded `organizerCompanyName: null` now pass a real
value. The organizer-side sites derive it from the **event's** company (the same
value the RPC validated), not the caller's active company, so a legacy
individual event stays individual in the copy.

**New** `_shared/CompanyContextLine.tsx` — a muted `Workspace · Acme Events` line
on organizer-facing emails. This became necessary *because* of F3: once a mail
fans out, the recipient may belong to several companies and may not be the
person who raised the RFQ, so naming the workspace is what makes the mail
actionable. Supplier-facing mail keeps `formatOrganizerIdentity()`
("Acme Events — via Sara"), where the company is the primary identity.

Pinned by **14 render tests** asserting on rendered HTML, both locales, and the
unchanged individual-organizer path.

## F3 — Notifications now reach the whole team

**New** `src/lib/notifications/organizerFanout.ts` — the TypeScript counterpart
of the SQL helper `notify_organizer_party`, mirroring its semantics exactly:

```
companyId IS NULL → the individual organizer alone
companyId present → every membership with removed_at IS NULL
```

Emails render **per recipient**, so an Arabic-speaking owner and an
English-speaking member on the same company each get their own language.

Applied at all **7** real-time sites (quote sent, quote revised, proposal
uploaded, RFQ response, booking confirmed, booking cancelled, quote accepted).
`grep` for single-recipient organizer notifications now returns nothing.

Failure handling is deliberate: a membership-lookup failure or a memberless
company degrades to notifying the individual organizer rather than dropping the
signal; one recipient throwing does not stop the others.

Pinned by **17 tests** covering fan-out, locale-per-recipient, de-duplication,
every degradation path, and the no-op case.

---

## Incidental

- `vitest.config.ts` aliases `server-only` to a no-op stub
  (`src/lib/__mocks__/server-only.ts`) so server modules that guard themselves
  with it stay unit-testable. Without this the fan-out module could not be
  tested at all.
- Fixed a **pre-existing** lint error at `settings/invites/page.tsx:36`
  (`Date.now()` in render). It was on `HEAD`, not introduced here, but sat in a
  file being changed and would have failed CI. Fixed with the same
  `eslint-disable` + rationale pattern the codebase already uses at
  `invite/organizer/[id]/page.tsx:132`.

## Known, not fixed

- `/api/cron/email-outbox` logs `SyntaxError: Unexpected end of JSON input` in
  dev. **Not blocking** — verified `pg_net` receives HTTP 200 with a valid drain
  summary and the outbox drains. Pre-existing dev-mode noise.
- **F6** messaging is per-user, **F7** dispute/review actions are locked to the
  booking's creator, **F8** invite links are bearer tokens with email match
  warned rather than enforced. All three are documented deliberate decisions
  needing a product call, not code fixes.

## Before deploying

Two new migrations must run on staging/production. Note the review also found
that **three earlier migrations** (`20260521120000` backfill, `20260527120000`
taxonomy, `20260603000000` rebrand) were applied locally but showed as **not
applied on remote** — check that before shipping these two.
