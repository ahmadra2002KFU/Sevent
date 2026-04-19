-- Relax guard_supplier_verification so service_role writes (used by admin
-- server actions that must bypass the @supabase/ssr JWT-forwarding gap) are
-- accepted without also requiring auth.uid() to resolve to an admin profile.
--
-- The original guard rejected any UPDATE that changed verification_status
-- unless public.is_admin() was true. is_admin() reads auth.uid() -> profiles,
-- which is NULL under the service_role session, so the trigger incorrectly
-- blocked legitimate admin flows executed through service-role.
--
-- Security argument: service_role is strictly more privileged than any user
-- JWT. If the application chose to route a write through it, the caller has
-- already been authenticated + authorized in code. End-user sessions still
-- flow through current_user = 'authenticated' and are still guarded.

create or replace function public.guard_supplier_verification()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and new.verification_status is distinct from old.verification_status
     and current_user not in ('service_role', 'supabase_admin', 'postgres')
     and not public.is_admin() then
    raise exception 'only admins can change verification_status';
  end if;
  return new;
end;
$$;
