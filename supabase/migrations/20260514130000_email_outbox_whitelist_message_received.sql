-- Sevent · migration 20260514130000: email on admin-started new message thread.
--
-- Adds `message.received` to the notifications → email_outbox bridge, but
-- CONDITIONALLY — only when the notification payload carries
-- `email_notify: true`.
--
-- Why conditional, not a flat whitelist entry:
--   `message.received` notifications are created in three places, all sharing
--   the same kind:
--     1. admin → single user dedicated compose   (sender_role 'admin')
--     2. admin → bulk role/all broadcast          (sender_role 'admin')
--     3. user → admin new "ask admin" thread      (sender_role organizer/...)
--   The product decision is to email ONLY case 1. `sender_role = 'admin'`
--   alone can't separate case 1 from case 2, so the single-user compose path
--   (src/app/(admin)/admin/messages/compose/actions.ts) sets an explicit
--   `email_notify: true` flag in the notification payload. The bridge keys on
--   that flag. Bulk broadcasts and user/admin replies leave it unset and stay
--   in-app only (replies are still covered by the daily reminder cron).
--
-- This is a `create or replace function` on the bridge first defined in
-- 20260513120100 and last replaced in 20260514100100. The signature is
-- unchanged, so the trigger does not need re-creating; we still re-issue the
-- drop/create trigger block for idempotency, exactly as the prior migrations.
--
-- The only change vs 20260514100100 is the whitelist guard: the flat
-- `new.kind not in (...)` becomes `not ( <flat list> or <message.received +
-- email_notify> )`. Everything else is reproduced verbatim.

set search_path = public;

create or replace function public.email_outbox_enqueue_from_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_email   text;
  v_locale  text;
  v_dedup   text;
begin
  -- Whitelist of kinds that should produce an email. See header comment for
  -- rationale; do NOT widen casually. `message.received` is a CONDITIONAL
  -- member — it only emails when the payload opts in via email_notify:true.
  if not (
    new.kind in (
      'booking.auto_cancelled_expired_hold',
      'booking.auto_completed',
      'review.published',
      'review.submitted',
      'dispute.auto_closed',
      'dispute.opened',
      'dispute.evidence_submitted',
      'dispute.resolved',
      'dispute.closed',
      'contract.render_failed',
      'quote.proposal_requested',
      'quote.proposal_fulfilled',
      'quote.rejected',
      'rfq.invited'
    )
    or (
      new.kind = 'message.received'
      and coalesce(new.payload_jsonb ->> 'email_notify', '') = 'true'
    )
  ) then
    return new;
  end if;

  -- Recipient address. NULL → skip (don't raise; the in-app notification
  -- already landed and the worker would only fail).
  select email into v_email from auth.users where id = new.user_id;
  if v_email is null then
    raise notice 'email_outbox_enqueue_from_notification: no email for user_id=% kind=%',
      new.user_id, new.kind;
    return new;
  end if;

  -- Locale. Default 'en' when the profile is missing or unset.
  select coalesce(language, 'en') into v_locale
    from public.profiles where id = new.user_id;
  if v_locale is null then v_locale := 'en'; end if;
  if v_locale not in ('en','ar') then v_locale := 'en'; end if;

  v_dedup := 'notif/' || new.id::text;

  insert into public.email_outbox (
    recipient_profile_id,
    recipient_email,
    template_kind,
    locale,
    payload_jsonb,
    dedup_key
  ) values (
    new.user_id,
    v_email,
    new.kind,
    v_locale,
    coalesce(new.payload_jsonb, '{}'::jsonb),
    v_dedup
  )
  on conflict (dedup_key) do nothing;

  return new;
end;
$$;

drop trigger if exists notifications_email_outbox_enqueue
  on public.notifications;
create trigger notifications_email_outbox_enqueue
  after insert on public.notifications
  for each row execute function public.email_outbox_enqueue_from_notification();
