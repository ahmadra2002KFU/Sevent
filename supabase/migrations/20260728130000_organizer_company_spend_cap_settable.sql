-- =============================================================================
-- 20260728130000 — Make the member spend cap settable.
--
-- Fixes review finding F5.
--
-- `organizer_companies.quote_acceptance_threshold_halalas` was added in
-- 20260519120000 and is enforced by `accept_quote_tx_v2` (P0060 —
-- quote_above_member_threshold). The organizer action already maps P0060 to a
-- user-facing message. But `update_organizer_company_tx` had no parameter for
-- the column and nothing in the application ever wrote it, so the value stayed
-- NULL (= unlimited) forever. A real financial control, plumbed end to end
-- except for the step that turns it on.
--
-- This migration replaces the RPC with a 10-argument version:
--
--   p_quote_acceptance_threshold_halalas bigint   the new cap; NULL = unlimited
--   p_update_threshold                   boolean  whether to touch the column
--
-- The explicit boolean is required because NULL is a MEANINGFUL value for the
-- cap (unlimited), so it cannot double as "leave unchanged". When the flag is
-- false the column is preserved verbatim, which keeps admin-role saves of the
-- rest of the company profile from silently clearing an owner's cap.
--
-- AUTHORISATION
--   Editing the company profile stays owner-OR-admin, as before. Changing the
--   spend cap is OWNER-ONLY (new errcode P0062): it is the control that bounds
--   what everyone else in the company may commit the business to, so it should
--   not be adjustable by the same role it constrains one level down.
--
-- The old 9-argument signature is dropped rather than left in place — keeping
-- both would create an ambiguous overload for PostgREST when the optional
-- args are omitted.
--
-- Errcode reservations (continuing the P0050 block):
--   P0062  not_company_owner  — update_organizer_company_tx threshold branch
-- =============================================================================

set search_path = public;

-- ---------------------------------------------------------------------------
-- 1. Validity guard on the column itself.
--
--    A negative cap would silently reject every quote with a confusing
--    P0060; zero is legitimate (a company that wants every acceptance to go
--    through an admin). NOT VALID first, then VALIDATE, so the migration
--    doesn't take a long ACCESS EXCLUSIVE lock on a populated table.
-- ---------------------------------------------------------------------------

alter table public.organizer_companies
  drop constraint if exists organizer_companies_threshold_non_negative;

alter table public.organizer_companies
  add constraint organizer_companies_threshold_non_negative
  check (
    quote_acceptance_threshold_halalas is null
    or quote_acceptance_threshold_halalas >= 0
  ) not valid;

alter table public.organizer_companies
  validate constraint organizer_companies_threshold_non_negative;

-- ---------------------------------------------------------------------------
-- 2. update_organizer_company_tx — 10-arg version with the cap.
-- ---------------------------------------------------------------------------

drop function if exists public.update_organizer_company_tx(
  uuid, uuid, text, text, text, text, text, text, text
);

create or replace function public.update_organizer_company_tx(
  p_company_id uuid,
  p_actor_profile_id uuid,
  p_name text,
  p_name_ar text,
  p_cr_number text,
  p_vat_number text,
  p_billing_email text,
  p_default_language text,
  p_logo_path text,
  p_quote_acceptance_threshold_halalas bigint default null,
  p_update_threshold boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role public.org_member_role;
begin
  set local lock_timeout = '5s';
  set local statement_timeout = '15s';

  select role into v_actor_role
    from public.organizer_memberships
   where company_id = p_company_id
     and profile_id = p_actor_profile_id
     and removed_at is null;
  if v_actor_role is null or v_actor_role not in ('owner', 'admin') then
    raise exception 'not_company_admin:%', p_actor_profile_id using errcode = 'P0051';
  end if;

  -- The spend cap bounds what members may commit the company to, so only the
  -- owner may move it. Admins editing the rest of the profile pass
  -- p_update_threshold = false and never reach this branch.
  if p_update_threshold and v_actor_role <> 'owner' then
    raise exception 'not_company_owner:%', p_actor_profile_id using errcode = 'P0062';
  end if;

  if p_quote_acceptance_threshold_halalas is not null
     and p_quote_acceptance_threshold_halalas < 0 then
    raise exception 'threshold_negative' using errcode = 'P0062';
  end if;

  update public.organizer_companies
     set name = coalesce(p_name, name),
         name_ar = p_name_ar,
         cr_number = p_cr_number,
         vat_number = p_vat_number,
         billing_email = p_billing_email,
         default_language = coalesce(p_default_language, default_language),
         logo_path = p_logo_path,
         -- NULL is a meaningful value here (unlimited), hence the explicit
         -- flag rather than a coalesce.
         quote_acceptance_threshold_halalas = case
           when p_update_threshold then p_quote_acceptance_threshold_halalas
           else quote_acceptance_threshold_halalas
         end
   where id = p_company_id;
end
$$;

revoke all on function public.update_organizer_company_tx(
  uuid, uuid, text, text, text, text, text, text, text, bigint, boolean
) from public;
grant execute on function public.update_organizer_company_tx(
  uuid, uuid, text, text, text, text, text, text, text, bigint, boolean
) to service_role;
