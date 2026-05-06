-- messaging: backfill existing app_feedback rows into feedback_messages.
--
-- Each existing app_feedback row's `message` becomes the FIRST message of
-- its (now-)thread. We treat the original submitter as the sender, with
-- their role snapshotted on app_feedback.role. created_at carries over.
--
-- Idempotent: skips threads that already have a feedback_messages row
-- (e.g. on re-run, or if a future thread is created in the same migration
-- batch — which doesn't happen today but defends against a foot-gun).

set search_path = public;

insert into public.feedback_messages (thread_id, sender_id, sender_role, body, created_at)
select
  af.id,
  af.user_id,
  af.role,
  af.message,
  af.created_at
from public.app_feedback af
where not exists (
  select 1 from public.feedback_messages m where m.thread_id = af.id
);
