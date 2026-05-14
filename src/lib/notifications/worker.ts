/**
 * Email outbox worker.
 *
 * `drainEmailOutbox` pulls a batch of `public.email_outbox` rows whose
 * `send_at` has matured, renders the matching template, calls Resend (passing
 * `dedup_key` as `idempotencyKey`), and updates each row in-place with the
 * outcome.
 *
 * Why a TS worker (not a SQL cron job)?
 *
 *   The render step requires React-Email + Node.js, which can't run inside
 *   Postgres. SQL cron's role is to *insert* pending rows; the Next.js cron
 *   endpoint at /api/cron/email-outbox calls this drain function on a short
 *   interval to flush them out.
 *
 * Status transitions enforced here:
 *
 *   pending → sent          on Resend 2xx (also stamps resend_message_id +
 *                            sent_at; webhook will later flip to delivered /
 *                            bounced / complained / suppressed)
 *   pending → pending       on transient errors (429, 5xx, network) — bumps
 *                            attempts and pushes send_at out with exponential
 *                            backoff (60s * 2^attempts, capped at 1h)
 *   pending → failed        on permanent errors (400, 422) or once attempts
 *                            >= 5 on transients
 *   pending → conflict      on Resend 409 — means the same dedup_key was
 *                            reused with a different payload, which is a
 *                            code bug; the worker stops retrying and the row
 *                            stands as a tombstone for diagnosis.
 *   pending → failed        if no template is registered for the row's kind.
 *
 * Resend SDK contract (from .agents/skills/resend/SKILL.md):
 *
 *   `emails.send` returns `{ data, error }` and does NOT throw on API errors
 *   (4xx/5xx). Network errors (DNS, ECONNRESET) DO throw — that's why the
 *   try/catch around the call still matters.
 *
 * Pacing:
 *
 *   We `setTimeout(500ms)` between sends to stay below Resend's default
 *   2 req/s. With batchSize=10 that's a worst-case ~5s per drain, which fits
 *   comfortably inside any sub-minute cron tick.
 */

import { render } from "@react-email/render";
import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

export type DrainSummary = {
  scanned: number;
  sent: number;
  deferred: number;
  failed: number;
  conflict: number;
  suppressed: number;
};

type OutboxRow = {
  id: string;
  recipient_email: string;
  template_kind: string;
  locale: "en" | "ar";
  payload_jsonb: Record<string, unknown>;
  subject_override: string | null;
  from_email: string;
  attempts: number;
  dedup_key: string;
};

type TemplateModule = {
  // React-Email component (default export)
  default: (props: Record<string, unknown>) => unknown;
  // Strings sibling — both shapes are accepted.
  strings?: Record<
    "en" | "ar",
    Record<string, unknown> & {
      subject?: unknown;
      preview?: unknown;
    }
  >;
};

/**
 * Map of notification.kind → dynamic template import. Mirror of
 * src/lib/notifications/inApp.ts NotificationKind. Kinds with no template
 * yet wired stay absent here — the worker marks those rows `failed` with a
 * descriptive `last_error` so they don't loop forever.
 *
 * Auth-flow templates (PasswordReset etc.) are excluded because they're
 * triggered out-of-band by Supabase Auth, not by notification rows.
 */
const TEMPLATES: Record<string, () => Promise<TemplateModule>> = {
  // Supplier lifecycle.
  "supplier.approved": () =>
    import("./templates/supplier/SupplierApproved") as unknown as Promise<TemplateModule>,
  "supplier.rejected": () =>
    import("./templates/supplier/SupplierRejected") as unknown as Promise<TemplateModule>,
  "quote.accepted": () =>
    import("./templates/supplier/QuoteAccepted") as unknown as Promise<TemplateModule>,

  // Organizer lifecycle.
  "booking.created": () =>
    import("./templates/organizer/BookingCreated") as unknown as Promise<TemplateModule>,
  "booking.confirmed": () =>
    import("./templates/organizer/BookingConfirmed") as unknown as Promise<TemplateModule>,
  "booking.cancelled": () =>
    import("./templates/organizer/BookingCancelledBySupplier") as unknown as Promise<TemplateModule>,
  // QuoteReceived covers the organizer-side "supplier sent you a quote".
  "quote.sent": () =>
    import("./templates/organizer/QuoteReceived") as unknown as Promise<TemplateModule>,

  // Supplier lifecycle — queue-driven (Path B).
  "quote.rejected": () =>
    import("./templates/supplier/QuoteRejected") as unknown as Promise<TemplateModule>,
  "quote.proposal_requested": () =>
    import("./templates/supplier/QuoteProposalRequested") as unknown as Promise<TemplateModule>,
  "rfq.invited": () =>
    import("./templates/supplier/RfqInvited") as unknown as Promise<TemplateModule>,
};

