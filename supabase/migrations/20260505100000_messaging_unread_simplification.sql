-- messaging: simplify unread state.
--
-- The original "unread" predicate compared read_at to last_message_at:
--   read_at IS NULL OR read_at < last_message_at
-- but PostgREST's `or()` filter only takes literal values, not column refs,
-- so the filter on the list pages was broken. Two fixes here:
--
-- 1) Replace the bump trigger so on every new message INSERT we ALSO clear
--    the OPPOSITE party's read_at column. Sender side keeps its read_at —
--    sending implies you've seen everything up to and including your own
--    message.
--
--      sender_role = 'admin'  → set read_at_user  = NULL
--      sender_role != 'admin' → set read_at_admin = NULL
--
--    Then "unread" reduces to a plain `read_at_<side> IS NULL` filter.
--
-- 2) Backfill: existing app_feedback rows have read_at_user / read_at_admin
--    NULL already (introduced in 20260505050000), so no row-level cleanup
--    is needed. The bump trigger only ever runs on FUTURE message inserts.
--
-- The mark_feedback_thread_read* RPCs (in 20260505090000) still set
-- read_at_<side> = now() to clear the unread state.

set search_path = public;

create or replace function public.bump_feedback_thread_last_message()
returns trigger
language plpgsql
as $$
begin
  if NEW.sender_role = 'admin' then
    update public.app_feedback
    set
      last_message_at = NEW.created_at,
      read_at_user = null,
      read_at_admin = case when read_at_admin is null then null else NEW.created_at end
    where id = NEW.thread_id;
  else
    update public.app_feedback
    set
      last_message_at = NEW.created_at,
      read_at_admin = null,
      read_at_user = case when read_at_user is null then null else NEW.created_at end
    where id = NEW.thread_id;
  end if;
  return NEW;
end;
$$;

-- Trigger itself was created in 20260505090000 and references this function
-- by name, so the CREATE OR REPLACE above is sufficient — no trigger DROP.
