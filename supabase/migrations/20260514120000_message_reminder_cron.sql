-- Sevent · migration 20260514120000: unread-message reminder email + daily cron.
--
-- When an admin sends a message to a user, the user gets an in-app bell
-- notification immediately but NO email (message.received is intentionally
-- absent from the email_outbox bridge whitelist — see 20260513120100).
--
-- This migration adds a once-per-thread email nudge: a daily 14:00 Asia/Riyadh
-- job scans for threads that have unread admin content sitting for 2h+ and
-- enqueues a `message.reminder` email into public.email_outbox. The TS drain
-- worker (src/lib/notifications/worker.ts) renders it and calls Resend.
--
-- Design:
--   * `app_feedback.reminder_sent_at` — stamped when a reminder is enqueued.
--     The job only ever picks rows where it IS NULL, so each thread is
--     reminded AT MOST ONCE, ever (no re-arm on later messages — "once only").
--   * "unread admin content" = `read_at_user IS NULL` AND the most recent
--     feedback_messages row is `sender_role = 'admin'`. The second condition
--     is essential: a user-initiated thread with no admin reply also has
--     `read_at_user IS NULL` (the bump trigger leaves it null), and we must
--     NOT email the user about their own unanswered message.
--   * 2h floor (`last_message_at < now() - interval '2 hours'`) so a message
--     sent shortly before the 14:00 run waits for the next day's run instead
--     of being reminded minutes after it was sent.
--   * Idempotency: `dedup_key = 'msg-reminder/<thread_id>'` (unique per thread)
--     plus the `reminder_sent_at IS NULL` guard — double-safe against re-runs.
--   * LIMIT 500 per run as a blast guard; a larger backlog drains over the
--     following days (each run marks its batch, the next run takes the rest).
--
-- The job is a pure SQL function (the lifecycle-cron pattern in
-- 20260512100000): pg_cron INSERTs the pending rows, the TS worker drains
-- them. The thread deep-link URL is built from the `app.cron_base_url` GUC —
-- the same per-environment setting the drain cron already relies on; when it
-- is unset the URL is NULL and the email template falls back to the brand URL.

set search_path = public;

-- =============================================================================
-- app_feedback.reminder_sent_at
-- =============================================================================

alter table public.app_feedback
  add column if not exists reminder_sent_at timestamptz;

comment on column public.app_feedback.reminder_sent_at is
  'Stamped by enqueue_message_reminders() when an unread-message reminder '
  'email is enqueued. Non-null = already reminded; the job never re-reminds.';

-- Partial index for the daily job''s hot predicate.
create index if not exists app_feedback_reminder_pending_idx
  on public.app_feedback (last_message_at)
  where reminder_sent_at is null
    and read_at_user is null
    and closed_at is null;

-- =============================================================================
-- enqueue_message_reminders()
-- =============================================================================

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
       -- user about their own still-unanswered thread.
       and (
         select fm.sender_role
           from public.feedback_messages fm
          where fm.thread_id = af.id
          order by fm.created_at desc
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

      v_enqueued := v_enqueued + 1;
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

-- =============================================================================
-- Schedule the daily job
-- =============================================================================
--
-- cron.schedule() is idempotent on jobname. The DB runs in UTC (verified), so
-- 14:00 Asia/Riyadh (UTC+3, no DST) is 11:00 UTC.

select cron.schedule(
  'enqueue-message-reminders',
  '0 11 * * *',
  $$select public.enqueue_message_reminders()$$
);
