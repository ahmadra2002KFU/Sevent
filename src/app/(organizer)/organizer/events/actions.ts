"use server";

/**
 * Lane 3 · Sprint 3 — organizer events server actions.
 *
 * Owns the event-creation flow. Parses the RHF-serialized FormData through
 * `EventFormInput` (the single Zod source of truth from `@/lib/domain/events`),
 * converts SAR decimals → halalas via `sarToHalalas`, and inserts a new row
 * keyed by the signed-in organizer's auth id.
 *
 * Role gating is done in two layers:
 *   1. Application guard — we read `profiles.role` and allow
 *      `organizer | agency | admin` only. This gives the caller a clean error
 *      message when the role is wrong.
 *   2. RLS — the DB policies are the second line of defence (admins can always
 *      act as an organizer; everyone else writes their own row).
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { EventFormInput } from "@/lib/domain/events";
import { sarToHalalas } from "@/lib/domain/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = ["organizer", "agency", "admin"] as const;

function zodMessage(err: ZodError): string {
  return err.issues
    .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
    .join("; ");
}

function optionalString(raw: FormDataEntryValue | null): string | undefined {
  if (raw === null) return undefined;
  const v = typeof raw === "string" ? raw.trim() : "";
  return v.length === 0 ? undefined : v;
}

function optionalNumericString(raw: FormDataEntryValue | null): string | undefined {
  if (raw === null) return undefined;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function isoFromLocal(raw: FormDataEntryValue | null): string {
  // datetime-local inputs produce "YYYY-MM-DDTHH:mm" (local time, no offset).
  // We pass it through Date which interprets as local time, then serialize to
  // ISO so the Zod `.datetime()` check passes and the DB stores UTC.
  if (typeof raw !== "string" || raw.trim().length === 0) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toISOString();
}

export async function createEventAction(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    throw new Error("You must be signed in to create an event.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile as { role: string } | null)?.role;
  if (!role || !(ALLOWED_ROLES as readonly string[]).includes(role)) {
    throw new Error("Organizer, agency, or admin role required to create events.");
  }

  const raw = {
    event_type: formData.get("event_type"),
    city: formData.get("city"),
    client_name: optionalString(formData.get("client_name")),
    venue_address:
      typeof formData.get("venue_address") === "string"
        ? (formData.get("venue_address") as string).trim()
        : "",
    starts_at: isoFromLocal(formData.get("starts_at")),
    ends_at: isoFromLocal(formData.get("ends_at")),
    guest_count: optionalNumericString(formData.get("guest_count")),
    budget_min_sar: optionalNumericString(formData.get("budget_min_sar")),
    budget_max_sar: optionalNumericString(formData.get("budget_max_sar")),
    notes: optionalString(formData.get("notes")),
  };

  let parsed;
  try {
    parsed = EventFormInput.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new Error(`Invalid event input: ${zodMessage(err)}`);
    }
    throw err;
  }

  const budgetMinHalalas =
    parsed.budget_min_sar === undefined || parsed.budget_min_sar === ""
      ? null
      : sarToHalalas(parsed.budget_min_sar as string | number);
  const budgetMaxHalalas =
    parsed.budget_max_sar === undefined || parsed.budget_max_sar === ""
      ? null
      : sarToHalalas(parsed.budget_max_sar as string | number);

  const insertRow = {
    organizer_id: user.id,
    client_name: parsed.client_name ?? null,
    event_type: parsed.event_type,
    city: parsed.city,
    venue_address: parsed.venue_address,
    starts_at: parsed.starts_at,
    ends_at: parsed.ends_at,
    guest_count: parsed.guest_count ?? null,
    budget_range_min_halalas: budgetMinHalalas,
    budget_range_max_halalas: budgetMaxHalalas,
    currency: "SAR" as const,
    notes: parsed.notes ?? null,
  };

  const { data, error } = await supabase
    .from("events")
    .insert(insertRow)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create event: ${error?.message ?? "unknown error"}`);
  }

  const newId = (data as { id: string }).id;

  revalidatePath("/organizer/events");
  revalidatePath("/organizer/dashboard");
  redirect(`/organizer/events/${newId}`);
}
