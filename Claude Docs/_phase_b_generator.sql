-- Generator: emits DROP + CREATE SQL for every policy that contains a bare
-- auth.uid() or the recursive profiles-admin EXISTS pattern. Output is
-- meant to be captured and pasted into a migration file.
--
-- Replacements:
--   1. auth.uid()  →  (SELECT auth.uid())
--   2. EXISTS(...profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::sevent_role)
--        →  (SELECT public.is_admin())
--      (handles the recursive profiles-on-profiles case, P1-6.)
--
-- The replacement is applied in this order: is_admin substitution FIRST
-- (so the inner auth.uid() inside the EXISTS pattern collapses to is_admin),
-- THEN the bare auth.uid() wrap for whatever remains.

with policies_to_rewrite as (
  select
    schemaname,
    tablename,
    policyname,
    cmd,
    -- roles in pg_policies is name[] — for our policies it's either
    -- {public} or {authenticated}. PUBLIC is the default if no TO clause.
    case
      when array_length(roles, 1) is null then 'public'
      else array_to_string(roles, ', ')
    end as role_list,
    qual,
    with_check
  from pg_policies
  where schemaname in ('public', 'storage')
    and (
      qual ~ 'auth\.uid\(\)' or with_check ~ 'auth\.uid\(\)'
      or qual ~ '(^|[^.])is_admin\(\)' or with_check ~ '(^|[^.])is_admin\(\)'
    )
),
rewritten as (
  select
    schemaname,
    tablename,
    policyname,
    cmd,
    role_list,
    -- Step 1: replace recursive profiles-admin EXISTS with (select public.is_admin())
    -- Step 2: wrap remaining auth.uid() with (select auth.uid())
    -- Step 1: replace recursive profiles-admin EXISTS (P1-6).
    -- Step 2: wrap bare is_admin() (function call without preceding "SELECT ").
    -- Step 3: wrap bare auth.uid().
    case when qual is not null then
      regexp_replace(
        regexp_replace(
          regexp_replace(
            qual,
            'EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+profiles\s+p\s+WHERE\s+\(\(p\.id\s*=\s*auth\.uid\(\)\)\s+AND\s+\(p\.role\s*=\s*''admin''::sevent_role\)\)\s*\)',
            '(SELECT public.is_admin())',
            'g'
          ),
          '(^|[^.[:alnum:]_])(is_admin\(\))',
          E'\\1(SELECT public.\\2)',
          'g'
        ),
        'auth\.uid\(\)',
        '(SELECT auth.uid())',
        'g'
      )
    end as new_qual,
    case when with_check is not null then
      regexp_replace(
        regexp_replace(
          regexp_replace(
            with_check,
            'EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+profiles\s+p\s+WHERE\s+\(\(p\.id\s*=\s*auth\.uid\(\)\)\s+AND\s+\(p\.role\s*=\s*''admin''::sevent_role\)\)\s*\)',
            '(SELECT public.is_admin())',
            'g'
          ),
          '(^|[^.[:alnum:]_])(is_admin\(\))',
          E'\\1(SELECT public.\\2)',
          'g'
        ),
        'auth\.uid\(\)',
        '(SELECT auth.uid())',
        'g'
      )
    end as new_with_check
  from policies_to_rewrite
)
select
  format(
    e'drop policy if exists %I on %I.%I;\ncreate policy %I on %I.%I\n  for %s to %s%s%s;\n',
    policyname, schemaname, tablename,
    policyname, schemaname, tablename,
    cmd, role_list,
    case when new_qual is not null then E'\n  using (' || new_qual || ')' else '' end,
    case when new_with_check is not null then E'\n  with check (' || new_with_check || ')' else '' end
  ) as ddl
from rewritten
order by schemaname, tablename, policyname;
