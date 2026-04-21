"use server";

import { revalidatePath } from "next/cache";
import {
  LANGUAGES,
  LOGO_MAX_BYTES,
  OnboardingStep1,
  OnboardingStep2,
  OnboardingStep3,
  PDF_MAX_BYTES,
  slugifyBusinessName,
} from "@/lib/domain/onboarding";
import { MARKET_SEGMENT_SLUGS } from "@/lib/domain/segments";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
  requireRole,
} from "@/lib/supabase/server";
import { supplierScopedPath } from "@/lib/supabase/storage";
import { uniqueSupplierSlug } from "@/lib/onboarding/slug";
import type { SupplierDocType } from "@/lib/supabase/types";

export type OnboardingState = {
  ok: boolean;
  message?: string;
  supplierId?: string;
};

// Bucket ids ------------------------------------------------------------------
// `supplier-logos` + `supplier-docs` are declared in the 20260504000000_storage
// + 20260421010000_supplier_logos_bucket migrations. We keep the string
// literals local so this file doesn't force a STORAGE_BUCKETS refactor across
// every other caller.
const DOCS_BUCKET = "supplier-docs";
const LOGOS_BUCKET = "supplier-logos";

async function loadSupplierContext() {
  // Reads that would hit the `profiles`/`suppliers` RLS policy cycle go
  // through the service-role admin client. Storage uploads run on the
  // user-scoped client so `owner = auth.uid()` is set and bucket policies
  // keep gating correctly.
  const gate = await requireRole("supplier");
  if (gate.status === "unauthenticated") throw new Error("Not authenticated");
  if (gate.status === "forbidden") {
    throw new Error("Only supplier accounts can complete onboarding");
  }
  const { user, admin } = gate;

  const supabase = await createSupabaseServerClient();

  const { data: supplier, error: supplierErr } = await admin
    .from("suppliers")
    .select(
      "id, profile_id, business_name, slug, legal_type, cr_number, national_id, bio, base_city, service_area_cities, languages, capacity, concurrent_event_limit, is_published, verification_status, logo_path, works_with_segments",
    )
    .eq("profile_id", user.id)
    .maybeSingle();
  if (supplierErr) throw new Error(`Supplier lookup failed: ${supplierErr.message}`);

  return { supabase, admin, user, supplier };
}

// =============================================================================
// Step 1 — business info (business_name, legal_type, cr/national id, bio,
// base_city, service_area_cities, languages)
// =============================================================================

export async function submitOnboardingStep1(
  _prev: OnboardingState | undefined,
  formData: FormData,
): Promise<OnboardingState> {
  try {
    const serviceArea = formData
      .getAll("service_area_cities")
      .map((v) => String(v))
      .filter(Boolean);
    const languages = formData
      .getAll("languages")
      .map((v) => String(v))
      .filter((v): v is (typeof LANGUAGES)[number] =>
        (LANGUAGES as readonly string[]).includes(v),
      );

    const parsed = OnboardingStep1.safeParse({
      business_name: formData.get("business_name") ?? "",
      legal_type: formData.get("legal_type") ?? "",
      cr_number: (formData.get("cr_number") as string) || undefined,
      national_id: (formData.get("national_id") as string) || undefined,
      bio: (formData.get("bio") as string) || undefined,
      base_city: formData.get("base_city") ?? "",
      service_area_cities: serviceArea,
      languages: languages.length > 0 ? languages : ["ar"],
    });
    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      };
    }

    const { admin, user, supplier } = await loadSupplierContext();
    const payload = parsed.data;

    if (!supplier) {
      const slug = await uniqueSupplierSlug(admin, payload.business_name);
      const { data: inserted, error } = await admin
        .from("suppliers")
        .insert({
          profile_id: user.id,
          business_name: payload.business_name,
          slug,
          legal_type: payload.legal_type,
          cr_number: payload.cr_number ?? null,
          national_id: payload.national_id ?? null,
          bio: payload.bio ?? null,
          base_city: payload.base_city,
          service_area_cities: payload.service_area_cities,
          languages: payload.languages,
          verification_status: "pending",
          is_published: false,
        })
        .select("id")
        .single();
      if (error) return { ok: false, message: `Could not save business info: ${error.message}` };
      revalidatePath("/supplier/onboarding");
      return { ok: true, supplierId: inserted.id };
    }

    const patch: Record<string, unknown> = {
      business_name: payload.business_name,
      legal_type: payload.legal_type,
      cr_number: payload.cr_number ?? null,
      national_id: payload.national_id ?? null,
      bio: payload.bio ?? null,
      base_city: payload.base_city,
      service_area_cities: payload.service_area_cities,
      languages: payload.languages,
    };
    if (payload.business_name !== supplier.business_name) {
      const priorBase = slugifyBusinessName(supplier.business_name ?? "");
      if (!supplier.slug || supplier.slug.startsWith(priorBase)) {
        patch.slug = await uniqueSupplierSlug(admin, payload.business_name, {
          excludeSupplierId: supplier.id,
        });
      }
    }
    const { error } = await admin.from("suppliers").update(patch).eq("id", supplier.id);
    if (error) return { ok: false, message: `Could not update business info: ${error.message}` };
    revalidatePath("/supplier/onboarding");
    return { ok: true, supplierId: supplier.id };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Unexpected error" };
  }
}

