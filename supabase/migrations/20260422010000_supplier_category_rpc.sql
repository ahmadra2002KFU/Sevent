-- Migration: atomic replace_supplier_categories RPC.
-- Why: the application previously did DELETE + INSERT in two statements,
-- which left suppliers with zero categories if the insert failed — the
-- access-control resolver then classifies them as `in_onboarding` instead
-- of `pending_review`.

set search_path = public;

create or replace function public.replace_supplier_categories(
  p_supplier_id uuid,
  p_subcategory_ids uuid[]
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.supplier_categories
   where supplier_id = p_supplier_id;
  if p_subcategory_ids is not null
     and array_length(p_subcategory_ids, 1) > 0 then
    insert into public.supplier_categories (supplier_id, subcategory_id)
    select p_supplier_id, unnest(p_subcategory_ids);
  end if;
end;
$$;

grant execute on function public.replace_supplier_categories(uuid, uuid[])
  to service_role;
