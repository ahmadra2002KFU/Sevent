-- =============================================================================
-- update_organizer_company_tx — add address parameters
--
-- The contract First Party block renders the organizer company's postal
-- address. This extends the company-update RPC (originally defined in
-- 20260519100000_organizer_company_pr4_rpcs.sql) with four address params so
-- the company settings form can persist them.
--
-- Adding parameters changes the function signature, so we DROP the old 9-arg
-- overload first to avoid an ambiguous-overload situation in PostgREST, then
-- recreate with the extended signature. Behaviour and errcodes are otherwise
-- unchanged from PR 4.
-- =============================================================================

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
  p_address_line1 text,
  p_address_city text,
  p_address_region text,
  p_address_postal_code text
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

  update public.organizer_companies
     set name = coalesce(p_name, name),
         name_ar = p_name_ar,
         cr_number = p_cr_number,
         vat_number = p_vat_number,
         billing_email = p_billing_email,
         default_language = coalesce(p_default_language, default_language),
         logo_path = p_logo_path,
         address_line1 = p_address_line1,
         address_city = p_address_city,
         address_region = p_address_region,
         address_postal_code = p_address_postal_code
   where id = p_company_id;
end
$$;

revoke all on function public.update_organizer_company_tx(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text, text
) from public;
grant execute on function public.update_organizer_company_tx(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text, text
) to service_role;

notify pgrst, 'reload schema';
