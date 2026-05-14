-- Sevent · migration 20260514100100: update notifications → email_outbox whitelist.
-- Sprint "Resend everywhere" — Phase 3.3.
--
-- This migration is a `create or replace function` on
-- public.email_outbox_enqueue_from_notification() — the AFTER INSERT bridge
-- first defined in 20260513120100_notifications_after_insert_email.sql. The
-- function signature is unchanged, so the trigger does NOT need re-creating;
-- we still re-issue the drop/create trigger block for idempotency, exactly as
-- the original migration does.
--
-- Two changes to the `new.kind not in (...)` whitelist, nothing else:
--
--   1. ADD 'rfq.invited' — the new "new opportunity" email sent to a supplier
--      when an organizer invites them to quote on an RFQ. There is no
--      competing app-code direct-send path for this kind, so bridging it here
--      is safe (no double-send risk).
--
--   2. REMOVE 'booking.awaiting_supplier' — intentionally dropped. The
--      organizer's quote-accept flow already sends the working
--      quote.accepted / QuoteAccepted email to the supplier. Keeping
--      booking.awaiting_supplier in the whitelist would enqueue a SECOND
--      email to the same supplier for the same event, i.e. double-email them.
--      The in-app booking.awaiting_supplier notification still fires; it just
--      no longer produces an email.
--
-- Everything else — security definer, set search_path, locale/email
-- resolution, the `notif/<NEW.id>` dedup_key, the on-conflict no-op — is
-- reproduced verbatim from 20260513120100.

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
    'rfq.invited'
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
