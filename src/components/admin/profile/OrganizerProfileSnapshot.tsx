import { getTranslations } from "next-intl/server";
import { Building2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DetailRow, type BaseProfileSummary, type OrganizerCompany } from "./shared";

/**
 * Organizer / agency profile card — shown in the Sheet for any non-supplier
 * recipient. Organizers don't upload verification papers, so this view is
 * pure metadata: the company row (when present) plus the underlying profile
 * fields. A null `company` means the organizer hasn't created one yet
 * ("individual organizer"); we still render the profile half so the admin
 * can read off the contact's language / phone before replying.
 */
export async function OrganizerProfileSnapshot({
  company,
  profile,
  signupEmail,
}: {
  company: OrganizerCompany | null;
  profile: BaseProfileSummary;
  signupEmail: string | null;
}) {
  const t = await getTranslations("admin.profileViewer.organizer");
  const tCommon = await getTranslations("admin.profileViewer");
  const tDetail = await getTranslations("admin.verifications.detail");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="size-4 text-brand-cobalt-500" aria-hidden />
          {tCommon("sheetTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
          <DetailRow
            label={tDetail("email")}
            value={
              signupEmail ? (
                <a
                  href={`mailto:${signupEmail}`}
                  className="break-all text-brand-cobalt-500 underline-offset-2 hover:underline"
                >
                  {signupEmail}
                </a>
              ) : (
                tDetail("emailUnavailable")
              )
            }
          />
          <DetailRow
            label={t("defaultLanguage")}
            value={profile.language === "ar" ? "العربية" : "English"}
          />
          <DetailRow
            label={tCommon("phone")}
            value={profile.phone ?? "—"}
          />
        </dl>

        {company ? (
          <>
            <Separator className="my-4" />
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
              <DetailRow label={t("company")} value={company.name} />
              <DetailRow
                label={t("companyAr")}
                value={company.name_ar ?? "—"}
              />
              <DetailRow label={t("slug")} value={`/${company.slug}`} />
              <DetailRow
                label={t("crNumber")}
                value={company.cr_number ?? "—"}
              />
              <DetailRow
                label={t("vatNumber")}
                value={company.vat_number ?? "—"}
              />
              <DetailRow
                label={t("billingEmail")}
                value={
                  company.billing_email ? (
                    <a
                      href={`mailto:${company.billing_email}`}
                      className="break-all text-brand-cobalt-500 underline-offset-2 hover:underline"
                    >
                      {company.billing_email}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
            </dl>
          </>
        ) : (
          <>
            <Separator className="my-4" />
            <p className="text-sm text-muted-foreground">{t("noCompany")}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
