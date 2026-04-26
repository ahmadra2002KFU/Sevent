"use server";

import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth/access";
import {
  STORAGE_BUCKETS,
  assertPathBelongsToSupplier,
  supplierScopedPath,
} from "@/lib/supabase/storage";

export type PortfolioActionResult = { ok: true } | { ok: false; message: string };

const PORTFOLIO_PATH = "/supplier/profile";
const SUPPLIER_PROFILE_SLUG_REVALIDATE_PREFIX = "/s/";

const IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const PDF_MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const TITLE_MAX_LEN = 120;
const MAX_PER_BATCH = 10;
const MAX_PER_SUPPLIER = 50;

const ALLOWED_IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);
const PDF_MIME = "application/pdf";

type PortfolioKind = "photo" | "document";

function mimeToKind(mime: string): PortfolioKind | null {
  if (ALLOWED_IMAGE_MIMES.has(mime)) return "photo";
  if (mime === PDF_MIME) return "document";
  return null;
}

function extForMime(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "application/pdf":
      return "pdf";
    default:
      return "bin";
  }
}

function sizeCapForMime(mime: string): number {
  return mime === PDF_MIME ? PDF_MAX_BYTES : IMAGE_MAX_BYTES;
}

type LoadOk = {
  ok: true;
  admin: Awaited<ReturnType<typeof requireAccess>>["admin"];
  supplierId: string;
  slug: string | null;
};
type LoadErr = { ok: false; error: string };

async function loadPortfolioContext(): Promise<LoadOk | LoadErr> {
  const { decision, admin } = await requireAccess("supplier.profile.customize");
  const supplierId = decision.supplierId;
  if (!supplierId) {
    return { ok: false, error: "Supplier profile not found" };
  }

  // Fetch slug so we can revalidate the public profile page.
  const { data: supplierRow } = await admin
    .from("suppliers")
    .select("slug")
    .eq("id", supplierId)
    .maybeSingle();
  const slug = (supplierRow as { slug: string } | null)?.slug ?? null;

  return { ok: true, admin, supplierId, slug };
}

function revalidateSurfaces(slug: string | null): void {
  revalidatePath(PORTFOLIO_PATH);
  if (slug) revalidatePath(`${SUPPLIER_PROFILE_SLUG_REVALIDATE_PREFIX}${slug}`);
}

async function rollback(
  admin: Awaited<ReturnType<typeof requireAccess>>["admin"],
  uploaded: Array<{ bucket: string; path: string }>,
): Promise<void> {
  const grouped = new Map<string, string[]>();
  for (const { bucket, path } of uploaded) {
    const list = grouped.get(bucket) ?? [];
    list.push(path);
    grouped.set(bucket, list);
  }
  for (const [bucket, paths] of grouped.entries()) {
    await admin.storage.from(bucket).remove(paths);
  }
}

export async function uploadPortfolioItems(
  formData: FormData,
): Promise<PortfolioActionResult> {
  const ctx = await loadPortfolioContext();
  if (!ctx.ok) return { ok: false, message: ctx.error };
  const { admin, supplierId, slug } = ctx;

  const rawFiles = formData.getAll("files");
  const files: File[] = [];
  for (const entry of rawFiles) {
    if (entry instanceof File && entry.size > 0) files.push(entry);
  }
  if (files.length === 0) {
    return { ok: false, message: "Pick at least one file" };
  }
  if (files.length > MAX_PER_BATCH) {
    return { ok: false, message: `Upload at most ${MAX_PER_BATCH} files at once` };
  }

  // Per-file mime + size checks. Reject the whole batch if any file is bad —
  // saves a partial upload and a confusing rollback message.
  for (const f of files) {
    const kind = mimeToKind(f.type);
    if (!kind) {
      return {
        ok: false,
        message: `Unsupported file type: ${f.name} (${f.type || "unknown"})`,
      };
    }
    if (f.size > sizeCapForMime(f.type)) {
      const capMb = Math.floor(sizeCapForMime(f.type) / (1024 * 1024));
      return { ok: false, message: `${f.name} exceeds the ${capMb} MB limit` };
    }
  }

  // Total cap. Race-tolerant: another tab uploading concurrently could push
  // us over the cap by N where N = batch size of the racing tab. Acceptable
  // for a soft quota; tighten with a transactional check later if needed.
  const { count: existingCount, error: countErr } = await admin
    .from("supplier_media")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", supplierId);
  if (countErr) {
    return { ok: false, message: `Failed to read portfolio: ${countErr.message}` };
  }
  if ((existingCount ?? 0) + files.length > MAX_PER_SUPPLIER) {
    return {
      ok: false,
      message: `Portfolio is capped at ${MAX_PER_SUPPLIER} items`,
    };
  }

  // Read max(sort_order) so new rows append at the end.
  const { data: maxRow } = await admin
    .from("supplier_media")
    .select("sort_order")
    .eq("supplier_id", supplierId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const startSortOrder =
    Number((maxRow as { sort_order: number } | null)?.sort_order ?? 0) + 1;

  const uploaded: Array<{ bucket: string; path: string }> = [];
  const rowsToInsert: Array<{
    supplier_id: string;
    kind: PortfolioKind;
    file_path: string;
    title: string | null;
    sort_order: number;
  }> = [];

  try {
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const kind = mimeToKind(f.type)!;
      const ext = extForMime(f.type);
      const path = supplierScopedPath(
        supplierId,
        "portfolio",
        `${crypto.randomUUID()}.${ext}`,
      );
      const buffer = Buffer.from(await f.arrayBuffer());
      const { error: upErr } = await admin.storage
        .from(STORAGE_BUCKETS.portfolio)
        .upload(path, buffer, { contentType: f.type, upsert: false });
      if (upErr) {
        await rollback(admin, uploaded);
        return { ok: false, message: `Upload failed: ${upErr.message}` };
      }
      uploaded.push({ bucket: STORAGE_BUCKETS.portfolio, path });

      const titleRaw = formData.get(`title_${i}`);
      const title =
        typeof titleRaw === "string" && titleRaw.trim().length > 0
          ? titleRaw.trim().slice(0, TITLE_MAX_LEN)
          : null;

      rowsToInsert.push({
        supplier_id: supplierId,
        kind,
        file_path: path,
        title,
        sort_order: startSortOrder + i,
      });
    }

    const { error: insErr } = await admin
      .from("supplier_media")
      .insert(rowsToInsert);
    if (insErr) {
      await rollback(admin, uploaded);
      return { ok: false, message: `Save failed: ${insErr.message}` };
    }
  } catch (err) {
    await rollback(admin, uploaded);
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Unexpected error",
    };
  }

  revalidateSurfaces(slug);
  return { ok: true };
}

