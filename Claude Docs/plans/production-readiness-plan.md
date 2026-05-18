> **Implementation status (2026-05-17):** Active hardening plan, partially implemented. It is the current source for moving the MVP to production; RFQ marketplace atomic publishing is done, but infrastructure, testing, security, and operations gaps remain.

# Sevent Production Readiness Plan

Prepared: 2026-05-17

This plan turns the current functional MVP into a production-ready platform. The priority is to harden the existing marketplace loop before adding more feature surface.

## Bottom Line

Sevent already has the shape of a real platform: supplier onboarding, admin approval, public supplier profiles, organizer RFQs, supplier quotes, quote comparison, bookings, contracts, reviews, disputes, messaging, notifications, and email.

The next phase should focus on reliability, security, deployment, testing, observability, and operational control.

## Priority 0: Launch Blockers

1. Fix the booking lifecycle bug where expired soft holds cancel the booking and return the quote to `sent`, but do not restore the RFQ from `booked` back to `sent`.
2. Make RFQ marketplace publishing atomic. The `publish_to_marketplace` flag should be part of `send_rfq_tx`, not a follow-up update after the RFQ is created.
3. Make supplier self-apply truly idempotent with conflict-safe insert/upsert behavior.
4. Add row claiming or locking to the email outbox worker so two cron runs cannot process the same pending email rows.
5. Add a drainer for queued orphan proposal files.
6. Decide what `/supplier/catalog` is for launch: ship it fully or remove it from enabled navigation.
7. Remove temporary zero-document supplier verification before public launch, or explicitly define it as an approved business policy.

## Production Infrastructure

1. Choose the production Supabase model: hosted Supabase or self-hosted Supabase. Do not leave this ambiguous.
2. Replace the skeleton `docker-compose.prod.yml` with real production deployment assets, or remove it and document the actual deployment path.
3. Normalize environment variable names across code, `.env.example`, README, and deployment docs.
4. Add missing production env vars to `.env.example`, including `CRON_SECRET` and `RESEND_WEBHOOK_SECRET`.
5. Remove absolute local Windows paths from `supabase/config.toml` email template settings.
6. Add `/api/healthz` and `/api/readyz`.
7. Add a verified backup and restore procedure. Backup creation alone is not enough.
8. Set up a real staging environment with its own database, storage, email mode, and seed data.

## Security

1. Audit every service-role call. The current pattern is acceptable only when each read/write proves ownership in code.
2. Generate Supabase TypeScript types from the database instead of relying on hand-maintained types.
3. Add RLS regression tests for all important user boundaries.
4. Require `CRON_SECRET` in production. The cron route should not allow unauthenticated calls outside local dev.
5. Add rate limits for auth, RFQ creation, quote submission, messaging, feedback, and file uploads.
6. Add admin audit logs for verification approvals, supplier rejection, dispute resolution, and manual user changes.

## Testing And CI

1. Add one command such as `pnpm check` that runs lint, typecheck, unit tests, and relevant database tests.
2. Add CI, at minimum a GitHub Actions pipeline.
3. Complete the Playwright happy path:
   - Organizer creates event.
   - Organizer creates and sends RFQ.
   - Supplier submits quote.
   - Organizer accepts quote.
   - Supplier confirms booking.
   - Contract appears.
   - Both parties submit reviews.
4. Run E2E coverage in English and Arabic.
5. Run E2E coverage on desktop and mobile.
6. Add SQL tests for lifecycle restoration, self-apply concurrency, quote acceptance concurrency, storage access, and email outbox claiming.
7. Add smoke tests against staging after deploy.

## Observability

1. Add Sentry or equivalent for server and client errors.
2. Add structured logs for auth failures, service-role actions, cron jobs, email sends, webhook results, and booking state changes.
3. Add cron heartbeat monitoring for:
   - Email outbox drain.
   - Soft-hold expiry.
   - Review publishing.
   - Stale dispute closure.
4. Add an admin operational dashboard for:
   - Failed emails.
   - Failed contracts.
   - Stuck bookings.
   - Stale pending suppliers.
   - Pending disputes.
5. Monitor database size, slow queries, storage growth, and queue depth.

## Reliability

1. Move all transactional email to the durable outbox path. Phase out direct sends.
2. Make contract generation retryable as a background job. Booking confirmation should not permanently depend on synchronous PDF rendering.
3. Add recovery jobs for stuck states:
   - Confirmed booking with no contract.
   - Sent quote with unflipped invite.
   - Pending email over retry limit.
   - Orphaned storage object.
4. Put state-machine invariants in tests and admin alerts.

## Product And Business Hardening

1. Define supplier verification policy legally:
   - Required documents.
   - Reviewer responsibilities.
   - Data retention.
   - Rejection and resubmission rules.
2. Decide payments:
   - If payments are not in MVP, UI and contract language must say so clearly.
   - If payments are in scope, integrate a payment service provider and reconciliation flow.
3. Formalize dispute operations:
   - Statuses.
   - SLA.
   - Evidence visibility.
   - Admin playbook.
   - Final decision trail.
4. Review legal documents:
   - Terms of service.
   - Privacy policy.
   - Supplier agreement.
   - Commission terms.
   - Cancellation policy.
   - VAT and tax invoice handling.
   - Saudi data and privacy obligations.
5. Add support workflows:
   - Account suspension.
   - Supplier takedown.
   - User support escalation.
   - Refund or cancellation handling.
   - User impersonation policy, if impersonation is ever added.

## Scale And Performance

1. Load test RFQ browse, quote comparison, supplier public profile, and admin monitors.
2. Review indexes after realistic seed data, not tiny seed data.
3. Expand `next.config.ts` image remote patterns for the real production storage host.
4. Move expensive or background tasks out of request paths where needed.
5. Add pagination everywhere admin or marketplace data can grow.

## Recommended Execution Order

1. Stabilize core lifecycle bugs and service-role safety.
2. Fix deployment and environment drift.
3. Add staging.
4. Add CI and a full happy-path E2E suite.
5. Harden email, cron, and contract generation into retryable operations.
6. Add observability and admin operations dashboards.
7. Complete legal, payment, and verification decisions.
8. Resume feature expansion only after the core marketplace loop is stable.

## Success Criteria

Sevent should be considered production-ready when:

1. The full RFQ-to-booking-to-review path passes automated E2E tests.
2. All production env vars are documented and validated.
3. Cron jobs have heartbeat monitoring and failure visibility.
4. Email delivery is durable and retryable.
5. Contract generation is retryable and observable.
6. Core RLS and service-role ownership boundaries have regression tests.
7. Staging and production deployment steps are repeatable.
8. Backup restore has been tested.
9. Admins can see and recover stuck operational states.
10. Supplier verification and legal policies are approved.
