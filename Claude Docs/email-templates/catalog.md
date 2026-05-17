> **Implementation status (2026-05-17):** Partially implemented. Several supplier, organizer, messaging, and RFQ email templates are now wired; the catalog still contains backlog items and stale statuses.

# Sevent — Email Template Catalog

Every transactional email Sevent should send, grounded in actual code paths and database state machines. Each template needs both Arabic and English variants (see `architecture.md` for the locale strategy).

**Total: ~46 distinct templates → ~92 files with AR/EN pairs.**

Legend:
- **Status** column: `built` (in repo, code), `wired` (notification kind exists, just needs email), `gap` (no notification today either — net new).
- **Source-file evidence** points at the file/line that already (or should) call `createNotification(...)`.
- **Suggested name** is the React-Email component / file name in `src/lib/notifications/templates/`.

---

## 1. Auth & Public

Triggered before a user has a confirmed Sevent account, or as part of credential lifecycle.

| # | Trigger | Recipient | CTA | Suggested name | Status | Source / notes |
|---|---|---|---|---|---|---|
| A1 | Sign-up requires email confirmation | new user (organizer or supplier) | Click confirm link → `/sign-in?confirm=1&role=…` | `auth_verify_email` | gap | `src/app/(auth)/actions.ts:66-78,116-128` — currently delivered by **Supabase**, not Resend (open decision in `architecture.md`) |
| A2 | First sign-in after confirmation | newly-confirmed user | Sign in → role-aware landing | `auth_welcome_organizer`, `auth_welcome_supplier` | gap | One welcome email per role; today there is no welcome email at all |
| A3 | Password reset link | any signed-up user | Set a new password (link expires in 1 h) | `auth_password_reset` | gap | Standard Supabase flow; same Resend-vs-Supabase decision as A1 |
| A4 | Password successfully changed | any signed-up user | informational only | `auth_password_changed` | gap | Hook on `auth.updateUser({password})` |
| A5 | Email-address change requested | user (at the **new** address) | Click link in new inbox to confirm | `auth_email_changed` | gap | Hook on `auth.updateUser({email})` |
| A6 | Magic-link sign-in (if enabled) | user | Click to sign in | `auth_magic_link` | gap | `src/app/(auth)/actions.ts:200-217` — Google OAuth doesn't need this |

---

## 2. Supplier Onboarding & Verification

Wizard is 3 Zod-validated steps after a path-picker. Today only the admin's approve/reject sends an email — **all other onboarding events are silent**.

| # | Trigger | Recipient | CTA | Suggested name | Status | Source / notes |
|---|---|---|---|---|---|---|
| O1 | Supplier picks legal type → `suppliers` shell row created (`verification_status='pending'`) | supplier | Continue wizard step 1 | `supplier_onboarding_started` | gap | `src/app/(onboarding)/supplier/onboarding/path/actions.ts:60-71` |
| O2 | Step 3 succeeds (last write — IBAN PDF + company docs uploaded) → de-facto "submit for review" | supplier | Wait — admin reviews within 1–2 business days | `supplier_application_received` | gap | `src/app/(onboarding)/supplier/onboarding/actions.ts:580-608` |
| O3 | Same trigger as O2 | **admin queue** | Open `/admin/verifications/[id]` | `admin_supplier_pending_review` | gap | No admin-side notify exists today (`grep notify.*admin` = 0) |
| O4 | `approveSupplierAction` flips `verification_status='approved'`, publishes profile | supplier | "Open dashboard" → `/supplier/dashboard` | `supplier_approved` | **built** (EN) — needs AR twin | `src/app/(admin)/admin/verifications/actions.ts:161-251`; template at `src/lib/notifications/templates/SupplierApproved.tsx` |
| O5 | `rejectSupplierAction` flips `verification_status='rejected'` with notes | supplier | "Update your application" → `/supplier/onboarding` | `supplier_rejected` | **built** (EN) — needs AR twin | `src/app/(admin)/admin/verifications/actions.ts:253-350`; template at `SupplierRejected.tsx` |
| O6 | `approveDocAction` (per-document) → `supplier.doc.approved` notification | supplier | informational | `supplier_doc_approved` | wired | `src/app/(admin)/admin/verifications/actions.ts:86-118` — kind exists, no email |
| O7 | `rejectDocAction` flips `supplier_docs.status='rejected'` with notes | supplier | "Re-upload {docType}" → onboarding step 3 | `supplier_doc_rejected` | wired | `src/app/(admin)/admin/verifications/actions.ts:120-155` |

