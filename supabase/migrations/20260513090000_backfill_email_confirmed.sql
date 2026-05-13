-- Pilot-cutover one-shot: backfill email_confirmed_at for every existing user
-- created BEFORE this migration runs. We did this once when flipping
-- `enable_confirmations` from false → true; without it every pre-cutover
-- account would be locked out by Supabase's "you must confirm" gate.
--
-- This migration is intentionally idempotent on a fresh DB (zero matching
-- rows) and safe to re-run. Do NOT generalize this to a recurring backfill;
-- new users from the cutover forward must confirm normally.
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email_confirmed_at IS NULL
  AND created_at < now();
