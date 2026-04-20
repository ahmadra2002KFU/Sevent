"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  DOC_TYPES,
  LANGUAGES,
  OnboardingStep1,
  OnboardingStep3,
  slugifyBusinessName,
} from "@/lib/domain/onboarding";
import { createSupabaseServerClient, requireRole } from "@/lib/supabase/server";
import { STORAGE_BUCKETS, supplierScopedPath } from "@/lib/supabase/storage";
import { uniqueSupplierSlug } from "@/lib/onboarding/slug";
import type { SupplierDocType } from "@/lib/supabase/types";

export type OnboardingState = {
  ok: boolean;
  message?: string;
  supplierId?: string;
};

async function loadSupplierContext() {
  // Reads that would hit the `profiles`/`suppliers` RLS policy cycle go
  // through the service-role admin client. Writes that need
  // storage.objects.owner tracking keep the user-scoped client.
  const gate = await requireRole("supplier");
  if (gate.status === "unauthenticated") throw new Error("Not authenticated");
  if (gate.status === "forbidden") {
    throw new Error("Only supplier accounts can complete onboarding");
  }
  const { user, admin } = gate;

  // `supabase` is the user-scoped client — required for storage uploads so
  // the `owner = auth.uid()` column gets set and the `docs: owner read`
  // policy keeps working. DB reads/writes go through `admin` to dodge RLS
  // recursion on policies that JOIN profiles.
  const supabase = await createSupabaseServerClient();

  const { data: supplier, error: supplierErr } = await admin
    .from("suppliers")
    .select(
      "id, profile_id, business_name, slug, legal_type, cr_number, national_id, bio, base_city, service_area_cities, languages, capacity, concurrent_event_limit, is_published, verification_status",
    )
    .eq("profile_id", user.id)
    .maybeSingle();
  if (supplierErr) throw new Error(`Supplier lookup failed: ${supplierErr.message}`);

  return { supabase, admin, user, supplier };
}

