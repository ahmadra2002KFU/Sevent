import { getTranslations } from "next-intl/server";
import { ExternalLink, FileText } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui-ext/StatusPill";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { DocActions } from "./DocActions";
import {
  docStatusPill,
  docTypeIcon,
  docTypeLabel,
  fmtDate,
  type SupplierDoc,
} from "./shared";

/**
 * Documents card with per-doc approve / reject actions. Shared between the
 * initial-review verifications page and the Sheet's re-review surface. The
 * action wiring is identical — both call `approveDocAction` /
 * `rejectDocAction`, which write the audit-log row internally.
 *
 * `previewHrefBase` is passed in so the route handler stays unchanged: every
 * caller targets `/admin/verifications/{supplierId}/doc/{docId}/preview`,
 * which already exists and re-signs the URL on every request.
 */
export async function SupplierDocumentList({
  supplierId,
  docs,
  previewHrefBase,
}: {
  supplierId: string;
  docs: SupplierDoc[];
  /** e.g. `/admin/verifications/${supplierId}/doc` — caller builds it once. */
  previewHrefBase: string;
}) {
  const t = await getTranslations("admin.verifications");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="size-4 text-brand-cobalt-500" aria-hidden />
          {t("detail.docsHeading")}
        </CardTitle>
        <CardDescription>
          {t("detail.docsCount", { count: docs.length })}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        {docs.length === 0 ? (
          <EmptyState icon={FileText} title={t("noDocs")} />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {docs.map((d) => {
              const DocIcon = docTypeIcon(d.doc_type);
              const previewHref = `${previewHrefBase}/${d.id}/preview`;
              return (
                <li
                  key={d.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        aria-hidden
                        className="inline-flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground"
                      >
                        <DocIcon className="size-4" />
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {docTypeLabel(d.doc_type, t)}
                      </span>
                      <StatusPill status={docStatusPill(d.status)} />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {t("uploaded")} {fmtDate(d.created_at)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <Button asChild variant="outline" size="xs">
                      <a href={previewHref} target="_blank" rel="noreferrer">
                        {t("openPreview")}
                        <ExternalLink aria-hidden />
                      </a>
                    </Button>
                    {d.reviewed_at ? (
                      <span>
                        · {t("reviewed")} {fmtDate(d.reviewed_at)}
                      </span>
                    ) : null}
                  </div>
                  {d.notes ? (
                    <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
                      {d.notes}
                    </p>
                  ) : null}
                  <DocActions
                    docId={d.id}
                    supplierId={supplierId}
                    currentStatus={d.status}
                    currentNotes={d.notes}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
