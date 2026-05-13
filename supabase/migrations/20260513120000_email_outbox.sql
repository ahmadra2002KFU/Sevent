-- Sevent · migration 20260513120000: email outbox.
-- Sprint "Resend everywhere" — Phase 2.1.
--
-- public.email_outbox is the durable queue that decouples the act of
-- "something happened" (a notification row, a server-action call, a cron
-- function) from the act of "Resend accepted the email". Writers enqueue a
-- row; a worker (drainEmailOutbox in src/lib/notifications/worker.ts) picks
-- up pending rows in send_at order, calls Resend with the row's dedup_key as
-- the idempotency key, and updates status/attempts in-place.
--
-- Design notes:
--
--   - `dedup_key` is the single source of write-side idempotency. Callers
--     compute it as `<template_kind>/<recipient_id>/<sha256(payload)>` and the
--     UNIQUE constraint ensures a retried enqueue is a no-op. This also
--     becomes the Resend idempotency-key — Resend honours 24h dedup so we get
--     end-to-end exactly-once semantics for a 24h window.
--   - `status` is a closed enum implemented as a CHECK constraint (not a real
--     enum type) so we can ALTER the set in a future migration without the
--     SQL gymnastics that ALTER TYPE requires under pg_cron transactions.
--   - The partial index on `(send_at) WHERE status='pending'` keeps the hot
--     worker query (SELECT ... WHERE status='pending' AND send_at<=now()
--     ORDER BY send_at) cheap as the sent-archive grows.
--   - The partial index on `(resend_message_id) WHERE resend_message_id IS
--     NOT NULL` supports the webhook handler, which updates rows by the
--     Resend message id returned at send time.
--   - RLS is enabled with NO policies — only service-role keys can read or
--     write. End users have no business poking at outbox state directly.

set search_path = public;

create table if not exists public.email_outbox (
  id                    uuid primary key default gen_random_uuid(),
  -- Profile id of the human recipient. NULL is allowed because some fan-out
  -- emails (e.g. a contact-form alert to ops) have no profile behind them.
  recipient_profile_id  uuid null references public.profiles(id) on delete set null,
  recipient_email       text not null,
  template_kind         text not null,
  locale                text not null default 'en' check (locale in ('en','ar')),
  payload_jsonb         jsonb not null default '{}'::jsonb,
  -- Optional explicit subject. When NULL the worker derives subject from the
  -- template's *.strings.ts sibling (preview() / subject / template_kind).
  subject_override      text,
  from_email            text not null default 'Sevent <notifications@seventsa.com>',
  status                text not null default 'pending'
                          check (status in ('pending','sent','delivered','delayed',
                                            'bounced','complained','suppressed',
                                            'failed','conflict')),
  attempts              integer not null default 0,
  last_error            text,
  send_at               timestamptz not null default now(),
  sent_at               timestamptz,
  resend_message_id     text,
  -- Globally unique idempotency token. Doubles as the Resend idempotency key.
  dedup_key             text not null unique,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Hot worker query: pull pending rows whose send_at has matured, oldest first.
create index if not exists email_outbox_pending_send_at_idx
  on public.email_outbox (send_at)
  where status = 'pending';

-- Webhook lookup: Resend gives us the message id; we find the row to update.
create index if not exists email_outbox_resend_message_id_idx
  on public.email_outbox (resend_message_id)
  where resend_message_id is not null;

-- updated_at auto-maintenance — reuses the shared trigger function
-- introduced in 20260420000000_extensions_and_profiles.sql.
drop trigger if exists email_outbox_set_updated_at on public.email_outbox;
create trigger email_outbox_set_updated_at
  before update on public.email_outbox
  for each row execute function public.set_updated_at();

-- Lock down. Outbox is service-role only; no end-user policies.
alter table public.email_outbox enable row level security;
