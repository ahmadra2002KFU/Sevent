/**
 * Resend webhook receiver.
 *
 *   POST /api/webhooks/resend
 *
 * Verifies the Svix signature on every request (per the Resend skill —
 * .agents/skills/resend/references/webhooks.md). Without verification anyone
 * who knows the URL could write to email_outbox; with it, only Resend can.
 *
 * Verification model:
 *   - Read the RAW body via `request.text()`. Calling `request.json()` first
 *     would consume + reformat the body and break the signature.
 *   - The Resend SDK (v6.11) wraps Svix; its `verify()` signature takes
 *     `{ payload, headers: { id, timestamp, signature }, webhookSecret }` —
 *     we pull the three svix-* headers off the request and re-shape them
 *     into that contract. Throws on mismatch → 401.
 *   - If RESEND_WEBHOOK_SECRET is unset we 500. Skipping verification is
 *     never acceptable, not even in dev: missing secret = misconfigured.
 *
 * Idempotency / retry behaviour:
 *   - Svix retries 1d8h on non-2xx, so this route returns 200 even when the
 *     UPDATE matches zero rows. Two common reasons for a zero-match:
 *       1. The webhook arrived before the worker persisted the message id.
 *          Resend's later attempts will catch up.
 *       2. The event references an email_id we have no outbox row for
 *          (e.g. manual send via dashboard). Nothing for us to do.
 *   - We match by `resend_message_id` only. We never need to look up by
 *     dedup_key here because the worker always writes resend_message_id on
 *     a successful send.
 *
 * Status transitions:
 *   email.sent             → status='sent' (also re-stamps sent_at)
 *   email.delivered        → status='delivered'
 *   email.delivery_delayed → status='delayed'
 *   email.bounced          → status='bounced'
 *   email.complained       → status='complained'
 *   email.suppressed       → status='suppressed'
 *
 * Other event types (opened, clicked, domain.*, contact.*) are acknowledged
 * with 200 but ignored — we don't store engagement signals in email_outbox.
 */

import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";

import { env } from "@/lib/env";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ResendEvent = {
  type: string;
  data: {
    email_id?: string;
    [k: string]: unknown;
  };
};

const STATUS_MAP: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.suppressed": "suppressed",
};

export async function POST(req: NextRequest) {
  if (!env?.RESEND_WEBHOOK_SECRET) {
    console.error(
      "[webhooks/resend] RESEND_WEBHOOK_SECRET missing; refusing to verify",
    );
    return NextResponse.json(
      { ok: false, error: "RESEND_WEBHOOK_SECRET not configured" },
      { status: 500 },
    );
  }
  if (!env.RESEND_API_KEY) {
    // resend.webhooks.verify() lives on the Resend client; we need the SDK
    // initialised even though we're not making API calls here.
    console.error("[webhooks/resend] RESEND_API_KEY missing");
    return NextResponse.json(
      { ok: false, error: "RESEND_API_KEY not configured" },
      { status: 500 },
    );
  }

  // CRITICAL: raw body, not parsed JSON. JSON parsing reorders/reformats and
  // breaks the Svix signature.
  const payload = await req.text();

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { ok: false, error: "missing svix headers" },
      { status: 400 },
    );
  }

  let event: ResendEvent;
  try {
    const resend = new Resend(env.RESEND_API_KEY);
    // SDK v6.11 contract: `headers` is `{ id, timestamp, signature }`, NOT
    // the raw svix-* keys. The SDK rebuilds the svix headers internally
    // before handing them to the `svix` library.
    const verified = resend.webhooks.verify({
      payload,
      headers: {
        id: svixId,
        timestamp: svixTimestamp,
        signature: svixSignature,
      },
      webhookSecret: env.RESEND_WEBHOOK_SECRET,
    });
    event = verified as unknown as ResendEvent;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[webhooks/resend] signature verification failed", { message });
    return NextResponse.json(
      { ok: false, error: "invalid signature" },
      { status: 401 },
    );
  }

  const eventType = event.type;
  const emailId = event.data?.email_id;

  const newStatus = STATUS_MAP[eventType];
  if (!newStatus) {
    // Engagement events (opened/clicked) and unrelated channels — ack.
    return NextResponse.json({ ok: true, ignored: eventType }, { status: 200 });
  }

  if (!emailId) {
    console.warn("[webhooks/resend] event without email_id", { eventType });
    return NextResponse.json({ ok: true, matched: 0 }, { status: 200 });
  }

  const supabase = createSupabaseServiceRoleClient();

  const updatePayload: Record<string, unknown> = { status: newStatus };
  if (eventType === "email.sent") {
    updatePayload.sent_at = new Date().toISOString();
  }

  const { data: updated, error: updateError } = await supabase
    .from("email_outbox")
    .update(updatePayload)
    .eq("resend_message_id", emailId)
    .select("id");

  if (updateError) {
    console.error("[webhooks/resend] update failed", {
      eventType,
      emailId,
      message: updateError.message,
    });
    // Return 200 anyway — Svix should not retry on our DB hiccup, this row
    // will heal on subsequent webhook events or be inspected manually.
    return NextResponse.json(
      { ok: true, error: updateError.message },
      { status: 200 },
    );
  }

  const matched = updated?.length ?? 0;
  if (matched === 0) {
    // Race: webhook arrived before our worker persisted resend_message_id, or
    // event references a manual send. Per skill guidance, ack 200 — Resend
    // retries (1d8h) will catch up.
    console.info("[webhooks/resend] no matching row", { eventType, emailId });
  }
  return NextResponse.json(
    { ok: true, eventType, matched },
    { status: 200 },
  );
}
