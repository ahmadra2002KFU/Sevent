-- Manual fixture: seed one confirmed-completed booking between the existing
-- organizer (test2@test.com) and supplier (test@test.com). Used by the
-- Chrome MCP run-through; idempotent on a fresh DB but NOT on rerun.

do $$
declare
  v_organizer uuid;
  v_supplier uuid;
  v_supplier_profile uuid;
  v_event_id uuid;
  v_rfq_id uuid;
  v_quote_id uuid;
  v_revision_id uuid;
  v_booking_id uuid;
  v_category_id uuid;
  v_subcategory_id uuid;
begin
  -- Resolve identities.
  select p.id into v_organizer
    from public.profiles p
    join auth.users u on u.id = p.id
   where u.email = 'test2@test.com';

  select s.id, s.profile_id into v_supplier, v_supplier_profile
    from public.suppliers s
    join auth.users u on u.id = s.profile_id
   where u.email = 'test@test.com';

  -- Pick any 2-level category.
  select id into v_subcategory_id
    from public.categories
   where parent_id is not null
   order by sort_order, slug
   limit 1;
  select parent_id into v_category_id
    from public.categories where id = v_subcategory_id;

  -- Event ended 2 days ago (so the 7-day dispute window is open).
  insert into public.events (organizer_id, event_type, city, starts_at, ends_at)
  values (
    v_organizer, 'business_events', 'riyadh',
    now() - interval '2 days' - interval '4 hours', now() - interval '2 days'
  )
  returning id into v_event_id;

  insert into public.rfqs (event_id, category_id, subcategory_id, status, sent_at)
  values (v_event_id, v_category_id, v_subcategory_id, 'booked', now() - interval '6 days')
  returning id into v_rfq_id;

  insert into public.quotes (rfq_id, supplier_id, status, sent_at, accepted_at)
  values (v_rfq_id, v_supplier, 'accepted', now() - interval '5 days', now() - interval '4 days')
  returning id into v_quote_id;

  insert into public.quote_revisions (quote_id, version, author_id, snapshot_jsonb, content_hash)
  values (
    v_quote_id, 1, v_supplier_profile,
    jsonb_build_object(
      'engine_version', '1.0.0',
      'currency', 'SAR',
      'line_items', jsonb_build_array(
        jsonb_build_object(
          'label', 'Catering · Buffet',
          'qty', 80,
          'unit', 'guest',
          'unit_price_halalas', 5000,
          'total_halalas', 400000
        )
      ),
      'subtotal_halalas', 400000,
      'travel_fee_halalas', 0,
      'setup_fee_halalas', 0,
      'teardown_fee_halalas', 0,
      'vat_rate_pct', 15,
      'vat_amount_halalas', 60000,
      'total_halalas', 460000,
      'deposit_pct', 30,
      'payment_schedule', '30% deposit, balance 7 days before event',
      'cancellation_terms', 'Free cancel until 14 days before event',
      'inclusions', jsonb_build_array('Tables, chairs, linens'),
      'exclusions', jsonb_build_array('Alcoholic beverages'),
      'notes', ''
    ),
    'manual-' || replace(v_quote_id::text, '-', '')
  )
  returning id into v_revision_id;

  update public.quotes set current_revision_id = v_revision_id where id = v_quote_id;

  -- Confirmed + completed booking.
  insert into public.bookings (
    rfq_id, quote_id, accepted_quote_revision_id, organizer_id, supplier_id,
    confirmation_status, service_status,
    awaiting_since, confirm_deadline, confirmed_at, completed_at
  ) values (
    v_rfq_id, v_quote_id, v_revision_id, v_organizer, v_supplier,
    'confirmed', 'completed',
    now() - interval '5 days', now() - interval '4 days',
    now() - interval '4 days', now() - interval '2 days'
  )
  returning id into v_booking_id;

  raise notice 'Seeded completed booking % (organizer=%, supplier=%, event=%)',
    v_booking_id, v_organizer, v_supplier, v_event_id;
end
$$;
