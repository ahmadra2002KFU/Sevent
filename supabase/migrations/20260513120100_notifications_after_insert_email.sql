-- Sevent · migration 20260513120100: notifications → email_outbox bridge.
-- Sprint "Resend everywhere" — Phase 3.1.
--
-- This trigger fires AFTER INSERT on public.notifications and enqueues a
-- corresponding row into public.email_outbox for a narrow whitelist of
-- notification.kinds. The dedup_key is `notif/<NEW.id>` so the row is unique
-- to *this* notification — replays of the same notification id are a no-op.
--
-- Whitelist rationale (read this before adding a kind):
--
--   The whitelist intentionally contains ONLY kinds for which there is no
--   competing app-code direct-send path today. That avoids double-sends in
--   the period before the app-code lifecycle actions are refactored to
--   enqueue (Phase 2.6). Specifically:
--
--   IN-CRON-OR-ACTION-WITHOUT-DIRECT-SEND (bridged via this trigger):
--     - booking.auto_cancelled_expired_hold      cron (lifecycle_cron_jobs)
--     - booking.auto_completed                   cron
--     - review.published                         cron (publish_reviews_cron)
--     - review.submitted                         server action (no sendEmail)
--     - dispute.auto_closed                      cron (close_stale_disputes)
--     - dispute.opened                           server action (no sendEmail)
--     - dispute.evidence_submitted               server action (no sendEmail)
--     - dispute.resolved                         server action (no sendEmail)
--     - dispute.closed                           server action (no sendEmail)
--     - contract.render_failed                   server action (no sendEmail)
--     - quote.proposal_requested                 server action (no sendEmail)
--     - quote.proposal_fulfilled                 server action (no sendEmail)
--     - quote.rejected                           fan-out from acceptQuote
--     - booking.awaiting_supplier                soft-hold notice
--
--   EXCLUDED — app code calls src/lib/notifications/email.ts directly today;
--   the sibling Phase 2.5 agent is refactoring them to enqueue, after which
--   they will be moved into the whitelist:
--     - quote.sent, quote.revised, quote.accepted
--     - booking.created, booking.confirmed, booking.cancelled
--     - supplier.approved, supplier.rejected
--     - supplier.doc.*, supplier.email.delivery_failed
--     - message.received, message.reply_received
--
--   App-code emails NEVER reach this trigger because the trigger only inserts
--   when NEW.kind is in the explicit whitelist below. The whitelist is the
--   single source of truth — kinds outside it stay in-app-only.
--
-- Locale resolution: read profiles.language; default 'en'.
-- Email resolution: read auth.users.email by NEW.user_id; NULL → log NOTICE
-- and skip (no row inserted; cron will alert via separate observability).

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
  -- rationale; do NOT widen casually.
  if new.kind not in (
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
    'booking.awaiting_supplier'
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
