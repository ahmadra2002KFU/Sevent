import { getTranslations } from "next-intl/server";
import { requireAccess } from "@/lib/auth/access";
import { getUserWithEmail } from "@/lib/admin/users";
import { createSignedPreviewUrl, STORAGE_BUCKETS } from "@/lib/supabase/storage";
import { ProfileViewerHeader } from "./ProfileViewerHeader";
import { SupplierProfileSnapshot } from "./SupplierProfileSnapshot";
import { SupplierDocumentList } from "./SupplierDocumentList";
import { OrganizerProfileSnapshot } from "./OrganizerProfileSnapshot";
import {
  type BaseProfileSummary,
  type OrganizerCompany,
  type SupplierDetail,
  type SupplierDoc,
} from "./shared";

/**
 * The body shown inside the profile Sheet OR the full-page fallback route.
 * Single source of truth so the intercepting slot and the direct visit stay
 * identical.
 *
 * Auth gate matches the rest of the messages surface
 * (`messaging.admin.read`) — opening a Sheet on the inbox should never grant
 * a permission the inbox itself didn't already have.
 */
export async function ProfileBody({ userId }: { userId: string }) {
  const t = await getTranslations("admin.profileViewer");

  const { admin } = await requireAccess("messaging.admin.read");

  const user = await getUserWithEmail(admin, userId);
  if (!user) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        {t("noUser")}
      </div>
    );
  }

  const role = user.role as "supplier" | "organizer" | "admin" | "agency";
  const fullName = user.full_name?.trim() || user.email || userId;
  const initial = (fullName.charAt(0) || "?").toUpperCase();

  if (role === "supplier") {
    const { data: supplierRow } = await admin
      .from("suppliers")
      .select(
        "id, business_name, slug, legal_type, cr_number, national_id, base_city, service_area_cities, languages, capacity, concurrent_event_limit, bio, is_published, verification_status, verification_notes, verified_at, created_at, profile_id, logo_path, works_with_segments, papers_changed_at",
      )
      .eq("profile_id", userId)
      .maybeSingle();

    if (!supplierRow) {
      return (
        <div className="flex flex-col gap-4">
          <ProfileViewerHeader
            fullName={fullName}
            email={user.email}
            role={role}
            logoUrl={null}
            initial={initial}
          />
          <p className="rounded-md border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            {t("supplier.noSupplier")}
          </p>
        </div>
      );
    }

    const supplier = supplierRow as SupplierDetail;
    const { data: docRows } = await admin
      .from("supplier_docs")
      .select(
        "id, doc_type, file_path, status, reviewed_by, reviewed_at, notes, created_at",
      )
      .eq("supplier_id", supplier.id)
      .order("created_at", { ascending: true });
    const docs: SupplierDoc[] = (docRows as SupplierDoc[] | null) ?? [];

    const logoUrl = supplier.logo_path
      ? `/admin/verifications/${supplier.id}/logo`
      : null;
    const previewHrefBase = `/admin/verifications/${supplier.id}/doc`;
    const businessInitial =
      supplier.business_name.trim().charAt(0).toUpperCase() || initial;

    return (
      <div className="flex flex-col gap-4">
        <ProfileViewerHeader
          fullName={supplier.business_name}
          email={user.email}
          role={role}
          logoUrl={logoUrl}
          initial={businessInitial}
          verificationStatus={supplier.verification_status}
          papersChangedAt={supplier.papers_changed_at ?? null}
          verifiedAt={supplier.verified_at}
        />
        <SupplierProfileSnapshot supplier={supplier} signupEmail={user.email} />
        <SupplierDocumentList
          supplierId={supplier.id}
          docs={docs}
          previewHrefBase={previewHrefBase}
        />
      </div>
    );
  }

  if (role === "admin") {
    return (
      <div className="flex flex-col gap-4">
        <ProfileViewerHeader
          fullName={fullName}
          email={user.email}
          role={role}
          logoUrl={null}
          initial={initial}
        />
        <p className="rounded-md border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          {t("admin.selfNotice")}
        </p>
      </div>
    );
  }

  // organizer / agency
  const { data: profileRow } = await admin
    .from("profiles")
    .select("id, full_name, phone, language, role, last_active_company_id")
    .eq("id", userId)
    .maybeSingle();

  const profile: BaseProfileSummary = {
    id: userId,
    full_name: profileRow?.full_name ?? user.full_name ?? null,
    phone: profileRow?.phone ?? null,
    language: (profileRow?.language as "en" | "ar" | undefined) ?? "en",
    role,
  };
  const lastActiveCompanyId =
    (profileRow?.last_active_company_id as string | null | undefined) ?? null;

  let company: OrganizerCompany | null = null;
  if (lastActiveCompanyId) {
    const { data: companyRow } = await admin
      .from("organizer_companies")
      .select(
        "id, name, name_ar, slug, cr_number, vat_number, billing_email, logo_path, default_language",
      )
      .eq("id", lastActiveCompanyId)
      .maybeSingle();
    if (companyRow) {
      company = companyRow as OrganizerCompany;
    }
  }

  // The organizer-logos bucket has `public=false` at the bucket level, so
  // `getPublicUrl()` 400s; mint a short-lived signed URL instead. Failures
  // here must not break the Sheet — fall back to the initial-fallback tile.
  let logoUrl: string | null = null;
  if (company?.logo_path) {
    try {
      logoUrl = await createSignedPreviewUrl(
        admin,
        STORAGE_BUCKETS.organizerLogos,
        company.logo_path,
      );
    } catch (err) {
      console.warn(
        "[profileViewer] failed to sign organizer logo URL",
        { companyId: company.id, err: err instanceof Error ? err.message : err },
      );
      logoUrl = null;
    }
  }

  const headerName = company?.name ?? fullName;
  const headerInitial = (headerName.charAt(0) || "?").toUpperCase();

  return (
    <div className="flex flex-col gap-4">
      <ProfileViewerHeader
        fullName={headerName}
        email={user.email}
        role={role}
        logoUrl={logoUrl}
        initial={headerInitial}
      />
      <OrganizerProfileSnapshot
        company={company}
        profile={profile}
        signupEmail={user.email}
      />
    </div>
  );
}
