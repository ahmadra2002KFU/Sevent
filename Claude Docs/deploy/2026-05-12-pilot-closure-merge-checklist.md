# Pilot-closure sprint — production merge checklist

**Branch:** `dev/pilot-closure-sprint` → `main`
**Commit range:** `06873bb..HEAD` (10 commits)
**Sprint slices landed:** 1 (cron), 2 (contracts), 3 (reviews), 4A (dispute schema), 4B (dispute UI), 6 (Playwright scaffold), plus 2 validation-pass bug fixes (`suppliers.representative_name`, `COMMENT ON POLICY storage.objects`).

> **Authoring note:** This list is what we agreed on during the 2026-05-12 validation pass. Tick through it in order. If anything in the "blocks deploy" section fails, **stop and ask** — most failures are recoverable with `scripts/retry-contract-render.ts` or a targeted SQL fix, not a rollback.

---

## 0 · Pre-merge sanity (local)

- [ ] `pnpm install` clean on this machine
- [ ] `pnpm build` succeeds (verifies TS + webpack)
- [ ] `supabase/tests/lifecycle_cron.test.sql` passes against local DB
- [ ] `supabase/tests/dispute_lifecycle.test.sql` passes against local DB

## 1 · Blocks deploy — verify on production

### Database

- [ ] **Take a DB snapshot/backup** before applying migrations. `pg_dump` or the equivalent on the host.
- [ ] On the VPS: `supabase migration up` applies all 6 sprint migrations without error.
  - If `20260512110000_contracts_party_read_rls.sql` errors with `42501`, the `COMMENT` fix didn't propagate — abort and pull latest.
  - If `20260512130000_dispute_evidence_bucket.sql` errors, the storage RLS migration is the suspect.
- [ ] `select * from cron.job order by jobname;` → expect 4 rows:
  - `expire-soft-holds` (every 5 minutes)
  - `auto-mark-completed` (hourly)
  - `publish-pending-reviews` (hourly)
  - `close-stale-disputes` (hourly)
- [ ] `select id, service_status, completed_at from public.bookings where service_status in ('completed','disputed');` — record every row.
  - Any row in `'disputed'` will be touched by the new resolve trigger if a dispute closes.
  - Any row in `'completed'` is in the new review-eligibility window.
  - **If you see customer bookings here, eyeball them before opening to traffic.**
- [ ] `select id, contract_pdf_path from public.bookings where confirmation_status='confirmed' and contract_pdf_path is null;` — these are bookings that confirmed but missed the contract (the bug I fixed today). For each row: `pnpm exec tsx scripts/retry-contract-render.ts <booking_id>`.

### App

- [ ] `pnpm install` on the VPS — picks up `@react-pdf/renderer` + `@playwright/test`.
- [ ] `pnpm build` on the VPS — should succeed clean (no TS errors).
- [ ] Restart the app process (`pm2 restart sevent` or `systemctl restart sevent`).
- [ ] `https://seventsa.com/` returns 200 (signed-out homepage).
- [ ] `https://api.seventsa.com/rest/v1/` returns 401 (Kong up, no API key — expected).

### Smoke tests (one per role)

- [ ] Sign in as your admin account at `seventsa.com`. Land on `/admin/dashboard`.
- [ ] Visit `/admin/disputes` — the new "Disputes" tab is present in the monitor sub-nav.
- [ ] Sign in as a real organizer. Navigate to any confirmed booking — verify "Download contract PDF" button if `contract_pdf_path` is set.
- [ ] Sign in as a real supplier. Visit `/supplier/dashboard`. No console errors in DevTools.

## 2 · Should-verify same day

- [ ] **Reverse review path:** on a freshly completed booking, log in as the organizer, leave a review, then run `select public.publish_pending_reviews();` in psql. Confirm both reviews now have `published_at` set and appear on `/s/<slug>`.
- [ ] **File evidence upload:** open a dispute, attach a PDF or image (the Chrome MCP test only covered note evidence). Verify the file lands in the `dispute-evidence` bucket and downloads via signed URL.
- [ ] **Contract download (signed URL):** on a real booking with `contract_pdf_path` set, click "Download contract PDF" as the organizer. Verify the PDF opens.
- [ ] **Resend email delivery:** confirm `RESEND_API_KEY` is set on the VPS (`echo $RESEND_API_KEY | head -c 4`). Send a supplier-approval email via the admin verification flow and check the recipient's inbox.
- [ ] **`/admin/disputes` paginates:** if you have 25+ existing disputes (likely zero on day 1), confirm pagination works. Otherwise just visit the empty list.

## 3 · Untested in this sprint (track for next)

These are gaps, not regressions — useful to know about so the first customer report doesn't surprise you:

- Decline booking flow (only confirm was tested)
- Soft-hold expiry against a real awaiting_supplier booking (only SQL test)
- Quote revision flow (only initial quote)
- Arabic locale UI walkthrough
- VAT-inclusive pricing path
- Multi-line-item quotes
- Concurrent bookings on the same supplier

## 4 · Rollback plan

If anything in section 1 fails after migration starts and you can't fix forward:

1. The 4 cron functions are `CREATE OR REPLACE` and safe to leave in place.
2. The dispute triggers can be dropped without data loss: `drop trigger disputes_open_set_state on public.disputes;` and `drop trigger disputes_resolve_restore_state on public.disputes;` — bookings won't auto-update but won't corrupt either.
3. The `dispute-evidence` bucket survives a code rollback — it's just a private bucket with no app-visible data on day 1.
4. App-level rollback: `git checkout <previous-commit>` on the VPS, `pnpm install`, `pnpm build`, restart. The DB stays migrated; only the UI/server-action layer rolls back.

## 5 · Where the validation evidence lives

- SQL tests: `supabase/tests/{lifecycle_cron,dispute_lifecycle}.test.sql`
- Slice 4B screenshots: `Claude Docs/screenshots/2026-05-12-slice-4b-validation/`
- End-to-end supplier journey screenshots: `Claude Docs/screenshots/2026-05-12-supplier-journey/`
- Reproducible capture scripts: `scripts/capture-slice-4b-screenshots.ts`, `scripts/capture-supplier-journey-screenshots.ts`
- Contract retry tool: `scripts/retry-contract-render.ts`