export async function updatePortfolioTitle(
  id: string,
  title: string | null,
): Promise<PortfolioActionResult> {
  const ctx = await loadPortfolioContext();
  if (!ctx.ok) return { ok: false, message: ctx.error };
  const { admin, supplierId, slug } = ctx;

  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, message: "Missing item id" };
  }

  const trimmed =
    typeof title === "string" && title.trim().length > 0
      ? title.trim().slice(0, TITLE_MAX_LEN)
      : null;

  const { error, count } = await admin
    .from("supplier_media")
    .update({ title: trimmed }, { count: "exact" })
    .eq("id", id)
    .eq("supplier_id", supplierId);
  if (error) return { ok: false, message: error.message };
  if ((count ?? 0) === 0) return { ok: false, message: "Item not found" };

  revalidateSurfaces(slug);
  return { ok: true };
}

export async function reorderPortfolio(
  ids: string[],
): Promise<PortfolioActionResult> {
  const ctx = await loadPortfolioContext();
  if (!ctx.ok) return { ok: false, message: ctx.error };
  const { admin, supplierId, slug } = ctx;

  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
    return { ok: false, message: "Invalid order payload" };
  }

  // Validate the submitted set matches the supplier's current rows exactly —
  // prevents a malicious caller from sneaking another supplier's id into the
  // list and getting its sort_order rewritten under our supplier scope.
  const { data: existing, error: selErr } = await admin
    .from("supplier_media")
    .select("id")
    .eq("supplier_id", supplierId);
  if (selErr) return { ok: false, message: selErr.message };
  const existingSet = new Set((existing as Array<{ id: string }>).map((r) => r.id));
  if (existingSet.size !== ids.length) {
    return { ok: false, message: "Order list does not match current items" };
  }
  for (const id of ids) {
    if (!existingSet.has(id)) {
      return { ok: false, message: "Unknown item in order list" };
    }
  }

  // Two-phase update: shift everything to negative sort_orders first to dodge
  // a unique-constraint clash if one ever gets added; then write the final
  // positive values. Today there's no UNIQUE on (supplier_id, sort_order) so
  // this is purely defensive but cheap.
  for (let i = 0; i < ids.length; i++) {
    const { error: stepErr } = await admin
      .from("supplier_media")
      .update({ sort_order: -(i + 1) })
      .eq("id", ids[i])
      .eq("supplier_id", supplierId);
    if (stepErr) return { ok: false, message: stepErr.message };
  }
  for (let i = 0; i < ids.length; i++) {
    const { error: stepErr } = await admin
      .from("supplier_media")
      .update({ sort_order: i + 1 })
      .eq("id", ids[i])
      .eq("supplier_id", supplierId);
    if (stepErr) return { ok: false, message: stepErr.message };
  }

  revalidateSurfaces(slug);
  return { ok: true };
}

export async function deletePortfolioItem(
  id: string,
): Promise<PortfolioActionResult> {
  const ctx = await loadPortfolioContext();
  if (!ctx.ok) return { ok: false, message: ctx.error };
  const { admin, supplierId, slug } = ctx;

  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, message: "Missing item id" };
  }

  const { data: row, error: selErr } = await admin
    .from("supplier_media")
    .select("file_path")
    .eq("id", id)
    .eq("supplier_id", supplierId)
    .maybeSingle();
  if (selErr) return { ok: false, message: selErr.message };
  if (!row) return { ok: false, message: "Item not found" };

  const filePath = (row as { file_path: string }).file_path;
  try {
    assertPathBelongsToSupplier(filePath, supplierId);
  } catch {
    return { ok: false, message: "File ownership mismatch" };
  }

  // Storage first, then row. If storage delete fails we leave the row so the
  // user can retry; deleting the row first would orphan the blob in the
  // bucket with no UI handle to remove it.
  const { error: rmErr } = await admin.storage
    .from(STORAGE_BUCKETS.portfolio)
    .remove([filePath]);
  if (rmErr) return { ok: false, message: `Delete failed: ${rmErr.message}` };

  const { error: delErr } = await admin
    .from("supplier_media")
    .delete()
    .eq("id", id)
    .eq("supplier_id", supplierId);
  if (delErr) return { ok: false, message: delErr.message };

  revalidateSurfaces(slug);
  return { ok: true };
}