const BATCH_SIZE_DEFAULT = 10;
const BACKOFF_BASE_MS = 60_000; // 60s
const BACKOFF_MAX_MS = 60 * 60_000; // 1h
const MAX_ATTEMPTS = 5;
const PACING_MS = 500;

function nextSendAt(attempts: number): string {
  // 60s * 2^attempts, capped at 1h. attempts has already been bumped by the
  // caller, so attempt=1 → 60s, attempt=2 → 120s, ... attempt=6 → 1h cap.
  const ms = Math.min(BACKOFF_BASE_MS * 2 ** attempts, BACKOFF_MAX_MS);
  return new Date(Date.now() + ms).toISOString();
}

function pickSubject(
  tpl: TemplateModule,
  locale: "en" | "ar",
  templateKind: string,
  payload: Record<string, unknown>,
  override: string | null,
): string {
  if (override && override.length > 0) return override;
  const bundle = tpl.strings?.[locale];
  if (bundle) {
    const previewFn = bundle.preview;
    if (typeof previewFn === "function") {
      try {
        const candidate = (previewFn as (...args: unknown[]) => unknown)(
          ...orderedPreviewArgs(payload),
        );
        if (typeof candidate === "string" && candidate.length > 0) return candidate;
      } catch {
        // Template's preview() expects positional args we don't know — fall
        // through to the static subject / kind fallback.
      }
    } else if (typeof previewFn === "string" && previewFn.length > 0) {
      return previewFn;
    }
    const subject = bundle.subject;
    if (typeof subject === "function") {
      try {
        const candidate = (subject as (...args: unknown[]) => unknown)(
          ...orderedPreviewArgs(payload),
        );
        if (typeof candidate === "string" && candidate.length > 0) return candidate;
      } catch {
        // ignore
      }
    } else if (typeof subject === "string" && subject.length > 0) {
      return subject;
    }
  }
  return templateKind;
}

/**
 * Best-effort positional args for a preview()/subject() call when we don't
 * know the template's exact signature. We pass the raw payload values in a
 * stable order so simple `(name) => ...` previews work; complex ones fall
 * back to the static subject or the template_kind.
 */
function orderedPreviewArgs(payload: Record<string, unknown>): unknown[] {
  const priority = [
    "supplierBusinessName",
    "supplier",
    "eventName",
    "organizerName",
    "bookingId",
    "quoteId",
  ];
  const seen = new Set<string>();
  const args: unknown[] = [];
  for (const key of priority) {
    if (key in payload) {
      args.push(payload[key]);
      seen.add(key);
    }
  }
  for (const [key, value] of Object.entries(payload)) {
    if (!seen.has(key)) args.push(value);
  }
  return args;
}

