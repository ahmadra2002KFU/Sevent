"use server";

/**
 * Sprint 4 Lane 2 — supplier quote builder server action.
 *
 * `sendQuoteAction` is the single mutation surface behind the quote form.
 * It follows the zero-trust recomputation rule:
 *   - `source` ∈ {rule_engine, mixed} → ignore every client-submitted number
 *     on the snapshot; re-fetch rules + package from the DB, call
 *     `composePrice(ctx)`, and persist that result verbatim.
 *   - `source` = free_form → trust the client line items + addons, but still
 *     clamp to integer halalas (the Zod schema rejects non-integer money).
 *
 * All writes go through the service-role admin client returned by
 * `requireRole("supplier")`. Never use the user-scoped client for writes
 * on quotes; RLS policies on quotes trigger the rfqs-recursion we've hit
 * on other surfaces (same reason the decline action uses service-role).
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAccess } from "@/lib/auth/access";
import { sarToHalalas } from "@/lib/domain/money";
import { STORAGE_BUCKETS, supplierScopedPath } from "@/lib/supabase/storage";
import {
  buildRevisionSnapshot,
  QUOTE_ENGINE_VERSION,
  type QuoteLineItem,
  type QuoteLineItemKind,
  type QuoteSnapshot,
  type QuoteSource,
  type QuoteUnit,
} from "@/lib/domain/quote";
import {
  composePrice,
  VAT_RATE_PCT,
  type PricingCtx,
  type PricingPackageInput,
  type PricingRuleInput,
} from "@/lib/domain/pricing/engine";
import { getDistanceKm } from "@/lib/domain/pricing/distance";
import type { PricingRuleType } from "@/lib/domain/pricing/rules";
import { createNotification } from "@/lib/notifications/inApp";
import type { ActionState } from "./action-state";

// ---------------------------------------------------------------------------
// Zod schema — client submission shape.
// Money fields arrive in SAR as strings (RHF form inputs). Non-empty strings
// are converted to halalas at the boundary; empties default to 0.
// ---------------------------------------------------------------------------

const QUOTE_SOURCES = ["rule_engine", "free_form", "mixed"] as const;
const QUOTE_UNITS = ["event", "hour", "day", "person", "unit"] as const;
const LINE_ITEM_KINDS: readonly QuoteLineItemKind[] = [
  "package",
  "qty_discount",
  "date_surcharge",
  "distance_fee",
  "duration_multiplier",
  "free_form",
] as const;

// Non-negative SAR money strings (e.g. "1234.50"). Empty string coerces to 0.
const sarMoneyString = z
  .string()
  .trim()
  .default("")
  .transform((v) => (v === "" ? "0" : v))
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), {
    message: "Money must be a non-negative SAR amount with up to 2 decimals.",
  });

const integerHalalas = z
  .number()
  .int("Money must be an integer halalas value.")
  .nonnegative("Money cannot be negative.")
  .max(Number.MAX_SAFE_INTEGER);

const lineItemSchema = z.object({
  kind: z.enum(LINE_ITEM_KINDS as unknown as readonly [QuoteLineItemKind, ...QuoteLineItemKind[]]),
  label: z.string().trim().min(1).max(200),
  qty: z.number().int().positive(),
  unit: z.enum(QUOTE_UNITS),
  unit_price_halalas: integerHalalas,
  total_halalas: integerHalalas,
});

const submissionSchema = z.object({
  rfq_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  invite_id: z.string().uuid(),
  source: z.enum(QUOTE_SOURCES),
  package_id: z.string().uuid().nullable().optional().transform((v) => v ?? null),
  qty: z.coerce.number().int().positive().default(1),
  line_items: z.array(lineItemSchema).min(1).max(40),
  // Addons in SAR strings — converted to halalas before engine call.
  setup_fee_sar: sarMoneyString,
  teardown_fee_sar: sarMoneyString,
  // FormData stringifies the checkbox; treat "true"/"on"/"1" as on, anything
  // else (including absent) as off. z.coerce.boolean would treat "false" as
  // truthy, which is exactly the bug we want to avoid.
  prices_include_vat: z
    .union([z.string(), z.boolean(), z.undefined(), z.null()])
    .transform((v) => v === true || v === "true" || v === "on" || v === "1"),
  deposit_pct: z.coerce.number().min(0).max(100).default(0),
  payment_schedule: z.string().trim().max(500).default(""),
  cancellation_terms: z.string().trim().max(500).default(""),
  inclusions: z.array(z.string().trim().min(1).max(200)).max(40).default([]),
  exclusions: z.array(z.string().trim().min(1).max(200)).max(40).default([]),
  notes: z.string().trim().max(1024).nullable().optional().transform((v) => (v && v.length > 0 ? v : null)),
  expires_at: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type QuoteSubmissionInput = z.input<typeof submissionSchema>;
type QuoteSubmissionParsed = z.output<typeof submissionSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * FormData on the client carries JSON blobs for the array-shaped fields
 * (line_items, inclusions, exclusions) because RHF's `useFieldArray` is the
 * friendliest way to author them. We parse once here; any malformed JSON
 * surfaces as a validation error alongside Zod's.
 */
