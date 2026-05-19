import { getLocale, getTranslations } from "next-intl/server";
import { ShieldCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getSegmentBySlug } from "@/lib/domain/segments";
import {
  DetailRow,
  fmtDate,
  legalTypeLabel,
  type SupplierDetail,
} from "./shared";

/**
 * Supplier profile card — the "who is this account" block. Shared between the
 * `/admin/verifications/[id]` page (initial-review surface) and the new
 * `/admin/messages?profile=…` Sheet (re-review surface). Both consume the
 * same `admin.verifications.*` i18n namespace, so the component fetches its
 * own translations to keep callers boilerplate-free.
 */
export async function SupplierProfileSnapshot({
  supplier,
  signupEmail,
}: {
  supplier: SupplierDetail;
  signupEmail: string | null;
}) {
  const t = await getTranslations("admin.verifications");
  const locale = (await getLocale()) as "en" | "ar";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4 text-brand-cobalt-500" aria-hidden />
          {t("profileSnapshot")}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
          <DetailRow
            label={t("detail.email")}
            value={
              signupEmail ? (
                <a
                  href={`mailto:${signupEmail}`}
                  className="break-all text-brand-cobalt-500 underline-offset-2 hover:underline"
                >
                  {signupEmail}
                </a>
              ) : (
                t("detail.emailUnavailable")
              )
            }
          />
          <DetailRow
            label={t("list.col.legalType")}
            value={legalTypeLabel(supplier.legal_type, t)}
          />
          <DetailRow label={t("detail.baseCity")} value={supplier.base_city} />
          <DetailRow
            label={t("detail.crNumber")}
            value={supplier.cr_number ?? "—"}
          />
          <DetailRow
            label={t("detail.nationalId")}
            value={supplier.national_id ?? "—"}
          />
          <DetailRow
            label={t("detail.serviceArea")}
            value={
              supplier.service_area_cities?.length
                ? supplier.service_area_cities.join(", ")
                : "—"
            }
          />
          <DetailRow
            label={t("detail.languages")}
            value={
              supplier.languages?.length
                ? supplier.languages.join(", ")
                : "—"
            }
          />
          <DetailRow
            label={t("detail.capacity")}
            value={supplier.capacity != null ? String(supplier.capacity) : "—"}
          />
          <DetailRow
            label={t("detail.concurrent")}
            value={String(supplier.concurrent_event_limit)}
          />
          <DetailRow
            label={t("detail.published")}
            value={supplier.is_published ? t("detail.yes") : t("detail.no")}
          />
          <DetailRow
            label={t("detail.verifiedAt")}
            value={fmtDate(supplier.verified_at)}
          />
        </dl>
        <Separator className="my-4" />
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("segments.heading")}
          </dt>
          <dd className="mt-2">
            {supplier.works_with_segments &&
            supplier.works_with_segments.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {supplier.works_with_segments.map((slug) => {
                  const seg = getSegmentBySlug(slug);
                  const label = seg
                    ? locale === "ar"
                      ? seg.name_ar
                      : seg.name_en
                    : slug;
                  return (
                    <li
                      key={slug}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-foreground"
                    >
                      <span aria-hidden className="text-sm leading-none">
                        {seg?.icon ?? "•"}
                      </span>
                      <span>{label}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("segments.none")}
              </p>
            )}
          </dd>
        </div>
        {supplier.bio ? (
          <>
            <Separator className="my-4" />
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("detail.bio")}
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                {supplier.bio}
              </dd>
            </div>
          </>
        ) : null}
        {supplier.verification_notes ? (
          <div className="mt-4 rounded-md border border-semantic-danger-500/30 bg-semantic-danger-100 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-semantic-danger-500">
              {t("lastReviewerNotes")}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-semantic-danger-500">
              {supplier.verification_notes}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
