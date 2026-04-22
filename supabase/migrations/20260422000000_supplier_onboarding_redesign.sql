-- Audit trail for the consent gate on supplier sign-up.
alter table public.profiles
  add column if not exists terms_accepted_at timestamptz;

-- Stamp for the first-run celebration screen after supplier approval.
-- Null = not yet seen. Set to now() once the supplier lands on
-- /supplier/dashboard after verification_status flips to approved.
alter table public.suppliers
  add column if not exists first_seen_approved_at timestamptz;