---

## 3. Organizer

Events (auto-fan-out as RFQs), the standalone RFQ wizard, the quote inbox, bookings.

| # | Trigger | Recipient | CTA | Suggested name | Status | Source / notes |
|---|---|---|---|---|---|---|
| OR1 | `createEventAction` → auto-publishes each بند as an RFQ (RFQ `draft → sent`) | organizer | Open the event page | `organizer_event_created` | gap | `src/app/(organizer)/organizer/events/actions.ts:132-207` |
| OR2 | `addBandAction` adds another بند → publishes a new RFQ | organizer | Link to the new RFQ's quote inbox | `organizer_band_added` | gap | `src/app/(organizer)/organizer/events/actions.ts:221-267` |
| OR3 | `sendRfqAction` (`send_rfq_tx`) — RFQ goes `draft → sent`, fans out invites | organizer | Open RFQ → Quotes tab | `organizer_rfq_sent` | gap | `src/app/(organizer)/organizer/rfqs/actions.ts:289-385` |
| OR4 | First quote arrives — `quote.sent` (version=1) | organizer | Open `/organizer/rfqs/{rfq}/quotes/{quote}` | `organizer_quote_received` | wired | `src/app/(supplier)/supplier/rfqs/[id]/quote/actions.ts:533-548` |
| OR5 | Quote revised — `quote.revised` (version > 1) | organizer | Open quote diff page | `organizer_quote_revised` | wired | same file as OR4 |
| OR6 | Supplier declines invite — `rfq_invite_declined` | organizer | Replace supplier in shortlist or wait | `organizer_invite_declined` | wired | `src/app/(supplier)/supplier/rfqs/actions.ts:14-94` |
| OR7 | `acceptQuoteAction` → booking created (`awaiting_supplier`) — `booking.created` | organizer | Open `/organizer/bookings/{id}`; watch the 48 h supplier-confirm timer | `organizer_booking_created` | wired | `src/app/(organizer)/organizer/rfqs/[id]/quotes/actions.ts:217-233,275` |
| OR8 | Supplier confirms booking — `booking.confirmed` | organizer | Download supplier company-profile PDF (now unlocks) | `organizer_booking_confirmed` | wired | `src/app/(supplier)/supplier/bookings/[id]/actions.ts:51-110` |
| OR9 | Supplier declines/cancels — `booking.cancelled` (`cancelled_by:'supplier'`) | organizer | Re-open the RFQ and accept another quote | `organizer_booking_cancelled_by_supplier` | wired | `src/app/(supplier)/supplier/bookings/[id]/actions.ts:112-178` |
| OR10 | Soft-hold auto-cancelled after 48 h | organizer (paired with OR-supplier-side) | Re-accept another quote | `organizer_booking_auto_cancelled` | gap | `state-machines.md:62-77` — pg_cron not deployed; test at `src/lib/domain/booking/__tests__/soft_hold_expiry.test.ts` |
| OR11 | `requestProposalAction` — organizer asks supplier for technical proposal PDF | organizer (own confirmation copy) | Wait for supplier upload | `organizer_proposal_request_sent` | wired | `src/app/(organizer)/organizer/rfqs/[id]/quotes/actions.ts:305-449` |
| OR12 | Supplier fulfills request — `quote.proposal_fulfilled` | organizer | Download PDF + compare quotes | `organizer_proposal_received` | wired | `src/app/(supplier)/supplier/rfqs/[id]/proposal-upload/actions.ts:202-218` |
| OR13 | RFQ deadline approaching with low responses | organizer | Pick more suppliers or extend deadline | `organizer_rfq_no_responses_reminder` | gap | needs cron |
| OR14 | Booking event date approaching (D-7 / D-1) | organizer | Confirm logistics with supplier | `organizer_booking_event_reminder` | gap | needs cron; key off `events.starts_at` |

