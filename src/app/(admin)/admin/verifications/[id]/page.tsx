import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { requireRole } from "@/lib/supabase/server";
import {
  STORAGE_BUCKETS,
  createSignedPreviewUrl,
} from "@/lib/supabase/storage";
import type {
  SupplierDocStatus,
  SupplierVerificationStatus,
} from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { StatusPill } from "@/components/ui-ext/StatusPill";
import type { StatusPillStatus } from "@/components/ui-ext/StatusPill";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { DocActions } from "../_components/DocActions";
import { SupplierActions } from "../_components/SupplierActions";

export const dynamic = "force-dynamic";

type SupplierDetail = {
  id: string;
  business_name: string;
  slug: string;
  legal_type: string;
  cr_number: string | null;
  national_id: string | null;
  base_city: string;
  service_area_cities: string[];
  languages: string[];
  capacity: number | null;
  concurrent_event_limit: number;
  bio: string | null;
  is_published: boolean;
  verification_status: SupplierVerificationStatus;
  verification_notes: string | null;
  verified_at: string | null;
  created_at: string;
  profile_id: string;
};

type SupplierDoc = {
  id: string;
  doc_type: string;
  file_path: string;
  status: SupplierDocStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function docStatusPill(status: SupplierDocStatus): StatusPillStatus {
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  return "pending";
}

function verificationStatusPill(
  status: SupplierVerificationStatus,
): StatusPillStatus {
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  return "pending";
}

type Translator = (key: string) => string;

function legalTypeLabel(raw: string, t: Translator): string {
  if (["company", "freelancer", "foreign"].includes(raw))
    return t(`legalType.${raw}`);
  return raw;
}

function docTypeLabel(raw: string, t: Translator): string {
  if (["cr", "vat", "id", "gea_permit", "certification"].includes(raw))
    return t(`docType.${raw}`);
  return raw;
}

export default async function AdminVerificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("admin.verifications");
  const { id } = await params;

  const gate = await requireRole("admin");
  if (gate.status === "unauthenticated") {
    redirect(
      `/sign-in?next=${encodeURIComponent(`/admin/verifications/${id}`)}`,
    );
  }
  if (gate.status === "forbidden") {
    return (
      <section className="flex flex-col gap-3">
        <PageHeader title={t("title")} />
        <p className="text-sm text-semantic-danger-500">
          {t("errorAdminRequired")}
        </p>
      </section>
    );
  }
  const { admin } = gate;

  const { data: supplierRow, error: supplierErr } = await admin
    .from("suppliers")
    .select(
      "id, business_name, slug, legal_type, cr_number, national_id, base_city, service_area_cities, languages, capacity, concurrent_event_limit, bio, is_published, verification_status, verification_notes, verified_at, created_at, profile_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (supplierErr) {
    return (
      <section className="flex flex-col gap-3">
        <PageHeader title={t("title")} />
        <p className="text-sm text-semantic-danger-500">
          Failed to load supplier: {supplierErr.message}
        </p>
      </section>
    );
  }
  if (!supplierRow) notFound();
  const supplier = supplierRow as SupplierDetail;

  const { data: docRows, error: docsErr } = await admin
    .from("supplier_docs")
    .select(
      "id, doc_type, file_path, status, reviewed_by, reviewed_at, notes, created_at",
    )
    .eq("supplier_id", id)
    .order("created_at", { ascending: true });
  const docs: SupplierDoc[] = (docRows as SupplierDoc[] | null) ?? [];

  // Mint signed preview URLs server-side. Use service-role here so the admin
  // never has to depend on a per-object storage policy lookup beyond the
  // `is_admin()` SELECT policy on `supplier-docs` (we already verified role
  // above). Failing to sign one URL must not break the page.
  const signedDocs = await Promise.all(
    docs.map(async (d) => {
      try {
        const url = await createSignedPreviewUrl(
          admin,
          STORAGE_BUCKETS.docs,
          d.file_path,
        );
        return { ...d, signedUrl: url, signError: null as string | null };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ...d, signedUrl: null, signError: message };
      }
    }),
  );

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button asChild variant="link" size="sm" className="w-fit px-0">
          <Link href="/admin/verifications">
            <ArrowLeft aria-hidden />
            {t("back")}
          </Link>
        </Button>
        <PageHeader
          title={supplier.business_name}
          description={`${t("submitted")} ${fmtDate(supplier.created_at)} · /${supplier.slug}`}
          actions={
            <StatusPill status={verificationStatusPill(supplier.verification_status)} />
          }
        />
      </div>

      {docsErr ? (
        <div
          role="alert"
          className="rounded-md border border-semantic-danger-500/30 bg-semantic-danger-100 px-3 py-2 text-sm text-semantic-danger-500"
        >
          Failed to load documents: {docsErr.message}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          {/* Profile snapshot */}
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
                  label={t("list.col.legalType")}
                  value={legalTypeLabel(supplier.legal_type, t)}
                />
                <DetailRow
                  label={t("detail.baseCity")}
                  value={supplier.base_city}
                />
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

          {/* Documents */}
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
                  {signedDocs.map((d) => (
                    <li key={d.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
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
                        {d.signedUrl ? (
                          <Button asChild variant="outline" size="xs">
                            <a
                              href={d.signedUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {t("openPreview")}
                              <ExternalLink aria-hidden />
                            </a>
                          </Button>
                        ) : d.signError ? (
                          <span className="text-semantic-danger-500">
                            {t("previewUnavailable")}: {d.signError}
                          </span>
                        ) : (
                          <span>{t("previewUnavailable")}</span>
                        )}
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
                        supplierId={supplier.id}
                        currentStatus={d.status}
                        currentNotes={d.notes}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          <SupplierActions
            supplierId={supplier.id}
            defaultNotes={supplier.verification_notes}
            currentStatus={supplier.verification_status}
          />
          <Card size="sm">
            <CardContent className="text-xs text-muted-foreground">
              <p>{t("approveSummary")}</p>
              <p className="mt-2">{t("rejectSummary")}</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </section>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}
