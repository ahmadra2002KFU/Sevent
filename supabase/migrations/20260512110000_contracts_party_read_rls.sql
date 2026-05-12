-- Sevent · migration 20260512110000: contracts bucket — booking-party SELECT RLS.
-- Sprint "Pilot Closure" Slice 2.
--
-- The original 20260504000000_storage_buckets.sql explicitly deferred a
-- booking-party read policy on the `contracts` bucket. Today only `admin
-- read` and `admin all` exist (recreated in the perf sweep at
-- 20260505010000_p1_rls_initplan_sweep.sql:502-511). We now add a SELECT
-- policy that lets either booking party download their own contract.
--
-- Path layout (set by src/lib/contracts/uploadAndPersist.ts):
--
--   contracts/{bookingId}/{accepted_quote_revision_id}.pdf
--
-- We resolve the booking by matching the first path segment to bookings.id
-- and check that the caller is either the organizer OR the owning supplier's
-- profile.
--
-- Service-role writes continue to bypass RLS — there is no separate INSERT
-- policy for authenticated; that's intentional (only the server renders
-- contracts; clients can never upload).

set search_path = public;

drop policy if exists "contracts: booking-party read" on storage.objects;
create policy "contracts: booking-party read" on storage.objects
  for select to public
  using (
    bucket_id = 'contracts'
    and exists (
      select 1
        from public.bookings b
        left join public.suppliers s on s.id = b.supplier_id
       where b.id::text = split_part(name, '/', 1)
         and (
              b.organizer_id = (select auth.uid())
           or s.profile_id   = (select auth.uid())
         )
    )
  );

-- NOTE: comment on policy is omitted because the migration role doesn't own
-- storage.objects (only supabase_storage_admin does) and the COMMENT statement
-- would fail with SQLSTATE 42501. CREATE POLICY itself is permitted via the
-- standard CREATE POLICY grant — only the metadata commands require ownership.
-- The policy's purpose is documented in this migration's header comment instead.
