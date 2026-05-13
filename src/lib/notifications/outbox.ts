/**
 * Email outbox writer.
 *
 * Enqueues an email into `public.email_outbox` for the worker
 * (src/lib/notifications/worker.ts) to pick up on its next drain. Callers
 * MUST pass a stable `dedupKey` — the table has a UNIQUE constraint on it and
 * we use `onConflict: 'dedup_key', ignoreDuplicates: true` so a retried
 * enqueue is a true no-op (the original row is returned via a follow-up
 * SELECT, with `existing: true`).
 *
 * Why the manual follow-up SELECT after upsert?
 *
 *   PostgREST returns an empty `data` array when `ignoreDuplicates: true`
 *   fires (since the conflicting row is skipped, not modified). To give
 *   callers a usable `id` either way, we look the row up by `dedup_key` when
 *   the upsert returned nothing.
 *
 * Dedup-key format (Resend skill, references/webhooks.md & SKILL.md):
 *
 *   <template_kind>/<recipient_id>/<sha256(canonicalPayload).slice(0,16)>
 *
 * Caps total length at 256 chars to satisfy Resend's idempotency-key spec.
 * The same string is later passed straight through as the Resend
 * `idempotencyKey` so we get end-to-end exactly-once semantics over the 24h
 * Resend dedup window.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

export type EnqueueEmailParams = {
  recipientProfileId?: string | null;
  recipientEmail: string;
  templateKind: string;
  locale: "en" | "ar";
  payload: Record<string, unknown>;
  subjectOverride?: string;
  dedupKey: string;
  sendAt?: Date;
};

export type EnqueueResult =
  | { ok: true; id: string; existing: boolean }
  | { ok: false; error: string };

const DEDUP_KEY_MAX_LEN = 256;

/**
 * Sort-key recursive JSON canonicalizer. Two objects with the same keys and
 * values produce the same string regardless of key insertion order. Required
 * so that `makeDedupKey({ a:1, b:2 })` and `makeDedupKey({ b:2, a:1 })`
 * collide — they're semantically the same payload.
 */
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalize(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`,
  );
  return `{${parts.join(",")}}`;
}

export function makeDedupKey(
  templateKind: string,
  recipientId: string,
  payload: Record<string, unknown>,
): string {
  const canonical = canonicalize(payload);
  const hash = createHash("sha256").update(canonical).digest("hex").slice(0, 16);
  const raw = `${templateKind}/${recipientId}/${hash}`;
  // Resend limit is 256 chars; trimming the prefix is safer than trimming the
  // hash (the hash is what actually disambiguates payloads).
  if (raw.length <= DEDUP_KEY_MAX_LEN) return raw;
  const overflow = raw.length - DEDUP_KEY_MAX_LEN;
  return raw.slice(overflow);
}

export async function enqueueEmail(
  supabase: SupabaseClient,
  params: EnqueueEmailParams,
): Promise<EnqueueResult> {
  if (!params.dedupKey || params.dedupKey.length > DEDUP_KEY_MAX_LEN) {
    return {
      ok: false,
      error: `dedupKey missing or exceeds ${DEDUP_KEY_MAX_LEN} chars`,
    };
  }
  if (!params.recipientEmail) {
    return { ok: false, error: "recipientEmail is required" };
  }

  const row: Record<string, unknown> = {
    recipient_profile_id: params.recipientProfileId ?? null,
    recipient_email: params.recipientEmail,
    template_kind: params.templateKind,
    locale: params.locale,
    payload_jsonb: params.payload ?? {},
    dedup_key: params.dedupKey,
  };
  if (params.subjectOverride) row.subject_override = params.subjectOverride;
  if (params.sendAt) row.send_at = params.sendAt.toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from("email_outbox")
    .upsert(row, { onConflict: "dedup_key", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();

  if (insertError) {
    console.error("[notifications/outbox] upsert failed", {
      dedupKey: params.dedupKey,
      message: insertError.message,
    });
    return { ok: false, error: insertError.message };
  }

  if (inserted?.id) {
    return { ok: true, id: inserted.id as string, existing: false };
  }

  // ignoreDuplicates fired — fetch the existing row by dedup_key so callers
  // still get back an id.
  const { data: existing, error: selectError } = await supabase
    .from("email_outbox")
    .select("id")
    .eq("dedup_key", params.dedupKey)
    .maybeSingle();

  if (selectError || !existing) {
    const message = selectError?.message ?? "row not found after upsert";
    console.error("[notifications/outbox] follow-up select failed", {
      dedupKey: params.dedupKey,
      message,
    });
    return { ok: false, error: message };
  }

  return { ok: true, id: existing.id as string, existing: true };
}
