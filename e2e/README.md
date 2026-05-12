# Sevent E2E tests

Playwright tests against the local dev stack. **Not run against production** — they take SQL shortcuts (fast-forward time, direct cron tick) that are safe in dev only.

## Running

```bash
# 1. Prereqs
pnpm db:start    # Supabase local stack
pnpm db:reset    # migrations + seed.sql
pnpm seed        # 1 admin + 2 organizers + 25 suppliers
pnpm dev         # Next.js on http://localhost:3000

# 2. First-time only — install Playwright browsers
pnpm exec playwright install chromium

# 3. Export env vars for the test process (mints its own service-role client)
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
export SUPABASE_SERVICE_ROLE_KEY="<paste-from-supabase-status>"

# 4. Run
pnpm test:e2e          # headless
pnpm test:e2e:ui       # Playwright UI mode for iterating
```

## What's covered today

**Sanity-level (runnable now):**
- Direct invocation of `auto_mark_completed()` and `publish_pending_reviews()` via the admin client (verifies the cron functions exist and return integer counts).
- Service-role helper smoke tests.

**Scaffolded but partially deferred:**
- Organizer event creation drives the UI form and captures the new `event_id`.
- RFQ wizard, quote submission, accept, confirm, contract download, review submission — **deferred** until the matching components carry stable `data-testid` hooks. The runbook in `Claude Docs/runbooks/e2e-happy-path-runbook.md` is the source of truth for the full flow; this Playwright spec is the automation that mirrors it.

## SQL-side coverage

Cron correctness is asserted with idempotency in:
- `supabase/tests/lifecycle_cron.test.sql` (Slice 1)
- `supabase/tests/dispute_lifecycle.test.sql` (Slice 4A)

Run them with:
```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
     -f supabase/tests/lifecycle_cron.test.sql
```

## Why scaffolded vs. complete?

The full happy-path automation is ~400 lines of UI driving. Doing it right requires `data-testid` hooks on the RFQ wizard, quote builder, accept/confirm CTAs, and the review form. Adding those is a separate pass — the scaffold gives the structure so the next iteration is just filling in the missing acts.
