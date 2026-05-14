-- Sevent · migration 20260514140000: enqueue_message_reminders() robustness fixes.
--
-- A `create or replace function` on enqueue_message_reminders() (first defined
-- in 20260514120000). Signature unchanged, the cron schedule still points at
-- it — no re-scheduling needed. Two narrow correctness fixes from review:
--
--   1. Deterministic "latest message" pick. The sender-role subquery ordered
--      only by `fm.created_at desc`; on a timestamp tie Postgres could pick
--      either row as "latest", so a thread could be mis-classified. Add a
--      stable tie-breaker `fm.id desc`.
--
--   2. Honest `v_enqueued` count. The counter was incremented unconditionally,
--      but `insert ... on conflict (dedup_key) do nothing` can insert zero
--      rows (a reminder row already existed). Only count an actual insert via
--      `if found`. This affects the function's return value / observability
--      only — email correctness was already guarded by the dedup key and the
--      reminder_sent_at stamp.
--
-- Everything else is reproduced verbatim from 20260514120000.

set search_path = public;

create or replace function public.enqueue_message_reminders()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_enqueued integer := 0;
  v_base_url text := current_setting('app.cron_base_url', true);
  v_thread   record;
  v_email    text;
  v_locale   text;
begin
  for v_thread in
    select af.id,
           af.user_id,
           af.role,
           af.subject,
           af.last_message_at
      from public.app_feedback af
     where af.reminder_sent_at is null
       and af.read_at_user is null
       and af.closed_at is null
       and af.user_id is not null
       and af.last_message_at < now() - interval '2 hours'
       -- Only nudge when the LATEST message is from an admin — never email a
       -- user about their own still-unanswered thread. `fm.id desc` is a
       -- stable tie-breaker so a timestamp tie can't flip the classification.
       and (
         select fm.sender_role
           from public.feedback_messages fm
          where fm.thread_id = af.id
          order by fm.created_at desc, fm.id desc
          limit 1
       ) = 'admin'
     order by af.last_message_at asc
     limit 500
     for update of af
  loop
    -- Recipient address. NULL → skip (stamp it anyway so the job doesn't
    -- re-scan a dead row every day; the in-app notification already landed).
    select email into v_email from auth.users where id = v_thread.user_id;

    if v_email is not null then
      select coalesce(language, 'en') into v_locale
        from public.profiles where id = v_thread.user_id;
      if v_locale is null or v_locale not in ('en', 'ar') then
        v_locale := 'en';
      end if;

      insert into public.email_outbox (
        recipient_profile_id,
        recipient_email,
        template_kind,
        locale,
        payload_jsonb,
        dedup_key
      ) values (
        v_thread.user_id,
        v_email,
        'message.reminder',
        v_locale,
        jsonb_build_object(
          'thread_id', v_thread.id,
          'role', v_thread.role,
          'subject', v_thread.subject,
          'thread_url',
            case
              when v_base_url is null or v_base_url = '' then null
              else v_base_url || '/' || v_thread.role || '/messages/' || v_thread.id::text
            end
        ),
        'msg-reminder/' || v_thread.id::text
      )
      on conflict (dedup_key) do nothing;

      -- Count only a real insert: on conflict (dedup_key) do nothing can
      -- no-op when a reminder row already exists for this thread.
      if found then
        v_enqueued := v_enqueued + 1;
      end if;
    end if;

    -- Stamp regardless of whether an email was enqueued — "once only" means
    -- once per thread, full stop (a missing address is not retried here).
    update public.app_feedback
       set reminder_sent_at = now()
     where id = v_thread.id;
  end loop;

  return v_enqueued;
end;
$$;

comment on function public.enqueue_message_reminders() is
  'Reminder cron · daily 14:00 Asia/Riyadh. Enqueues one message.reminder '
  'email per thread that has unread admin content older than 2h. Stamps '
  'app_feedback.reminder_sent_at so each thread is reminded at most once.';

revoke all on function public.enqueue_message_reminders() from public;
grant execute on function public.enqueue_message_reminders() to service_role;
