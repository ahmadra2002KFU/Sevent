-- Sevent · storage RLS test (Sprint 2 · Lane 1).
--
-- Proves that supplier B cannot read supplier A's `supplier_docs` row and
-- cannot mint a signed URL (via storage.objects SELECT) for supplier A's doc.
--
-- Assumes `pnpm seed` has been run: supplier-1@sevent.dev (A) and
-- supplier-2@sevent.dev (B) exist, and A has at least one supplier_docs row
-- with a storage object at `{supplier_id}/docs/*`.
--
-- How to run (local, Supabase CLI):
--   psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/tests/storage-rls.test.sql
--
-- A successful run prints "RLS storage test: OK". Any assertion failure raises
-- an exception and exits non-zero.

\set ON_ERROR_STOP on

begin;

do $$
declare
  v_supplier_a uuid;
  v_supplier_b uuid;
  v_profile_a uuid;
  v_profile_b uuid;
  v_doc_a_id uuid;
  v_doc_a_path text;
  v_doc_rows int;
  v_storage_rows int;
begin
  select s.id, s.profile_id into v_supplier_a, v_profile_a
    from public.suppliers s
    join public.profiles p on p.id = s.profile_id
    join auth.users u on u.id = p.id
   where u.email = 'supplier-1@sevent.dev' limit 1;
  if v_supplier_a is null then
    raise exception 'seed fixture supplier-1@sevent.dev not found - run pnpm seed first';
  end if;

  select s.id, s.profile_id into v_supplier_b, v_profile_b
    from public.suppliers s
    join public.profiles p on p.id = s.profile_id
    join auth.users u on u.id = p.id
   where u.email = 'supplier-2@sevent.dev' limit 1;
  if v_supplier_b is null then
    raise exception 'seed fixture supplier-2@sevent.dev not found - run pnpm seed first';
  end if;

  select id, file_path into v_doc_a_id, v_doc_a_path
    from public.supplier_docs
   where supplier_id = v_supplier_a
   order by created_at asc limit 1;
  if v_doc_a_id is null then
    raise exception 'supplier-1 has no supplier_docs rows - run pnpm seed first';
  end if;

  -- CASE 1 - supplier B reads supplier A's supplier_docs row. Expect 0.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_profile_b::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_profile_b::text, 'role', 'authenticated')::text, true);

  select count(*) into v_doc_rows from public.supplier_docs where id = v_doc_a_id;
  if v_doc_rows <> 0 then
    raise exception 'RLS LEAK: supplier B read % supplier_docs row(s) owned by supplier A', v_doc_rows;
  end if;

  -- CASE 2 - supplier B reads storage.objects row for supplier A's doc.
  select count(*) into v_storage_rows from storage.objects
    where bucket_id = 'supplier-docs' and name = v_doc_a_path;
  if v_storage_rows <> 0 then
    raise exception 'RLS LEAK: supplier B read % storage.objects row(s) for supplier A doc path %',
      v_storage_rows, v_doc_a_path;
  end if;

  -- CASE 3 - positive control: supplier A reads own supplier_docs row.
  perform set_config('request.jwt.claim.sub', v_profile_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_profile_a::text, 'role', 'authenticated')::text, true);

  select count(*) into v_doc_rows from public.supplier_docs where id = v_doc_a_id;
  if v_doc_rows <> 1 then
    raise exception 'positive control failed: supplier A sees % rows for own doc (expected 1)', v_doc_rows;
  end if;

  -- CASE 4 - positive control: supplier A reads own storage object.
  select count(*) into v_storage_rows from storage.objects
    where bucket_id = 'supplier-docs' and name = v_doc_a_path;
  if v_storage_rows <> 1 then
    raise exception 'positive control failed: supplier A sees % storage rows for own doc (expected 1)',
      v_storage_rows;
  end if;

  raise notice 'RLS storage test: OK';
end
$$;

rollback;