function parseJsonField<T>(formData: FormData, key: string, fallback: T): T {
  const raw = formData.get(key);
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readSubmission(formData: FormData): QuoteSubmissionParsed | { error: string } {
  const payload = {
    rfq_id: formData.get("rfq_id"),
    supplier_id: formData.get("supplier_id"),
    invite_id: formData.get("invite_id"),
    source: formData.get("source"),
    package_id: formData.get("package_id") || null,
    qty: formData.get("qty") ?? 1,
    line_items: parseJsonField<unknown[]>(formData, "line_items", []),
    setup_fee_sar: formData.get("setup_fee_sar") ?? "",
    teardown_fee_sar: formData.get("teardown_fee_sar") ?? "",
    prices_include_vat: formData.get("prices_include_vat"),
    deposit_pct: formData.get("deposit_pct") ?? 0,
    payment_schedule: formData.get("payment_schedule") ?? "",
    cancellation_terms: formData.get("cancellation_terms") ?? "",
    inclusions: parseJsonField<string[]>(formData, "inclusions", []),
    exclusions: parseJsonField<string[]>(formData, "exclusions", []),
    notes: formData.get("notes") ?? null,
    expires_at: formData.get("expires_at") ?? "",
  };
  const parsed = submissionSchema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.length ? `${first.path.join(".")}: ` : "";
    return { error: `${path}${first?.message ?? "Invalid quote submission."}` };
  }
  return parsed.data;
}

/**
 * Translate `upsert_quote_revision_tx` raise codes into a user-facing message.
 * Only P0011 (`quote_revision_not_editable:<status>`) is expected here; other
 * codes would indicate a migration mismatch.
 */
function mapRpcError(code: string | null | undefined, message: string): string {
  if (!code && !message) return "Supabase RPC failed with no error detail.";
  if (code === "P0011") {
    // message shape: "quote_revision_not_editable:<status>"
    const m = /quote_revision_not_editable:([a-z_]+)/i.exec(message);
    const status = m?.[1] ?? "terminal";
    return `This quote can no longer be edited (status: ${status}).`;
  }
  return message || `RPC failed (${code ?? "unknown"}).`;
}

// ---------------------------------------------------------------------------
// Main action
// ---------------------------------------------------------------------------

