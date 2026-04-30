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
} from "@/lib/supabase/server";
import { requireAccess } from "@/lib/auth/access";
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
  const { user, admin } = await requireAccess("supplier.onboarding.wizard");

  const supabase = await createSupabaseServerClient();

  const { data: supplier, error: supplierErr } = await admin
    .from("suppliers")
    .select(
      "id, profile_id, business_name, slug, legal_type, cr_number, national_id, bio, base_city, service_area_cities, serves_all_ksa, languages, capacity, concurrent_event_limit, is_published, verification_status, logo_path, works_with_segments",
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

    const servesAllKsa = formData.get("serves_all_ksa") === "true";

    const parsed = OnboardingStep1.safeParse({
      representative_name: formData.get("representative_name") ?? "",
      business_name: formData.get("business_name") ?? "",
      legal_type: formData.get("legal_type") ?? "",
      cr_number: (formData.get("cr_number") as string) || undefined,
      national_id: (formData.get("national_id") as string) || undefined,
      bio: (formData.get("bio") as string) || undefined,
      base_city: formData.get("base_city") ?? "",
      serves_all_ksa: servesAllKsa,
      // Picker's selections are ignored when the all-KSA flag is on — the Zod
      // refinement would otherwise flag "cities must be empty" and reject the
      // whole submit.
      service_area_cities: servesAllKsa ? [] : serviceArea,
      languages: languages.length > 0 ? languages : ["ar"],
      website_url: (formData.get("website_url") as string)?.trim() || "",
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

    // Persist the representative's full name on the profile row. This mirrors
    // the decision (see plan decision #3) to split "business_name" from the
    // human's own name. Best-effort — failure here shouldn't block supplier
    // step 1 from saving, but we still surface the error message.
    const { error: profileErr } = await admin
      .from("profiles")
      .update({ full_name: payload.representative_name })
      .eq("id", user.id);
    if (profileErr) {
      return {
        ok: false,
        message: `Could not save representative name: ${profileErr.message}`,
      };
    }

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
          serves_all_ksa: payload.serves_all_ksa,
          service_area_cities: payload.service_area_cities,
          languages: payload.languages,
          website_url: payload.website_url ?? null,
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
      serves_all_ksa: payload.serves_all_ksa,
      service_area_cities: payload.service_area_cities,
      languages: payload.languages,
      website_url: payload.website_url ?? null,
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

    const { error: rpcErr } = await admin.rpc("replace_supplier_categories", {
      p_supplier_id: supplier.id,
      p_subcategory_ids: payload.subcategory_ids,
    });
    if (rpcErr) {
      return { ok: false, message: `Saving subcategories failed: ${rpcErr.message}` };
    }

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
    const crRaw = formData.get("cr_file");
    const nationalAddressRaw = formData.get("national_address_file");
    const vatRaw = formData.get("vat_file");

    const logoFile =
      logoRaw instanceof Blob && logoRaw.size > 0 ? (logoRaw as File) : undefined;
    const ibanFile =
      ibanRaw instanceof Blob && ibanRaw.size > 0 ? (ibanRaw as File) : undefined;
    const profileFile =
      profileRaw instanceof Blob && profileRaw.size > 0 ? (profileRaw as File) : undefined;
    const crFile =
      crRaw instanceof Blob && crRaw.size > 0 ? (crRaw as File) : undefined;
    const nationalAddressFile =
      nationalAddressRaw instanceof Blob && nationalAddressRaw.size > 0
        ? (nationalAddressRaw as File)
        : undefined;
    const vatFile =
      vatRaw instanceof Blob && vatRaw.size > 0 ? (vatRaw as File) : undefined;

    const parsed = OnboardingStep3.safeParse({
      logo_file: logoFile,
      iban_file: ibanFile,
      company_profile_file: profileFile,
      legal_type: supplier.legal_type,
      cr_file: crFile,
      national_address_file: nationalAddressFile,
      vat_file: vatFile,
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

    // Company-only docs (enforced for legal_type='company' by Zod above).
    // These are undefined for freelancers/foreign and we skip the checks.
    const checkCompanyPdf = (
      file: File | undefined,
      label: string,
    ): string | null => {
      if (!file) return null;
      if (file.size > PDF_MAX_BYTES) return `${label} must be 10 MB or smaller`;
      if (file.type && file.type !== "application/pdf")
        return `${label} must be a PDF`;
      return null;
    };
    const crErr = checkCompanyPdf(crFile, "Commercial registration certificate");
    if (crErr) return { ok: false, message: crErr };
    const naErr = checkCompanyPdf(
      nationalAddressFile,
      "National address certificate",
    );
    if (naErr) return { ok: false, message: naErr };
    const vatErr = checkCompanyPdf(vatFile, "Tax / VAT certificate");
    if (vatErr) return { ok: false, message: vatErr };

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

    // ---- 4. Company PDF bundle (CR / national address / tax) ---------------
    // Small helper closures keep the upload/rollback shape identical to the
    // existing IBAN/company_profile handling. Service-role writes keep the RLS
    // exemption the other uploads rely on; path is locked to `{supplier.id}/…`.
    const uploadCompanyDoc = async (
      file: File,
      prefix: string,
      label: string,
    ): Promise<{ ok: true; path: string } | { ok: false; message: string }> => {
      const path = supplierScopedPath(
        supplier.id,
        "docs",
        `${prefix}-${crypto.randomUUID()}.pdf`,
      );
      const buf = Buffer.from(await file.arrayBuffer());
      const { error: upErr } = await admin.storage
        .from(DOCS_BUCKET)
        .upload(path, buf, {
          contentType: "application/pdf",
          upsert: false,
        });
      if (upErr) {
        return { ok: false, message: `${label} upload failed: ${upErr.message}` };
      }
      uploaded.push({ bucket: DOCS_BUCKET, path });
      return { ok: true, path };
    };

    let crPath: string | null = null;
    let naPath: string | null = null;
    let vatPath: string | null = null;
    if (crFile) {
      const r = await uploadCompanyDoc(crFile, "cr-certificate", "CR certificate");
      if (!r.ok) {
        await rollback(admin, uploaded);
        return { ok: false, message: r.message };
      }
      crPath = r.path;
    }
    if (nationalAddressFile) {
      const r = await uploadCompanyDoc(
        nationalAddressFile,
        "national-address",
        "National address certificate",
      );
      if (!r.ok) {
        await rollback(admin, uploaded);
        return { ok: false, message: r.message };
      }
      naPath = r.path;
    }
    if (vatFile) {
      const r = await uploadCompanyDoc(vatFile, "vat-certificate", "Tax certificate");
      if (!r.ok) {
        await rollback(admin, uploaded);
        return { ok: false, message: r.message };
      }
      vatPath = r.path;
    }

    // ---- 5. DB writes ------------------------------------------------------
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
    if (crPath) {
      docRows.push({
        supplier_id: supplier.id,
        doc_type: "cr",
        file_path: crPath,
        notes: null,
      });
    }
    if (naPath) {
      docRows.push({
        supplier_id: supplier.id,
        doc_type: "national_address",
        file_path: naPath,
        notes: null,
      });
    }
    if (vatPath) {
      docRows.push({
        supplier_id: supplier.id,
        doc_type: "vat",
        file_path: vatPath,
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