export async function drainEmailOutbox(
  supabase: SupabaseClient,
  opts?: { batchSize?: number },
): Promise<DrainSummary> {
  const summary: DrainSummary = {
    scanned: 0,
    sent: 0,
    deferred: 0,
    failed: 0,
    conflict: 0,
    suppressed: 0,
  };

  const apiKey = env?.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[notifications/worker] RESEND_API_KEY missing; skipping drain");
    return summary;
  }
  const resend = new Resend(apiKey);

  const batchSize = opts?.batchSize ?? BATCH_SIZE_DEFAULT;

  const { data: rows, error: selectError } = await supabase
    .from("email_outbox")
    .select(
      "id, recipient_email, template_kind, locale, payload_jsonb, subject_override, from_email, attempts, dedup_key",
    )
    .eq("status", "pending")
    .lte("send_at", new Date().toISOString())
    .order("send_at", { ascending: true })
    .limit(batchSize);

  if (selectError) {
    console.error("[notifications/worker] select failed", {
      message: selectError.message,
    });
    return summary;
  }
  if (!rows || rows.length === 0) return summary;

  summary.scanned = rows.length;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] as OutboxRow;

    // 1. Resolve template.
    const importer = TEMPLATES[row.template_kind];
    if (!importer) {
      await supabase
        .from("email_outbox")
        .update({
          status: "failed",
          last_error: `no template registered for kind ${row.template_kind}`,
        })
        .eq("id", row.id);
      summary.failed += 1;
      continue;
    }

    let tpl: TemplateModule;
    try {
      tpl = await importer();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase
        .from("email_outbox")
        .update({
          status: "failed",
          last_error: `template import failed: ${message}`,
          attempts: row.attempts + 1,
        })
        .eq("id", row.id);
      summary.failed += 1;
      continue;
    }

    // 2. Render HTML.
    let html: string;
    try {
      const Component = tpl.default;
      const element = Component({ locale: row.locale, ...row.payload_jsonb });
      // @react-email/render accepts any ReactElement; cast for the type-check.
      html = await render(element as Parameters<typeof render>[0]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase
        .from("email_outbox")
        .update({
          status: "failed",
          last_error: `render failed: ${message}`,
          attempts: row.attempts + 1,
        })
        .eq("id", row.id);
      summary.failed += 1;
      continue;
    }

    // 3. Subject.
    const subject = pickSubject(
      tpl,
      row.locale,
      row.template_kind,
      row.payload_jsonb,
      row.subject_override,
    );

    // 4. Send.
    type SendOutcome =
      | { kind: "sent"; id: string | null }
      | { kind: "transient"; message: string; statusCode?: number }
      | { kind: "permanent"; message: string; statusCode: number }
      | { kind: "conflict"; message: string };

    let outcome: SendOutcome;
    try {
      const { data, error } = await resend.emails.send(
        {
          from: row.from_email,
          to: row.recipient_email,
          subject,
          html,
        },
        { idempotencyKey: row.dedup_key },
      );
      if (error) {
        const statusCode =
          (error as { statusCode?: number; status?: number }).statusCode ??
          (error as { statusCode?: number; status?: number }).status ??
          0;
        const message = error.message ?? String(error);
        if (statusCode === 409) {
          outcome = { kind: "conflict", message };
        } else if (statusCode === 429 || statusCode >= 500) {
          outcome = { kind: "transient", message, statusCode };
        } else if (statusCode === 400 || statusCode === 422) {
          outcome = { kind: "permanent", message, statusCode };
        } else {
          // Treat unknown codes as transient up to MAX_ATTEMPTS — safer than
          // dropping mail when Resend introduces a new error code we don't
          // recognize yet.
          outcome = { kind: "transient", message, statusCode };
        }
      } else {
        outcome = { kind: "sent", id: data?.id ?? null };
      }
    } catch (err) {
      // Network / SDK-thrown: always transient.
      const message = err instanceof Error ? err.message : String(err);
      outcome = { kind: "transient", message };
    }

    // 5. Persist outcome.
    if (outcome.kind === "sent") {
      await supabase
        .from("email_outbox")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          resend_message_id: outcome.id,
          last_error: null,
        })
        .eq("id", row.id);
      summary.sent += 1;
    } else if (outcome.kind === "conflict") {
      await supabase
        .from("email_outbox")
        .update({
          status: "conflict",
          last_error: outcome.message,
          attempts: row.attempts + 1,
        })
        .eq("id", row.id);
      summary.conflict += 1;
    } else if (outcome.kind === "permanent") {
      await supabase
        .from("email_outbox")
        .update({
          status: "failed",
          last_error: `[${outcome.statusCode}] ${outcome.message}`,
          attempts: row.attempts + 1,
        })
        .eq("id", row.id);
      summary.failed += 1;
    } else {
      // transient
      const nextAttempts = row.attempts + 1;
      if (nextAttempts >= MAX_ATTEMPTS) {
        await supabase
          .from("email_outbox")
          .update({
            status: "failed",
            last_error: `transient (max attempts): ${outcome.message}`,
            attempts: nextAttempts,
          })
          .eq("id", row.id);
        summary.failed += 1;
      } else {
        await supabase
          .from("email_outbox")
          .update({
            status: "pending",
            attempts: nextAttempts,
            send_at: nextSendAt(nextAttempts),
            last_error: outcome.message,
          })
          .eq("id", row.id);
        summary.deferred += 1;
      }
    }

    // 6. Pace — keep under Resend's 2 req/s default. Skip the final sleep.
    if (i < rows.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, PACING_MS));
    }
  }

  return summary;
}