const TECHNICAL_PROPOSAL_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function sendQuoteAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  // 1. Access gate — `supplier.rfqs.respond` requires supplier.approved.
  // On non-approved states requireAccess redirects to the dashboard, so
  // the mutation never runs. `decision.supplierId` is the caller's row.
  const { decision, user, admin } = await requireAccess(
    "supplier.rfqs.respond",
  );
  const supplierId = decision.supplierId;
  if (!supplierId) {
    return { status: "error", message: "Supplier profile not found." };
  }

  // 2. Parse + validate.
  const parsed = readSubmission(formData);
  if ("error" in parsed) return { status: "error", message: parsed.error };
  const data = parsed;

  // Optional technical-proposal PDF (ملف فني). Extracted here so we can
  // fail-fast on bad uploads before we hit the pricing engine or the RPC.
  const techRaw = formData.get("technical_proposal_file");
  const technicalFile =
    techRaw instanceof Blob && techRaw.size > 0 ? (techRaw as File) : null;
  if (technicalFile) {
    if (technicalFile.size > TECHNICAL_PROPOSAL_MAX_BYTES) {
      return {
        status: "error",
        message: "Technical proposal must be 10 MB or smaller.",
      };
    }
    if (technicalFile.type && technicalFile.type !== "application/pdf") {
      return {
        status: "error",
        message: "Technical proposal must be a PDF.",
      };
    }
  }

  // 3. Ownership check — the client-submitted supplier_id must match the
  // caller's row; otherwise a crafted form could target a different supplier.
  if (data.supplier_id !== supplierId) {
    return {
      status: "error",
      message: "You are not allowed to quote for this supplier.",
    };
  }

  // 4. Active invite check — (rfq_id, supplier_id) with status ∈ {invited, quoted}.
  const { data: inviteRow, error: inviteErr } = await admin
    .from("rfq_invites")
    .select("id, rfq_id, supplier_id, status")
    .eq("rfq_id", data.rfq_id)
    .eq("supplier_id", data.supplier_id)
    .maybeSingle();
  if (inviteErr) {
    return { status: "error", message: `Invite lookup failed: ${inviteErr.message}` };
  }
  const invite = inviteRow as
    | { id: string; rfq_id: string; supplier_id: string; status: string }
    | null;
  if (!invite || (invite.status !== "invited" && invite.status !== "quoted")) {
    return {
      status: "error",
      message: "This RFQ is no longer open for quoting.",
    };
  }

  // 5. Load RFQ + event so we have pricing context + organizer target for the
  //    notification row.
  const { data: rfqRow, error: rfqErr } = await admin
    .from("rfqs")
    .select(
      "id, event_id, events(id, organizer_id, starts_at, ends_at, guest_count, venue_location)",
    )
    .eq("id", data.rfq_id)
    .maybeSingle();
  if (rfqErr) return { status: "error", message: `RFQ lookup failed: ${rfqErr.message}` };
  const rfq = rfqRow as
    | {
        id: string;
        event_id: string;
        events: {
          id: string;
          organizer_id: string;
          starts_at: string;
          ends_at: string;
          guest_count: number | null;
          venue_location: unknown | null;
        } | null;
      }
    | null;
  if (!rfq || !rfq.events) {
    return { status: "error", message: "RFQ or linked event not found." };
  }
  const event = rfq.events;

  // PostGIS returns venue_location as GeoJSON-ish via service-role. We don't
  // need the raw coords here — getDistanceKm runs the ST_Distance query itself
  // using the supplier's base_location. But the snapshot's inputs_digest wants
  // venue_lat/venue_lng for drift detection, so fetch them separately.
  const venueCoords = await loadVenueCoords(admin, event.id);

  // 6. Existing quote (if any) — needed for supplier_response_deadline UPDATE
  //    target and to decide if we skip because of terminal status. The RPC
  //    itself enforces this invariant, but failing fast with a cleaner message
  //    beats a P0011 round-trip.
  const { data: existingQuoteRow } = await admin
    .from("quotes")
    .select("id, status")
    .eq("rfq_id", data.rfq_id)
    .eq("supplier_id", data.supplier_id)
    .maybeSingle();
  const existingQuote = existingQuoteRow as { id: string; status: string } | null;
  if (existingQuote && !["draft", "sent"].includes(existingQuote.status)) {
    return {
      status: "error",
      message: `This quote can no longer be edited (status: ${existingQuote.status}).`,
    };
  }

  // 7. Build the snapshot. Two paths: zero-trust recompute (rule_engine, mixed)
  //    vs trust-client (free_form).
  const setup_fee_halalas = sarToHalalas(data.setup_fee_sar);
  const teardown_fee_halalas = sarToHalalas(data.teardown_fee_sar);
  const deposit_pct = Math.round(data.deposit_pct);

  let snapshotBase: Omit<QuoteSnapshot, "inputs_digest">;
  let quotedPackageId: string | null = data.package_id;

  if (data.source === "rule_engine" || data.source === "mixed") {
    // Re-fetch the active rules + package from DB. Client-submitted numbers
    // are ignored; composePrice is the authority.
    if (!data.package_id) {
      return {
        status: "error",
        message: "Rule-engine quotes require a package selection.",
      };
    }
    const pkg = await loadPackage(admin, data.supplier_id, data.package_id);
    if ("error" in pkg) return { status: "error", message: pkg.error };

    const rules = await loadActiveRules(admin, data.supplier_id, data.package_id);
    if ("error" in rules) return { status: "error", message: rules.error };

    const distance_km = await safeDistanceKm(admin, {
      supplier_id: data.supplier_id,
      venue_lat: venueCoords.lat,
      venue_lng: venueCoords.lng,
    });

    const ctx: PricingCtx = {
      event: {
        id: event.id,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        guest_count: event.guest_count,
        venue_lat: venueCoords.lat,
        venue_lng: venueCoords.lng,
      },
      pkg: pkg.data,
      qty: Math.max(data.qty, pkg.data.min_qty),
      rules: rules.data,
      distance_km,
      source: data.source,
      prices_include_vat: data.prices_include_vat,
      addons: {
        setup_fee_halalas,
        teardown_fee_halalas,
        travel_fee_halalas_override: null,
        inclusions: data.inclusions,
        exclusions: data.exclusions,
        cancellation_terms: data.cancellation_terms,
        payment_schedule: data.payment_schedule,
        deposit_pct,
        notes: data.notes ?? null,
        expires_at: data.expires_at ?? null,
      },
    };

    const computed = composePrice(ctx);
    snapshotBase = stripDigest(computed.snapshot);
    quotedPackageId = pkg.data.id;
  } else {
    // free_form: trust client values, but still normalise + integer-clamp.
    const line_items: QuoteLineItem[] = data.line_items.map((li) => ({
      kind: li.kind,
      label: li.label,
      qty: li.qty,
      unit: li.unit as QuoteUnit,
      unit_price_halalas: li.unit_price_halalas,
      total_halalas: li.total_halalas,
    }));
    const subtotal = line_items.reduce((acc, li) => acc + li.total_halalas, 0);
    // Mirror engine.ts step 8/9: same taxable base, same inclusive/exclusive
    // branches. Free-form has no travel fee (no rules), so the base is just
    // subtotal + addons.
    const taxable_base = subtotal + setup_fee_halalas + teardown_fee_halalas;
    const vat_amount = data.prices_include_vat
      ? Math.round((taxable_base * VAT_RATE_PCT) / (100 + VAT_RATE_PCT))
      : Math.round((taxable_base * VAT_RATE_PCT) / 100);
    const total = data.prices_include_vat
      ? taxable_base
      : taxable_base + vat_amount;

    snapshotBase = {
      engine_version: QUOTE_ENGINE_VERSION,
      currency: "SAR",
      source: "free_form",
      line_items,
      subtotal_halalas: subtotal,
      travel_fee_halalas: 0,
      setup_fee_halalas,
      teardown_fee_halalas,
      vat_rate_pct: VAT_RATE_PCT,
      vat_amount_halalas: vat_amount,
      prices_include_vat: data.prices_include_vat,
      total_halalas: total,
      deposit_pct,
      payment_schedule: data.payment_schedule,
      cancellation_terms: data.cancellation_terms,
      inclusions: data.inclusions,
      exclusions: data.exclusions,
      notes: data.notes ?? null,
      expires_at: data.expires_at ?? null,
    };
  }

  // 8. Canonicalize → { snapshot, content_hash }.
  const built = buildRevisionSnapshot({
    ...snapshotBase,
    inputs: {
      event_id: event.id,
      event_starts_at: event.starts_at,
      event_ends_at: event.ends_at,
      guest_count: event.guest_count,
      venue_lat: venueCoords.lat,
      venue_lng: venueCoords.lng,
      package_id: quotedPackageId,
      distance_km: null, // Engine skipped distance for Sprint 4 stub; digest tolerates.
    },
  });
  const { snapshot, content_hash } = built;

  // 9. Upsert revision via the Sprint 4 RPC. P0011 → "terminal status" message.
  const { data: rpcRows, error: rpcErr } = await admin.rpc("upsert_quote_revision_tx", {
    p_rfq_id: data.rfq_id,
    p_supplier_id: data.supplier_id,
    p_author_id: user.id,
    p_snapshot: snapshot as unknown as Record<string, unknown>,
    p_content_hash: content_hash,
    p_source: data.source as QuoteSource,
  });
  if (rpcErr) {
    return {
      status: "error",
      message: mapRpcError((rpcErr as { code?: string }).code ?? null, rpcErr.message),
    };
  }
  const rpcResult = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
  const row = rpcResult as
    | { quote_id: string; revision_id: string; version: number }
    | null;
  if (!row) {
    return {
      status: "error",
      message: "Supabase RPC returned no row — quote was not saved.",
    };
  }

  // 10a. Technical proposal upload (optional). Runs AFTER the RPC so we know
  //      the revision_id to attach the file to. On upload failure we don't
  //      delete the revision — the pricing snapshot is the primary artifact;
  //      the tech file is supplementary. On column-UPDATE failure we best-effort
  //      delete the orphan blob so the bucket doesn't accumulate garbage.
  if (technicalFile) {
    const path = supplierScopedPath(
      data.supplier_id,
      "quote-attachments",
      `technical-proposal-${crypto.randomUUID()}.pdf`,
    );
    const buf = Buffer.from(await technicalFile.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from(STORAGE_BUCKETS.docs)
      .upload(path, buf, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (upErr) {
      console.warn("[sendQuoteAction] technical proposal upload failed", {
        quote_id: row.quote_id,
        revision_id: row.revision_id,
        message: upErr.message,
      });
    } else {
      const { error: patchErr } = await admin
        .from("quote_revisions")
        .update({ technical_proposal_path: path })
        .eq("id", row.revision_id);
      if (patchErr) {
        console.warn("[sendQuoteAction] failed to attach technical proposal path", {
          revision_id: row.revision_id,
          message: patchErr.message,
        });
        await admin.storage.from(STORAGE_BUCKETS.docs).remove([path]);
      }
    }
  }

  // 10. Side writes the RPC doesn't cover. Failure here leaves the revision
  //     saved but the deadline / invite un-flipped; we surface a best-effort
  //     message rather than trying to roll back the immutable revision row.
  if (snapshot.expires_at) {
    const { error: deadlineErr } = await admin
      .from("quotes")
      .update({ supplier_response_deadline: snapshot.expires_at })
      .eq("id", row.quote_id);
    if (deadlineErr) {
      console.warn("[sendQuoteAction] failed to set supplier_response_deadline", {
        quote_id: row.quote_id,
        message: deadlineErr.message,
      });
    }
  }

  const { error: inviteFlipErr } = await admin
    .from("rfq_invites")
    .update({ status: "quoted", responded_at: new Date().toISOString() })
    .eq("rfq_id", data.rfq_id)
    .eq("supplier_id", data.supplier_id);
  if (inviteFlipErr) {
    console.warn("[sendQuoteAction] failed to flip rfq_invite to quoted", {
      rfq_id: data.rfq_id,
      supplier_id: data.supplier_id,
      message: inviteFlipErr.message,
    });
  }

  // 11. Notify organizer. kind depends on revision version.
  const kind = row.version === 1 ? "quote.sent" : "quote.revised";
  await createNotification({
    supabase: admin,
    user_id: event.organizer_id,
    kind,
    payload: {
      supplier_id: data.supplier_id,
      rfq_id: data.rfq_id,
      quote_id: row.quote_id,
      revision_id: row.revision_id,
      version: row.version,
      total_halalas: snapshot.total_halalas,
      expires_at: snapshot.expires_at,
    },
  });

  // 12. Revalidate both sides of the sent-quote UX, then redirect the supplier
  //     out of the editor to the RFQ list. They land on a fresh page that
  //     shows their now-`quoted` invite alongside any other open invites,
  //     instead of staying parked on the quote builder. `redirect()` throws
  //     a Next.js control signal — must be the final statement in the
  //     success path.
  revalidatePath(`/supplier/rfqs`);
  revalidatePath(`/supplier/rfqs/${data.invite_id}`);
  revalidatePath(`/supplier/rfqs/${data.invite_id}/quote`);
  revalidatePath(`/organizer/rfqs/${data.rfq_id}/quotes`);

  redirect(`/supplier/rfqs?quoteSent=1`);
}

// ---------------------------------------------------------------------------
// DB loaders (service-role, scoped by ownership in code)
// ---------------------------------------------------------------------------

type AdminClient = SupabaseClient;

async function loadPackage(
  admin: AdminClient,
  supplier_id: string,
  package_id: string,
): Promise<{ data: PricingPackageInput } | { error: string }> {
  const { data, error } = await admin
    .from("packages")
    .select("id, name, base_price_halalas, unit, min_qty, max_qty, supplier_id, is_active")
    .eq("id", package_id)
    .eq("supplier_id", supplier_id)
    .maybeSingle();
  if (error) return { error: `Package lookup failed: ${error.message}` };
  if (!data) return { error: "Package not found for this supplier." };
  const row = data as {
    id: string;
    name: string;
    base_price_halalas: number;
    unit: QuoteUnit;
    min_qty: number;
    max_qty: number | null;
    is_active: boolean;
  };
  if (!row.is_active) {
    return { error: "The selected package is inactive." };
  }
  return {
    data: {
      id: row.id,
      name: row.name,
      base_price_halalas: Number(row.base_price_halalas),
      unit: row.unit,
      min_qty: row.min_qty,
      max_qty: row.max_qty,
    },
  };
}

async function loadActiveRules(
  admin: AdminClient,
  supplier_id: string,
  package_id: string,
): Promise<{ data: PricingRuleInput[] } | { error: string }> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const { data, error } = await admin
    .from("pricing_rules")
    .select("id, rule_type, config_jsonb, priority, version, package_id, is_active, valid_from, valid_to")
    .eq("supplier_id", supplier_id)
    .eq("is_active", true)
    .or(`package_id.is.null,package_id.eq.${package_id}`);
  if (error) return { error: `Rules lookup failed: ${error.message}` };

  const rows = (data ?? []) as Array<{
    id: string;
    rule_type: PricingRuleType;
    config_jsonb: unknown;
    priority: number;
    version: number;
    package_id: string | null;
    valid_from: string | null;
    valid_to: string | null;
  }>;

  const filtered = rows.filter((r) => {
    if (r.valid_from && r.valid_from > today) return false;
    if (r.valid_to && r.valid_to < today) return false;
    return true;
  });

  return {
    data: filtered.map((r) => ({
      id: r.id,
      rule_type: r.rule_type,
      config: r.config_jsonb,
      priority: r.priority,
      version: r.version,
      package_id: r.package_id,
    })),
  };
}

