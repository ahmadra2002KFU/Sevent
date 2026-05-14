-- Sevent · migration 20260514100000: schedule the email-outbox drain worker.
-- Sprint "Resend everywhere" — Phase 3.2.
--
-- This migration schedules a once-a-minute pg_cron job that drains
-- public.email_outbox by calling the Next.js route GET/POST
-- /api/cron/email-outbox (src/app/api/cron/email-outbox/route.ts).
--
-- Why HTTP and not a plain SQL function (like the lifecycle crons):
--
--   The drain worker (drainEmailOutbox in src/lib/notifications/worker.ts)
--   renders React email templates and calls the Resend SDK. None of that can
--   run inside Postgres. So pg_cron cannot `select some_function()` here — it
--   must reach OUT to the app over HTTP. We use the pg_net extension's
--   net.http_post() for that fire-and-forget call.
--
-- Where the URL + secret come from:
--
--   Migrations are env-agnostic — the exact same migration file runs against
--   the dev stack and the prod stack — so we MUST NOT bake an environment URL
--   or secret into this file. Instead the job reads two per-environment
--   Postgres GUCs at run time:
--
--     app.cron_base_url  — origin of the app, no trailing slash
--     app.cron_secret    — value sent in the `x-cron-secret` header; must
--                          match the app's CRON_SECRET env var
--
--   These are set OUTSIDE migrations via `ALTER DATABASE ... SET ...`,
--   mirroring the repo's existing dev/prod config split (see the three
--   config.toml fields that flip between envs). Run ONCE per environment:
--
--     -- dev (Next.js dev server reachable from the Supabase containers):
--     alter database postgres
--       set app.cron_base_url = 'http://host.docker.internal:3000';
--     alter database postgres
--       set app.cron_secret = '<dev CRON_SECRET>';
--
--     -- prod:
--     alter database postgres
--       set app.cron_base_url = 'https://www.seventsa.com';
--     alter database postgres
--       set app.cron_secret = '<prod CRON_SECRET>';
--
--   (A reconnect / new session is needed for ALTER DATABASE settings to take
--   effect; pg_cron starts each job in a fresh session so this is automatic.)
--
-- We read the GUCs with current_setting(name, true) — the `true` is
-- missing_ok, so an unset GUC yields NULL instead of raising. If the GUCs are
-- unset the POST is built with a NULL url and net.http_post simply no-ops
-- (no email is drained) until an operator configures the environment. That
-- is the intended safe default: a fresh stack does nothing until told where
-- the app lives.

set search_path = public;

-- pg_net provides net.http_post() for outbound HTTP from Postgres.
create extension if not exists pg_net;

-- =============================================================================
-- Schedule the drain job
-- =============================================================================
--
-- cron.schedule() is idempotent on jobname — re-running this migration just
-- updates the schedule/command for 'drain-email-outbox' (consistent with the
-- lifecycle cron migration, 20260512100000_lifecycle_cron_jobs.sql). A future
-- migration can `cron.unschedule('drain-email-outbox')` if needed.
--
-- Schedule: every minute. The worker self-batches, so a minute granularity is
-- plenty for transactional email latency while keeping load trivial.

select cron.schedule(
  'drain-email-outbox',
  '* * * * *',
  $$
  select net.http_post(
    url := current_setting('app.cron_base_url', true) || '/api/cron/email-outbox',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.cron_secret', true)
    ),
    body := '{}'::jsonb
  )
  $$
);
