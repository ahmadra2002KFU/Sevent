-- Sevent · boss CSV category migration guardrails.
--
-- Run locally after `supabase db reset`:
--   psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/tests/category_migration.test.sql

\set ON_ERROR_STOP on

begin;

do $$
declare
  v_parent_count int;
  v_child_count int;
  v_legacy_active int;
  v_organizer uuid := 'bb000000-0000-0000-0000-000000000001'::uuid;
  v_supplier_profile uuid := 'bb000000-0000-0000-0000-000000000002'::uuid;
  v_supplier uuid;
  v_event uuid;
  v_parent uuid;
  v_wrong_parent uuid;
  v_child uuid;
  v_other_child uuid;
  v_count int;
  v_failed boolean;
begin
  select count(*) into v_parent_count
    from public.categories
   where taxonomy_version = 'boss_csv_2026_05'
     and is_active
     and parent_id is null;
  if v_parent_count <> 12 then
    raise exception 'expected 12 active boss parents, got %', v_parent_count;
  end if;

  select count(*) into v_child_count
    from public.categories
   where taxonomy_version = 'boss_csv_2026_05'
     and is_active
     and parent_id is not null;
  if v_child_count <> 75 then
    raise exception 'expected 75 active boss children, got %', v_child_count;
  end if;

  select count(*) into v_legacy_active
    from public.categories
   where slug in ('venue-ballroom', 'catering-buffet', 'staff-hostess')
     and is_active;
  if v_legacy_active <> 0 then
    raise exception 'legacy seed slugs are still active';
  end if;

  insert into auth.users (id, email, encrypted_password, instance_id, email_confirmed_at, raw_user_meta_data)
  values
    (v_organizer, 'category-test-organizer@test.local', '', '00000000-0000-0000-0000-000000000000', now(), '{"role":"organizer"}'::jsonb),
    (v_supplier_profile, 'category-test-supplier@test.local', '', '00000000-0000-0000-0000-000000000000', now(), '{"role":"supplier"}'::jsonb);
  update public.profiles set role = 'organizer' where id = v_organizer;
  update public.profiles set role = 'supplier' where id = v_supplier_profile;

  insert into public.suppliers (
    profile_id, business_name, slug, legal_type, base_city,
    service_area_cities, languages, verification_status, is_published
  ) values (
    v_supplier_profile, 'Category Test Supplier', 'category-test-supplier',
    'company', 'riyadh', array['riyadh'], array['en'], 'approved', true
  ) returning id into v_supplier;

  select id into v_parent from public.categories where slug = 'hospitality';
  select id into v_wrong_parent from public.categories where slug = 'event_management';
  select id, parent_id into v_child, v_parent
    from public.categories
   where slug = 'food_and_beverages';
  select id into v_other_child
    from public.categories
   where slug = 'hospitality_consumables';

  insert into public.events (organizer_id, event_type, city, starts_at, ends_at)
  values (v_organizer, 'business_events', 'riyadh', now() + interval '1 day', now() + interval '1 day 2 hours')
  returning id into v_event;

  perform public.replace_supplier_categories(v_supplier, array[v_child, v_child]);
  select count(*) into v_count
    from public.supplier_categories
   where supplier_id = v_supplier and subcategory_id = v_child;
  if v_count <> 1 then
    raise exception 'replace_supplier_categories did not dedupe duplicate input';
  end if;

  perform public.replace_supplier_categories(v_supplier, array[v_child, v_other_child]);
  select count(*) into v_count
    from public.supplier_categories
   where supplier_id = v_supplier;
  if v_count <> 2 then
    raise exception 'replace_supplier_categories failed valid multi-category input';
  end if;

  v_failed := false;
  begin
    insert into public.supplier_categories (supplier_id, subcategory_id)
    values (v_supplier, v_parent);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'supplier_categories accepted a parent category';
  end if;

  v_failed := false;
  begin
    insert into public.packages (
      supplier_id, subcategory_id, name, base_price_halalas, unit
    ) values (
      v_supplier, v_parent, 'Invalid parent package', 1000, 'event'
    );
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'packages accepted a parent category';
  end if;

  v_failed := false;
  begin
    insert into public.rfqs (
      event_id, category_id, subcategory_id, status, requirements_jsonb, sent_at
    ) values (
      v_event, v_wrong_parent, v_child, 'sent', '{"kind":"generic","notes":"x"}'::jsonb, now()
    );
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'rfqs accepted mismatched parent/child categories';
  end if;
end $$;

rollback;
