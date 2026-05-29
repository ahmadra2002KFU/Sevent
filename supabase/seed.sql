-- Sevent local seed hook.
--
-- Supabase runs this file after all migrations during `supabase db reset`.
-- The canonical supplier taxonomy is now loaded and legacy rows are retired by
-- migration 20260527120000_boss_csv_taxonomy_migration.sql. Keep this file
-- taxonomy-free so reset does not resurrect legacy `venue-*` / `catering-*`
-- categories after the migration finishes.

begin;
commit;