async function loadVenueCoords(
  admin: AdminClient,
  event_id: string,
): Promise<{ lat: number | null; lng: number | null }> {
  // venue_location is geography(point,4326). PostgREST returns it as either
  // GeoJSON or a WKB hex string depending on schema settings — we only parse
  // GeoJSON points; anything else degrades to null and the engine skips the
  // distance_fee rule with reason "no_venue_location".
  const { data: row } = await admin
    .from("events")
    .select("venue_location")
    .eq("id", event_id)
    .maybeSingle();
  const loc = (row as { venue_location: unknown } | null)?.venue_location ?? null;
  return extractLatLng(loc);
}

/**
 * Supabase returns geography columns either as GeoJSON (if the schema has
 * `supabase_functions.is_geojson_enabled = true`) or as a hex WKB string.
 * Handle both; return nulls if we can't parse — the engine tolerates nulls.
 */
function extractLatLng(value: unknown): { lat: number | null; lng: number | null } {
  if (!value) return { lat: null, lng: null };
  if (typeof value === "object" && value !== null) {
    const v = value as { coordinates?: unknown; type?: string };
    if (v.type === "Point" && Array.isArray(v.coordinates) && v.coordinates.length >= 2) {
      const [lng, lat] = v.coordinates as [number, number];
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  }
  return { lat: null, lng: null };
}

async function safeDistanceKm(
  admin: AdminClient,
  params: { supplier_id: string; venue_lat: number | null; venue_lng: number | null },
): Promise<number | null> {
  try {
    return await getDistanceKm({
      admin,
      supplier_id: params.supplier_id,
      venue_lat: params.venue_lat,
      venue_lng: params.venue_lng,
    });
  } catch (err) {
    console.warn("[sendQuoteAction] getDistanceKm failed", err);
    return null;
  }
}

function stripDigest(snapshot: QuoteSnapshot): Omit<QuoteSnapshot, "inputs_digest"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { inputs_digest: _digest, ...rest } = snapshot;
  return rest;
}
