-- Sevent · migration 20260514150000: harden the message.received email gate.
--
-- A `create or replace function` on email_outbox_enqueue_from_notification()
-- (last replaced in 20260514130000). Signature unchanged — the trigger is
-- still re-issued for idempotency, exactly as the prior migrations.
--
-- 20260514130000 whitelisted `message.received` purely on a payload flag
-- (`payload_jsonb->>'email_notify' = 'true'`). That trusts whatever wrote the
-- notification: a future code path that copied the flag onto a bulk-broadcast
-- or a user-initiated thread's notification would silently leak an email.
--
-- This migration keeps the flag as the app-layer intent signal but adds an
-- independent database-side check: the notification's thread must actually be
-- an admin-initiated, non-bulk, dedicated thread addressed to this exact
-- recipient. Both conditions must hold — defence in depth. The bridge fires
-- AFTER INSERT on notifications, and composeToUser inserts the app_feedback
-- row before the notification, so the row is always visible here.
--
-- The thread_id is matched as text (`af.id::text = payload ->> 'thread_id'`)
-- so a malformed/absent payload value simply fails to match instead of
-- raising a cast error that would roll back the originating message send.
--
-- Only the `message.received` arm of the whitelist guard changes; everything
-- else is reproduced verbatim from 20260514130000.

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
  -- member — it emails only when the payload opts in AND the referenced
  -- thread is verifiably an admin-initiated, non-bulk, dedicated thread.
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
      -- Defence in depth: don't trust the payload flag alone. The thread must
      -- be admin-initiated (initiator = 'admin'), single-user (campaign_id is
      -- null — bulk broadcasts carry one), and owned by this recipient
      -- (user_id = new.user_id — excludes user→admin "ask admin" threads,
      -- whose notifications go to admins, not the thread owner).
      and exists (
        select 1
          from public.app_feedback af
         where af.id::text = new.payload_jsonb ->> 'thread_id'
           and af.initiator = 'admin'
           and af.campaign_id is null
           and af.user_id = new.user_id
      )
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