export async function submitOnboardingStep1(
  _prev: OnboardingState | undefined,
  formData: FormData,
): Promise<OnboardingState> {
  try {
    const parsed = OnboardingStep1.safeParse({
      business_name: formData.get("business_name") ?? "",
      legal_type: formData.get("legal_type") ?? "",
      cr_number: (formData.get("cr_number") as string) || undefined,
      national_id: (formData.get("national_id") as string) || undefined,
      bio: (formData.get("bio") as string) || undefined,
    });
    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
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
          base_city: "",
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

const DocEntry = z.object({
  doc_type: z.enum(DOC_TYPES),
  notes: z.string().max(500).optional(),
});

export async function submitOnboardingStep2(
  _prev: OnboardingState | undefined,
  formData: FormData,
): Promise<OnboardingState> {
  try {
    const { supabase, admin, supplier } = await loadSupplierContext();
    if (!supplier) {
      return { ok: false, message: "Please complete business information first" };
    }

    const files = formData
      .getAll("file")
      .filter((f): f is File => f instanceof File && f.size > 0);
    const docTypes = formData.getAll("doc_type").map((v) => String(v));
    const notes = formData.getAll("notes").map((v) => (v ? String(v) : ""));
    if (files.length === 0) return { ok: false, message: "Upload at least one document" };

    const rows: Array<{
      supplier_id: string;
      doc_type: SupplierDocType;
      file_path: string;
      notes: string | null;
    }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const entry = DocEntry.safeParse({
        doc_type: docTypes[i],
        notes: notes[i] || undefined,
      });
      if (!entry.success) {
        return {
          ok: false,
          message: `Document ${i + 1}: ${entry.error.issues.map((e) => e.message).join(", ")}`,
        };
      }

      const path = supplierScopedPath(supplier.id, "docs", file.name || `doc-${i + 1}.bin`);
      const buffer = Buffer.from(await file.arrayBuffer());
      // Storage upload stays on the user-scoped client so `owner = auth.uid()`
      // is set and the `docs: owner read` policy continues to work.
      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKETS.docs)
        .upload(path, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (upErr) return { ok: false, message: `Upload failed (${file.name}): ${upErr.message}` };

      rows.push({
        supplier_id: supplier.id,
        doc_type: entry.data.doc_type,
        file_path: path,
        notes: entry.data.notes ?? null,
      });
    }

    const { error: insertErr } = await admin.from("supplier_docs").insert(rows);
    if (insertErr) {
      return { ok: false, message: `Saving document records failed: ${insertErr.message}` };
    }

    revalidatePath("/supplier/onboarding");
    return { ok: true, supplierId: supplier.id };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Unexpected error" };
  }
}

function parseOptionalNumber(v: FormDataEntryValue | null): number | undefined {
  if (v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

const Step3Input = OnboardingStep3.extend({
  category_ids: z.array(z.string().uuid()).min(0).default([]),
  subcategory_ids: z.array(z.string().uuid()).min(1),
});

export async function submitOnboardingStep3(
  _prev: OnboardingState | undefined,
  formData: FormData,
): Promise<OnboardingState> {
  try {
    const { admin, supplier } = await loadSupplierContext();
    if (!supplier) {
      return { ok: false, message: "Please complete business information first" };
    }

    const serviceAreaCities =
      (formData.get("service_area_cities") as string | null)
        ?.split(",")
        .map((s) => s.trim())
        .filter(Boolean) ?? [];
    const selectedLanguages = formData
      .getAll("languages")
      .map((v) => String(v))
      .filter((v): v is (typeof LANGUAGES)[number] => (LANGUAGES as readonly string[]).includes(v));
    const subcategoryIds = formData
      .getAll("subcategory_ids")
      .map((v) => String(v))
      .filter(Boolean);

    const latRaw = parseOptionalNumber(formData.get("base_lat"));
    const lngRaw = parseOptionalNumber(formData.get("base_lng"));
    const baseLocation =
      latRaw !== undefined && lngRaw !== undefined ? { lat: latRaw, lng: lngRaw } : undefined;

    const parsed = Step3Input.safeParse({
      base_city: formData.get("base_city") ?? "",
      base_location: baseLocation,
      service_area_cities: serviceAreaCities,
      languages: selectedLanguages,
      capacity: parseOptionalNumber(formData.get("capacity")),
      concurrent_event_limit: Number(formData.get("concurrent_event_limit") ?? 1),
      category_ids: [],
      subcategory_ids: subcategoryIds,
    });
    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      };
    }

    const payload = parsed.data;

    const patch: Record<string, unknown> = {
      base_city: payload.base_city,
      service_area_cities: payload.service_area_cities,
      languages: payload.languages,
      capacity: payload.capacity ?? null,
      concurrent_event_limit: payload.concurrent_event_limit,
    };
    if (payload.base_location) {
      patch.base_location = `SRID=4326;POINT(${payload.base_location.lng} ${payload.base_location.lat})`;
    }

    const { error: updateErr } = await admin
      .from("suppliers")
      .update(patch)
      .eq("id", supplier.id);
    if (updateErr) return { ok: false, message: `Saving service area failed: ${updateErr.message}` };

    const { error: deleteErr } = await admin
      .from("supplier_categories")
      .delete()
      .eq("supplier_id", supplier.id);
    if (deleteErr) {
      return { ok: false, message: `Could not reset subcategory links: ${deleteErr.message}` };
    }

    if (payload.subcategory_ids.length > 0) {
      const links = payload.subcategory_ids.map((id) => ({
        supplier_id: supplier.id,
        subcategory_id: id,
      }));
      const { error: linkErr } = await admin.from("supplier_categories").insert(links);
      if (linkErr) return { ok: false, message: `Saving subcategories failed: ${linkErr.message}` };
    }

    revalidatePath("/supplier/onboarding");
    revalidatePath("/supplier/dashboard");
    return { ok: true, supplierId: supplier.id };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Unexpected error" };
  }
}

