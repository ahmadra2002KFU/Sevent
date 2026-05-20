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
import { z, ZodError } from "zod";
import { BandInput, EventFormInput } from "@/lib/domain/events";
import { sarToHalalas } from "@/lib/domain/money";
import { requireAccess } from "@/lib/auth/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { STORAGE_BUCKETS, rfqAttachmentPath } from "@/lib/supabase/storage";
import {
  type AttachmentKind,
  ATTACHMENT_MAX_PER_BAND,
  ATTACHMENT_MAX_TOTAL_BYTES_PER_SUBMIT,
  kindForMime,
  maxBytesForKind,
} from "@/lib/domain/attachments";

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

function parseBunoodField(raw: FormDataEntryValue | null): unknown {
  // The form serializes the بنود array as a JSON string into a single hidden
  // input (FormData can't carry nested arrays of objects). Empty/missing →
  // empty array; the schema's `.min(1)` will reject it with a localized error.
  if (typeof raw !== "string" || raw.trim().length === 0) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Auto-publish RFQs for a list of بنود tied to one event. Used by both the
 * combined event-creation flow and the standalone "اضافة بند" action on the
 * event detail page. RLS (`rfqs: organizer all`) gates the insert: the caller
 * must own the event_id. Each بند becomes a `requirements_jsonb={kind:"generic"}`
 * RFQ with `status='sent'` and `is_published_to_marketplace=true` (DB default),
 * so suppliers in that subcategory see it immediately on the marketplace.
 *
 * Returns the IDs of the inserted RFQs in the same order as `bunood`.
 */
async function publishBunoodForEvent(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  eventId: string,
  bunood: BandInput[],
): Promise<string[]> {
  const subcatIds = bunood.map((b) => b.subcategory_id);
  const { data: catRows, error: catErr } = await supabase
    .from("categories")
    .select("id, parent_id")
    .in("id", subcatIds);
  if (catErr) {
    throw new Error(`Failed to resolve بنود categories: ${catErr.message}`);
  }
  const parentByChild = new Map<string, string | null>(
    ((catRows ?? []) as Array<{ id: string; parent_id: string | null }>).map(
      (r) => [r.id, r.parent_id],
    ),
  );
  for (const id of subcatIds) {
    const parent = parentByChild.get(id);
    if (parent === undefined) {
      throw new Error(`Unknown subcategory: ${id}`);
    }
    if (parent === null) {
      // Defensive: we only accept leaf subcategories. The UI filters parents
      // out of the dropdown, but a forged client could still submit one.
      throw new Error(`Top-level category cannot be used as a بند: ${id}`);
    }
  }

  const sentAt = new Date().toISOString();
  const rfqRows = bunood.map((b) => ({
    event_id: eventId,
    category_id: parentByChild.get(b.subcategory_id) as string,
    subcategory_id: b.subcategory_id,
    status: "sent" as const,
    sent_at: sentAt,
    requirements_jsonb: {
      kind: "generic",
      notes: b.notes ?? "",
      qty: b.qty ?? 1,
    },
  }));

  const { data: inserted, error: rfqErr } = await supabase
    .from("rfqs")
    .insert(rfqRows)
    .select("id");
  if (rfqErr) {
    throw new Error(`Failed to publish بنود: ${rfqErr.message}`);
  }
  return ((inserted ?? []) as Array<{ id: string }>).map((r) => r.id);
}

/**
 * Best-effort upload of per-بند attachments AFTER their RFQs are committed.
 *
 * `rfq_id` is the storage-path key and does not exist until `publishBunoodForEvent`
 * inserts the RFQ rows, so this runs last. It is intentionally best-effort: a failed
 * upload must never block the post-create redirect or roll back the already-committed
 * event/RFQs. Attachments are supplementary enrichment (like the best-effort
 * notification sends elsewhere); the load-bearing بند data (notes/qty) is already in
 * `requirements_jsonb`. Every file is re-validated server-side (type/size/per-بند
 * count/total budget) regardless of client checks, uploaded via the service-role
 * client (there is no authenticated INSERT policy on `rfq_attachments`), and on a
 * row-insert failure the just-uploaded blobs are best-effort removed so the bucket
 * does not accumulate orphans.
 *
 * @param admin       service-role client (bypasses RLS)
 * @param uploaderId  profiles.id of the organizer
 * @param eventId     parent event id (storage path prefix)
 * @param rfqIds      inserted RFQ ids, index-aligned with `fileGroups`
 * @param fileGroups  fileGroups[i] = files attached to بند i
 */
async function uploadBandAttachments(
  admin: Awaited<ReturnType<typeof requireAccess>>["admin"],
  uploaderId: string,
  eventId: string,
  rfqIds: string[],
  fileGroups: File[][],
): Promise<void> {
  type AttachmentInsertRow = {
    rfq_id: string;
    event_id: string;
    uploaded_by: string;
    kind: AttachmentKind;
    file_path: string;
    file_name: string;
    content_type: string;
    size_bytes: number;
  };

  const rows: AttachmentInsertRow[] = [];
  const uploadedPaths: string[] = [];
  let totalBytes = 0;

  for (let i = 0; i < fileGroups.length; i++) {
    const rfqId = rfqIds[i];
    if (!rfqId) continue; // defensive: index must map to a created RFQ
    let countForBand = 0;

    for (const file of fileGroups[i]) {
      try {
        const kind = kindForMime(file.type);
        if (kind === null) {
          console.warn("[uploadBandAttachments] skipped disallowed type", {
            event_id: eventId,
            rfq_id: rfqId,
            file_name: file.name,
            content_type: file.type,
          });
          continue;
        }
        if (file.size > maxBytesForKind(kind)) {
          console.warn("[uploadBandAttachments] skipped oversize file", {
            rfq_id: rfqId,
            file_name: file.name,
            size_bytes: file.size,
          });
          continue;
        }
        if (countForBand >= ATTACHMENT_MAX_PER_BAND) {
          console.warn("[uploadBandAttachments] skipped — per-بند count exceeded", {
            rfq_id: rfqId,
            file_name: file.name,
          });
          continue;
        }
        if (totalBytes + file.size > ATTACHMENT_MAX_TOTAL_BYTES_PER_SUBMIT) {
          console.warn("[uploadBandAttachments] skipped — total size budget exceeded", {
            rfq_id: rfqId,
            file_name: file.name,
          });
          continue;
        }

        const path = rfqAttachmentPath(eventId, rfqId, file.name);
        const buf = Buffer.from(await file.arrayBuffer());
        const { error: upErr } = await admin.storage
          .from(STORAGE_BUCKETS.rfqAttachments)
          .upload(path, buf, { contentType: file.type, upsert: false });
        if (upErr) {
          console.warn("[uploadBandAttachments] storage upload failed", {
            rfq_id: rfqId,
            file_name: file.name,
            message: upErr.message,
          });
          continue;
        }

        uploadedPaths.push(path);
        countForBand += 1;
        totalBytes += file.size;
        rows.push({
          rfq_id: rfqId,
          event_id: eventId,
          uploaded_by: uploaderId,
          kind,
          file_path: path,
          file_name: file.name,
          content_type: file.type,
          size_bytes: file.size,
        });
      } catch (err) {
        console.warn("[uploadBandAttachments] unexpected error; skipping file", {
          rfq_id: rfqId,
          file_name: file.name,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  if (rows.length === 0) return;

  const { error: insErr } = await admin.from("rfq_attachments").insert(rows);
  if (insErr) {
    console.warn("[uploadBandAttachments] row insert failed; removing orphans", {
      event_id: eventId,
      count: rows.length,
      message: insErr.message,
    });
    // Best-effort cleanup so the bucket doesn't accumulate unreferenced blobs.
    if (uploadedPaths.length > 0) {
      await admin.storage
        .from(STORAGE_BUCKETS.rfqAttachments)
        .remove(uploadedPaths);
    }
  }
}

/**
 * Read a single بند's uploaded files out of the action FormData. The client
 * appends them keyed by بند index (`band_attachment_${i}`), so this mirrors the
 * exact serialization in event-form.tsx / AddBandDialog.tsx.
 */
function bandFilesAt(formData: FormData, index: number): File[] {
  return formData
    .getAll(`band_attachment_${index}`)
    .filter((v): v is File => v instanceof File && v.size > 0);
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
  const { user, admin } = await requireAccess("organizer.events");
  const supabase = await createSupabaseServerClient();

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
    bunood: parseBunoodField(formData.get("bunood")),
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
    venue_address: parsed.venue_address ? parsed.venue_address : null,
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

  // Auto-publish each بند as an RFQ tied to the new event. The schema enforces
  // .min(1), so `parsed.bunood` is non-empty here. RLS allows organizer inserts
  // because they own `events.id = newId` (they just inserted it). The returned
  // ids are in the same order as `parsed.bunood`, which is also the order the
  // client keyed `band_attachment_${i}` files in the FormData.
  const rfqIds = await publishBunoodForEvent(supabase, newId, parsed.bunood);

  // Best-effort: attach each بند's uploaded files to its RFQ. Never blocks the
  // redirect — see uploadBandAttachments.
  const fileGroups = parsed.bunood.map((_, i) => bandFilesAt(formData, i));
  if (fileGroups.some((g) => g.length > 0)) {
    try {
      await uploadBandAttachments(admin, user.id, newId, rfqIds, fileGroups);
    } catch (err) {
      console.warn("[createEventAction] attachment upload failed", err);
    }
  }

  revalidatePath("/organizer/events");
  revalidatePath("/organizer/dashboard");
  redirect(`/organizer/events/${newId}`);
}

// ---------------------------------------------------------------------------
// addBandAction — append one بند to an existing event from the detail page.
// ---------------------------------------------------------------------------

const AddBandFormInput = BandInput.extend({
  event_id: z.string().uuid(),
});

export type AddBandResult =
  | { ok: true; rfq_id: string }
  | { ok: false; error: string };

export async function addBandAction(formData: FormData): Promise<AddBandResult> {
  // FormData-based (was a plain object) so the dialog can attach files alongside
  // the بند fields. Scalars are read the same way createEventAction reads them.
  const candidate = {
    event_id: optionalString(formData.get("event_id")),
    subcategory_id: optionalString(formData.get("subcategory_id")),
    notes: optionalString(formData.get("notes")),
    qty: optionalNumericString(formData.get("qty")),
  };
  const parsed = AddBandFormInput.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, error: zodMessage(parsed.error) };
  }

  const { user, admin } = await requireAccess("organizer.events");
  const supabase = await createSupabaseServerClient();

  // Verify ownership before insert. RLS on `events` already scopes select to
  // owner + admin, so a non-owner gets `null` here regardless of role.
  const { data: ownership } = await supabase
    .from("events")
    .select("id, organizer_id")
    .eq("id", parsed.data.event_id)
    .maybeSingle();
  const ownerRow = ownership as { id: string; organizer_id: string } | null;
  if (!ownerRow) {
    return { ok: false, error: "Event not found." };
  }
  if (ownerRow.organizer_id !== user.id) {
    // Admins can read events they don't own, but RFQs they create wouldn't
    // belong to them. Block to keep the data model consistent.
    return { ok: false, error: "You do not own this event." };
  }

  let rfqIds: string[];
  try {
    rfqIds = await publishBunoodForEvent(supabase, parsed.data.event_id, [
      {
        subcategory_id: parsed.data.subcategory_id,
        notes: parsed.data.notes,
        qty: parsed.data.qty,
      },
    ]);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to add بند.",
    };
  }

  // Best-effort: attach this بند's uploaded files (keyed at index 0) to its RFQ.
  const files = bandFilesAt(formData, 0);
  if (files.length > 0) {
    try {
      await uploadBandAttachments(admin, user.id, parsed.data.event_id, rfqIds, [
        files,
      ]);
    } catch (err) {
      console.warn("[addBandAction] attachment upload failed", err);
    }
  }

  revalidatePath(`/organizer/events/${parsed.data.event_id}`);
  revalidatePath("/organizer/dashboard");
  revalidatePath("/organizer/rfqs");

  return { ok: true, rfq_id: rfqIds[0] };
}
