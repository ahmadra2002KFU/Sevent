"use server";

/**
 * Lane 4 · Sprint 2 — supplier calendar server actions.
 *
 * These actions write ONLY rows with `reason='manual_block'`. Soft-hold and
 * booked rows are reserved for the Sprint 4 booking state machine and must
 * never be created/updated/deleted from here. All DB error mapping routes
 * through `friendlyAvailabilityError` so the UI never leaks raw Postgres text.
 */

import { revalidatePath } from "next/cache";
import {
  ManualBlockInput,
  friendlyAvailabilityError,
} from "@/lib/domain/availability";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAccess } from "@/lib/auth/access";
import type { AvailabilityBlockRow } from "@/lib/supabase/types";

const CALENDAR_PATH = "/supplier/calendar";

export type CalendarActionResult = { ok: true } | { ok: false; error: string };

async function resolveSupplierId(): Promise<
  { supplierId: string } | { error: string }
> {
  // Gate mutation on `supplier.calendar` — approved suppliers only. Non-
  // approved states redirect to bestDestination inside requireAccess.
  const { decision } = await requireAccess("supplier.calendar");
  if (!decision.supplierId) {
    return { error: "Supplier row missing for approved state." };
  }
  return { supplierId: decision.supplierId };
}

function parseRawInput(raw: unknown): CalendarActionResult | ManualBlockInput {
  const parsed = ManualBlockInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  return parsed.data;
}

export async function createManualBlockAction(
  input: unknown,
): Promise<CalendarActionResult> {
  const parsed = parseRawInput(input);
  if ("ok" in parsed) return parsed;

  const supabase = await createSupabaseServerClient();
  const resolved = await resolveSupplierId();
  if ("error" in resolved) return { ok: false, error: resolved.error };

  const { error } = await supabase.from("availability_blocks").insert({
    supplier_id: resolved.supplierId,
    starts_at: parsed.starts_at,
    ends_at: parsed.ends_at,
    reason: "manual_block" as const,
    // `notes` is not persisted on availability_blocks in v1 schema; the field
    // is kept in the form UX so suppliers can annotate during the session but
    // is intentionally dropped at write time (no column exists yet).
  });
  if (error) {
    return { ok: false, error: friendlyAvailabilityError(error.message) };
  }
  revalidatePath(CALENDAR_PATH);
  return { ok: true };
}

export async function updateManualBlockAction(
  id: string,
  input: unknown,
): Promise<CalendarActionResult> {
  if (!id || typeof id !== "string") {
    return { ok: false, error: "Missing block id." };
  }
  const parsed = parseRawInput(input);
  if ("ok" in parsed) return parsed;

  const supabase = await createSupabaseServerClient();
  const resolved = await resolveSupplierId();
  if ("error" in resolved) return { ok: false, error: resolved.error };

  // Double-guard: even though RLS restricts to owner-supplier rows, we also
  // scope the filter by `reason='manual_block'` so a crafted id for a
  // soft_hold / booked row cannot be mutated through this action.
  const { data, error } = await supabase
    .from("availability_blocks")
    .update({
      starts_at: parsed.starts_at,
      ends_at: parsed.ends_at,
    })
    .eq("id", id)
    .eq("supplier_id", resolved.supplierId)
    .eq("reason", "manual_block")
    .select("id");
  if (error) {
    return { ok: false, error: friendlyAvailabilityError(error.message) };
  }
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: "Block not found or is not a manual block you can edit.",
    };
  }
  revalidatePath(CALENDAR_PATH);
  return { ok: true };
}

export async function deleteManualBlockAction(
  id: string,
): Promise<CalendarActionResult> {
  if (!id || typeof id !== "string") {
    return { ok: false, error: "Missing block id." };
  }

  const supabase = await createSupabaseServerClient();
  const resolved = await resolveSupplierId();
  if ("error" in resolved) return { ok: false, error: resolved.error };

  const { data, error } = await supabase
    .from("availability_blocks")
    .delete()
    .eq("id", id)
    .eq("supplier_id", resolved.supplierId)
    .eq("reason", "manual_block")
    .select("id");
  if (error) {
    return { ok: false, error: friendlyAvailabilityError(error.message) };
  }
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: "Block not found or is not a manual block you can delete.",
    };
  }
  revalidatePath(CALENDAR_PATH);
  return { ok: true };
}

/**
 * Narrow helper exported so the page can reuse the exact supplier-resolution
 * rule and row typing in server components without duplicating the lookup.
 */
export async function loadCalendarData(rangeStart: Date, rangeEnd: Date): Promise<
  | {
      ok: true;
      supplierId: string;
      blocks: AvailabilityBlockRow[];
      manualBlocks: AvailabilityBlockRow[];
    }
  | { ok: false; error: string }
> {
  const supabase = await createSupabaseServerClient();
  const resolved = await resolveSupplierId();
  if ("error" in resolved) return { ok: false, error: resolved.error };

  // Pull every block that overlaps the visible month window, regardless of
  // reason — the grid shows dots for soft_hold / booked too. The "list below"
  // filters to manual_block in the UI layer.
  const { data: windowBlocks, error: windowError } = await supabase
    .from("availability_blocks")
    .select(
      "id, supplier_id, starts_at, ends_at, reason, booking_id, quote_revision_id, expires_at, released_at, created_by, created_at",
    )
    .eq("supplier_id", resolved.supplierId)
    .lt("starts_at", rangeEnd.toISOString())
    .gt("ends_at", rangeStart.toISOString())
    .order("starts_at", { ascending: true });
  if (windowError) {
    return { ok: false, error: friendlyAvailabilityError(windowError.message) };
  }

  // Manual-block list is intentionally unbounded by the visible month so the
  // supplier can always edit/delete any manual block they own.
  const { data: manualList, error: manualError } = await supabase
    .from("availability_blocks")
    .select(
      "id, supplier_id, starts_at, ends_at, reason, booking_id, quote_revision_id, expires_at, released_at, created_by, created_at",
    )
    .eq("supplier_id", resolved.supplierId)
    .eq("reason", "manual_block")
    .order("starts_at", { ascending: true });
  if (manualError) {
    return { ok: false, error: friendlyAvailabilityError(manualError.message) };
  }

  return {
    ok: true,
    supplierId: resolved.supplierId,
    blocks: (windowBlocks ?? []) as AvailabilityBlockRow[],
    manualBlocks: (manualList ?? []) as AvailabilityBlockRow[],
  };
}