// =============================================================================
// Step 2 — supplier categories + works-with segments
// =============================================================================

export async function submitOnboardingStep2(
  _prev: OnboardingState | undefined,
  formData: FormData,
): Promise<OnboardingState> {
  try {
    const { admin, supplier } = await loadSupplierContext();
    if (!supplier) {
      return { ok: false, message: "Please complete business information first" };
    }

    const subcategoryIds = formData
      .getAll("subcategory_ids")
      .map((v) => String(v))
      .filter(Boolean);
    const segments = formData
      .getAll("works_with_segments")
      .map((v) => String(v))
      .filter((v): v is (typeof MARKET_SEGMENT_SLUGS)[number] =>
        (MARKET_SEGMENT_SLUGS as readonly string[]).includes(v),
      );

    const parsed = OnboardingStep2.safeParse({
      subcategory_ids: subcategoryIds,
      works_with_segments: segments,
    });
    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      };
    }

    const payload = parsed.data;

    const { error: updateErr } = await admin
      .from("suppliers")
      .update({ works_with_segments: payload.works_with_segments })
      .eq("id", supplier.id);
    if (updateErr) {
      return {
        ok: false,
        message: `Saving market segments failed: ${updateErr.message}`,
      };
    }

    const { error: deleteErr } = await admin
      .from("supplier_categories")
      .delete()
      .eq("supplier_id", supplier.id);
    if (deleteErr) {
      return { ok: false, message: `Could not reset subcategory links: ${deleteErr.message}` };
    }

    const links = payload.subcategory_ids.map((id) => ({
      supplier_id: supplier.id,
      subcategory_id: id,
    }));
    const { error: linkErr } = await admin.from("supplier_categories").insert(links);
    if (linkErr) return { ok: false, message: `Saving subcategories failed: ${linkErr.message}` };

    revalidatePath("/supplier/onboarding");
    return { ok: true, supplierId: supplier.id };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Unexpected error" };
  }
}

// =============================================================================
// Step 3 — documents + profile assets (logo, IBAN, company profile)
// =============================================================================

function extensionFor(file: File | Blob): string {
  const name = (file as File).name ?? "";
  const fromName = name.includes(".") ? name.split(".").pop() ?? "" : "";
  if (fromName) return fromName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const type = file.type || "";
  if (type === "image/png") return "png";
  if (type === "image/jpeg") return "jpg";
  if (type === "image/webp") return "webp";
  if (type === "application/pdf") return "pdf";
  return "bin";
}

