-- Server-side anti-join for marketplace opportunities.
--
-- The TS path in src/lib/domain/marketplace.ts used to:
--   1. SELECT rfq_id FROM rfq_invites WHERE supplier_id = $1 (UNBOUNDED)
--   2. SELECT … FROM rfqs WHERE published AND status='sent' LIMIT 200
--   3. Filter in TypeScript: rfqs WHERE id NOT IN inviteSet.
-- That first query grew with the supplier's invite history. Replace it with
-- a SECURITY DEFINER function that runs the NOT EXISTS join in SQL with a
-- hard LIMIT, returning just the candidate ids. The caller then issues one
-- joined SELECT keyed on the returned ids.
--
-- Why SECURITY DEFINER: the function needs to scan rfq_invites for arbitrary
-- supplier_ids, but rfq_invites RLS only lets a supplier read their own rows.
-- Defining the function with the owner's rights lets it do the anti-join
-- without leaking other suppliers' invite contents — the function returns
-- only rfq ids, and the supplier_id is passed in (the route gate above
-- enforces that it matches the caller).
--
-- Hardened: search_path is pinned to public to avoid hijack via session-set
-- search_path; EXECUTE is granted to authenticated + service_role only.

create or replace function public.marketplace_opportunities_for_supplier(
  p_supplier_id uuid,
  p_limit integer default 200
) returns table (rfq_id uuid)
  language sql
  stable
  security definer
  set search_path = public
as $$
  select r.id
    from public.rfqs r
   where r.is_published_to_marketplace = true
     and r.status = 'sent'
     and (r.expires_at is null or r.expires_at > now())
     and not exists (
       select 1
         from public.rfq_invites i
        where i.rfq_id = r.id
          and i.supplier_id = p_supplier_id
     )
   order by r.sent_at desc nulls last
   limit greatest(p_limit, 1);
$$;

revoke all on function public.marketplace_opportunities_for_supplier(uuid, integer) from public;
grant execute on function public.marketplace_opportunities_for_supplier(uuid, integer)
  to authenticated, service_role;
