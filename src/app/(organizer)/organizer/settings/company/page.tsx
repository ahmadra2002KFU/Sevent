import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { requireAccess } from "@/lib/auth/access";
import { CompanySettingsForm } from "./company-settings-form";

export const dynamic = "force-dynamic";

type CompanyRow = {
  id: string;
  name: string;
  name_ar: string | null;
  slug: string;
  cr_number: string | null;
  vat_number: string | null;
  billing_email: string | null;
  default_language: "en" | "ar";
  logo_path: string | null;
};

/**
 * Company profile editor. Reachable from /organizer/settings/company. The
 * shared layout already short-circuits individuals to the dashboard; here
 * we only render — and the in-row form is read-only for `member`-role
 * viewers (no Save button shown).
 *
 * Slug is shown but disabled — URLs that suppliers may already have
 * bookmarked rely on it. Future product change can wire a slug-edit flow
 * with a redirect record; for now slug edits go through ops.
 */
export default async function OrganizerCompanySettingsPage() {
  const { admin, decision } = await requireAccess("organizer.settings");
  const companyId = decision.activeCompanyId;
  if (!companyId) {
    notFound();
  }

  const { data: row, error } = await admin
    .from("organizer_companies")
    .select(
      "id, name, name_ar, slug, cr_number, vat_number, billing_email, default_language, logo_path",
    )
    .eq("id", companyId)
    .maybeSingle();

  if (error) {
    console.error("[settings/company] load failed", error);
  }

  const t = await getTranslations("organizer.settings.company");

  if (!row) {
    return (
      <Alert variant="destructive">
        <AlertTriangle aria-hidden />
        <AlertDescription>{t("loadError")}</AlertDescription>
      </Alert>
    );
  }

  const company = row as CompanyRow;
  const canEdit =
    decision.companyRole === "owner" || decision.companyRole === "admin";

  // PR 7 finding #7: finance fields (cr_number, vat_number, billing_email)
  // are admin-only. Mask them to empty strings for member viewers so they
  // never reach the HTML payload, even though the form also conditionally
  // omits the inputs. Defense in depth — the form is the UX line; the
  // server-side `revoke select(...) from authenticated` migration is the
  // PostgREST line.
  return (
    <CompanySettingsForm
      companyId={company.id}
      defaultValues={{
        name: company.name,
        name_ar: company.name_ar ?? "",
        slug: company.slug,
        cr_number: canEdit ? company.cr_number ?? "" : "",
        vat_number: canEdit ? company.vat_number ?? "" : "",
        billing_email: canEdit ? company.billing_email ?? "" : "",
        default_language: company.default_language,
        logo_path: company.logo_path ?? "",
      }}
      canEdit={canEdit}
    />
  );
}