/**
 * Server action backing Step 3. Validates sizes, uploads each file, inserts
 * supplier_docs rows for IBAN / company_profile, and patches
 * suppliers.logo_path. On any failure AFTER an upload, we roll back the blobs
 * we created so we don't leak orphans in the bucket.
 */
export async function submitOnboardingStep3(
  _prev: OnboardingState | undefined,
  formData: FormData,
): Promise<OnboardingState> {
  const uploaded: Array<{ bucket: string; path: string }> = [];

  try {
    const { supabase, admin, supplier } = await loadSupplierContext();
    if (!supplier) {
      return { ok: false, message: "Please complete business information first" };
    }

    const logoRaw = formData.get("logo_file");
    const ibanRaw = formData.get("iban_file");
    const profileRaw = formData.get("company_profile_file");

    const logoFile =
      logoRaw instanceof Blob && logoRaw.size > 0 ? (logoRaw as File) : undefined;
    const ibanFile =
      ibanRaw instanceof Blob && ibanRaw.size > 0 ? (ibanRaw as File) : undefined;
    const profileFile =
      profileRaw instanceof Blob && profileRaw.size > 0 ? (profileRaw as File) : undefined;

    const parsed = OnboardingStep3.safeParse({
      logo_file: logoFile,
      iban_file: ibanFile,
      company_profile_file: profileFile,
    });
    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      };
    }

    // Zod guarantees iban_file is present by shape, but TS narrowing doesn't
    // cross the safeParse boundary — re-assert from the parsed payload.
    const iban = parsed.data.iban_file as File;

    // Size + MIME validation (beyond Zod's "is a File" check). Mirrors the
    // client-side size guards so users can't bypass them via curl.
    if (logoFile) {
      if (logoFile.size > LOGO_MAX_BYTES) {
        return { ok: false, message: "Logo must be 1 MB or smaller" };
      }
      if (!/^image\//.test(logoFile.type || "")) {
        return { ok: false, message: "Logo must be an image file" };
      }
    }
    if (iban.size > PDF_MAX_BYTES) {
      return { ok: false, message: "IBAN certificate must be 10 MB or smaller" };
    }
    if (iban.type && iban.type !== "application/pdf") {
      return { ok: false, message: "IBAN certificate must be a PDF" };
    }
    if (profileFile) {
      if (profileFile.size > PDF_MAX_BYTES) {
        return { ok: false, message: "Company profile must be 10 MB or smaller" };
      }
      if (profileFile.type && profileFile.type !== "application/pdf") {
        return { ok: false, message: "Company profile must be a PDF" };
      }
    }

    // ---- 1. Logo upload ----------------------------------------------------
    let logoPath: string | null = supplier.logo_path ?? null;
    if (logoFile) {
      const ext = extensionFor(logoFile);
      // Logo path convention is `{supplier_id}/logo.{ext}` — single file per
      // supplier, overwrite on re-upload via `upsert: true`. Bucket policy
      // still gates on the `{supplier_id}/…` prefix (storage_path_owner_profile).
      const path = `${supplier.id}/logo.${ext}`;
      const buffer = Buffer.from(await logoFile.arrayBuffer());
      // Upload via service-role admin client: requireRole("supplier") already
      // authenticated the caller, and the `@supabase/ssr` + new-key JWT does
      // not propagate auth.uid() to storage RLS (same desync documented for
      // table writes elsewhere). Admin bypasses RLS safely because the path
      // is locked to `{supplier.id}/…` where supplier.id came from the
      // authenticated server-side lookup, not the client.
      const { error: upErr } = await admin.storage
        .from(LOGOS_BUCKET)
        .upload(path, buffer, {
          contentType: logoFile.type || "application/octet-stream",
          upsert: true,
        });
      if (upErr) return { ok: false, message: `Logo upload failed: ${upErr.message}` };
      uploaded.push({ bucket: LOGOS_BUCKET, path });
      logoPath = path;
    }

    // ---- 2. IBAN certificate upload ----------------------------------------
    const ibanDocPath = supplierScopedPath(
      supplier.id,
      "docs",
      `iban-certificate-${crypto.randomUUID()}.pdf`,
    );
    const ibanBuffer = Buffer.from(await iban.arrayBuffer());
    const { error: ibanErr } = await admin.storage
      .from(DOCS_BUCKET)
      .upload(ibanDocPath, ibanBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (ibanErr) {
      await rollback(admin, uploaded);
      return { ok: false, message: `IBAN upload failed: ${ibanErr.message}` };
    }
    uploaded.push({ bucket: DOCS_BUCKET, path: ibanDocPath });

    // ---- 3. Company profile upload (optional) ------------------------------
    let companyProfilePath: string | null = null;
    if (profileFile) {
      companyProfilePath = supplierScopedPath(
        supplier.id,
        "docs",
        `company-profile-${crypto.randomUUID()}.pdf`,
      );
      const buffer = Buffer.from(await profileFile.arrayBuffer());
      const { error: cpErr } = await admin.storage
        .from(DOCS_BUCKET)
        .upload(companyProfilePath, buffer, {
          contentType: "application/pdf",
          upsert: false,
        });
      if (cpErr) {
        await rollback(admin, uploaded);
        return { ok: false, message: `Company profile upload failed: ${cpErr.message}` };
      }
      uploaded.push({ bucket: DOCS_BUCKET, path: companyProfilePath });
    }

    // ---- 4. DB writes ------------------------------------------------------
    const docRows: Array<{
      supplier_id: string;
      doc_type: SupplierDocType;
      file_path: string;
      notes: string | null;
    }> = [
      {
        supplier_id: supplier.id,
        doc_type: "iban_certificate",
        file_path: ibanDocPath,
        notes: null,
      },
    ];
    if (companyProfilePath) {
      docRows.push({
        supplier_id: supplier.id,
        doc_type: "company_profile",
        file_path: companyProfilePath,
        notes: null,
      });
    }

    const { error: insertErr } = await admin.from("supplier_docs").insert(docRows);
    if (insertErr) {
      await rollback(admin, uploaded);
      return {
        ok: false,
        message: `Saving document records failed: ${insertErr.message}`,
      };
    }

    if (logoPath && logoPath !== supplier.logo_path) {
      const { error: updateErr } = await admin
        .from("suppliers")
        .update({ logo_path: logoPath })
        .eq("id", supplier.id);
      if (updateErr) {
        // DB rows for docs are idempotently inserted per-submission; we don't
        // try to delete them here because the user may want to retry. We only
        // roll back blobs we just uploaded in this call.
        await rollback(admin, uploaded);
        return {
          ok: false,
          message: `Saving logo reference failed: ${updateErr.message}`,
        };
      }
    }

    revalidatePath("/supplier/onboarding");
    revalidatePath("/supplier/dashboard");
    return { ok: true, supplierId: supplier.id };
  } catch (err) {
    // Best-effort rollback — we're already on the error path, don't let a
    // failed cleanup mask the original error. Uses service-role so it can
    // delete under the same RLS exemption the uploads relied on.
    try {
      if (uploaded.length > 0) {
        const admin = createSupabaseServiceRoleClient();
        await rollback(admin, uploaded);
      }
    } catch {
      /* swallow */
    }
    return { ok: false, message: err instanceof Error ? err.message : "Unexpected error" };
  }
}

async function rollback(
  client: ReturnType<typeof createSupabaseServiceRoleClient>,
  uploaded: Array<{ bucket: string; path: string }>,
): Promise<void> {
  const grouped = new Map<string, string[]>();
  for (const { bucket, path } of uploaded) {
    const list = grouped.get(bucket) ?? [];
    list.push(path);
    grouped.set(bucket, list);
  }
  for (const [bucket, paths] of grouped.entries()) {
    await client.storage.from(bucket).remove(paths);
  }
}