---

## 4. Supplier

Marketplace self-apply, invite responses, quote builder, technical-proposal upload, booking confirm/decline.

| # | Trigger | Recipient | CTA | Suggested name | Status | Source / notes |
|---|---|---|---|---|---|---|
| SU1 | New `rfq_invite` row — either via shortlist fan-out or `applyToOpportunity` | supplier | Open `/supplier/rfqs/{invite_id}` | `supplier_rfq_invited` | gap | RPC `send_rfq_tx` (`supabase/migrations/20260420050000_send_rfq_tx.sql`) + `src/app/(supplier)/supplier/opportunities/[id]/apply.ts:95-114` |
| SU2 | Marketplace RFQ matching supplier's subcategories | supplier (digest cadence) | Browse opportunities | `supplier_marketplace_opportunity` | gap | needs matcher; `supplier_categories` ↔ `rfqs.subcategory_id` |
| SU3 | `requestProposalAction` (organizer asks for technical proposal) — `quote.proposal_requested` | supplier | Upload PDF via `/supplier/rfqs/{invite_id}/proposal-upload` | `supplier_proposal_requested` | wired | `src/app/(organizer)/organizer/rfqs/[id]/quotes/actions.ts:421-435` |
| SU4 | Organizer cancels their proposal request | supplier | informational | `supplier_proposal_request_cancelled` | gap | `src/app/(organizer)/organizer/rfqs/[id]/quotes/actions.ts:456-551` (no supplier-side notify written today) |
| SU5 | Quote accepted by organizer — `quote.accepted` + `booking.awaiting_supplier` | supplier | Confirm by deadline (48 h) or decline | `supplier_quote_accepted` | wired | `src/app/(organizer)/organizer/rfqs/[id]/quotes/actions.ts:175-213` |
| SU6 | Sibling quote auto-rejected — `quote.rejected` (`reason:'another_quote_accepted'`) | supplier (sibling losers) | informational | `supplier_quote_rejected` | wired | `src/app/(organizer)/organizer/rfqs/[id]/quotes/actions.ts:238-264` |
| SU7 | Quote-deadline approaching | supplier | Update or re-send the quote | `supplier_quote_expiring` | gap | needs cron |
| SU8 | Quote auto-expired | supplier | Re-quote if invite still open | `supplier_quote_expired` | gap | needs cron |
| SU9 | Booking date approaching (D-7 / D-1) | supplier | Prep — see organizer brief | `supplier_booking_event_reminder` | gap | needs cron |
| SU10 | Soft-hold auto-cancelled (48 h elapsed, supplier didn't confirm) | supplier (paired with OR10) | informational — quote returned to inbox | `supplier_booking_auto_cancelled` | gap | needs cron |

---

## 5. Admin

There are **zero admin-side notifications today**. Every row below is net new (and unblocks an admin email channel).

| # | Trigger | Recipient | CTA | Suggested name | Status | Source / notes |
|---|---|---|---|---|---|---|
| AD1 | New supplier finishes step 3 (paired with O3) | admin | Open `/admin/verifications/[id]` | `admin_supplier_pending_review` | gap | see O3 |
| AD2 | Supplier email hard-bounced — `supplier.email.delivery_failed` | admin | Reach supplier out-of-band | `admin_supplier_email_bounce` | wired | `src/lib/notifications/inApp.ts:16` and `src/app/(admin)/admin/dashboard/page.tsx:108,321,360` |
| AD3 | New feedback row (especially `category='bug'` with `console_errors`) | admin | Open `/admin/feedback` | `admin_feedback_received` | gap | `src/app/_actions/feedback.ts:87-205` |
| AD4 | Booking disputed — `booking_service_status='disputed'` | admin | Open dispute case | `admin_dispute_opened` | gap | enum exists at `supabase/migrations/20260420000100_marketplace_schema.sql:46`; no UI yet |
| AD5 | Suspicious supplier activity (e.g., 3rd re-upload of same doc) | admin | Investigate | `admin_supplier_flagged` | gap | no detector yet |
| AD6 | Daily / weekly admin digest of pending reviews + disputes + feedback | admin | Open dashboard | `admin_daily_digest` | gap | optional; needs scheduler |

---

## 6. Cross-cutting (V2 / future)

Schema exists in places but the surface isn't built yet. We pre-design these so the catalog is complete.

| # | Trigger | Recipient | Suggested name | Status | Notes |
|---|---|---|---|---|---|
| X1 | Login from a new device / IP | all roles | `auth_new_device_signin` | gap | requires login-event hook |
| X2 | Account role changed / deleted | user | `account_role_changed`, `account_deleted` | gap | |
| X3 | Payment receipt — booking deposit | organizer + supplier | `payment_receipt_organizer_deposit`, `payment_receipt_supplier_deposit` | gap | `booking_payment_status` enum exists; no payment surface yet |
| X4 | Payment receipt — final balance | organizer + supplier | `payment_receipt_organizer_final`, `payment_receipt_supplier_final` | gap | |
| X5 | Refund processed | organizer | `payment_refund_issued` | gap | |
| X6 | Review reminder after `booking.completed` | organizer + supplier | `review_reminder_organizer`, `review_reminder_supplier` | gap | `state-machines.md:88-101`; 14-day window |
| X7 | Review published / suppressed for dispute | reviewer + reviewee | `review_published`, `review_suppressed_for_dispute` | gap | |
| X8 | Weekly executive digest | leadership | `weekly_exec_digest` | gap | mirrors `Claude Docs/deliverables/weekly-reports/` |

---

## 7. Role-pairing summary

So we don't ship one side of an event without the other.

| Event | Sender side | Receiver side |
|---|---|---|
| RFQ sent | `organizer_rfq_sent` (OR3) | `supplier_rfq_invited` (SU1) |
| Invite declined | (toast) | `organizer_invite_declined` (OR6) |
| Quote sent / revised | (toast) | `organizer_quote_received` / `organizer_quote_revised` (OR4/5) |
| Quote accepted | `organizer_booking_created` (OR7) | `supplier_quote_accepted` (SU5) |
| Sibling quotes auto-rejected | (organizer already knows) | `supplier_quote_rejected` (SU6) |
| Booking confirmed | (toast) | `organizer_booking_confirmed` (OR8) |
| Booking cancelled by supplier | (toast) | `organizer_booking_cancelled_by_supplier` (OR9) |
| Soft-hold expired | `organizer_booking_auto_cancelled` (OR10) | `supplier_booking_auto_cancelled` (SU10) |
| Proposal request | `organizer_proposal_request_sent` (OR11) | `supplier_proposal_requested` (SU3) |
| Proposal request cancelled | (toast) | `supplier_proposal_request_cancelled` (SU4) |
| Proposal fulfilled | (toast) | `organizer_proposal_received` (OR12) |
| Supplier approved / rejected | (admin sees result) | `supplier_approved` / `supplier_rejected` (O4/5) |
| Document approved / rejected | (admin sees result) | `supplier_doc_approved` / `supplier_doc_rejected` (O6/7) |
| Onboarding step 3 submitted | `supplier_application_received` (O2) | `admin_supplier_pending_review` (O3 / AD1) |

---

## 8. Suggested build order

A minimum-viable email layer, in priority order:

1. **Onboarding loop close** — O2 + O3 + AR-twins of O4/O5. Closes the supplier verification round-trip.
2. **Quote → booking spine** — OR4, OR7, OR8, OR9, SU1, SU5, SU6 (all already have a notification kind; just add `sendEmail` next to `createNotification`).
3. **Auth basics (decision dependent)** — A1, A3 (need to decide Resend-vs-Supabase first).
4. **Proposal mini-flow** — OR11, OR12, SU3, SU4.
5. **Admin alerts** — AD1, AD3 (highest-signal admin emails).
6. **Reminders (cron-blocked)** — OR13, OR14, SU7, SU8, SU9, OR10, SU10. Cron has to ship first.
7. **V2 surfaces** — payments, reviews, disputes (X3–X7) when those features land.
