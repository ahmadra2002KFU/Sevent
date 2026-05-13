-- Per-email rate limiting for the "resend confirmation email" action on the
-- sign-in page. Allows up to 2 resends per email within a rolling 1-hour
-- window; after that the user must wait until the window opens again.
--
-- All access is gated to service_role — clients call the action via the
-- /sign-in form, which validates and writes server-side. No user-facing RLS
-- policy is added.

create table public.auth_resend_attempts (
  email text primary key,
  attempt_count int not null default 0 check (attempt_count >= 0),
  window_started_at timestamptz not null default now()
);

create index auth_resend_attempts_window_idx
  on public.auth_resend_attempts (window_started_at);

alter table public.auth_resend_attempts enable row level security;
-- intentionally no policies: service_role bypasses RLS; no other role may read/write.
