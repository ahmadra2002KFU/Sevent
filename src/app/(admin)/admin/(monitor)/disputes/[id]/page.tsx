import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import {
  fmtDateTime as fmtDateTimeHelper,
  type SupportedLocale,
} from "@/lib/domain/formatDate";
import { formatHalalas } from "@/lib/domain/money";
import {
  DISPUTE_REASON_CODES,
  type DisputeReasonCode,
  type DisputeEvidenceRow,
  type DisputeStatus,
} from "@/lib/domain/disputes";
import type { QuoteSnapshot } from "@/lib/domain/quote";
import {
  EvidenceList,
  type EvidenceWithAuthor,
} from "@/components/disputes/EvidenceList";
import {
  AddNoteForm,
  UploadFileForm,
} from "@/components/disputes/EvidenceForms";
import { ResolveDisputeForm } from "./ResolveDisputeForm";
import {
  resolveDisputeAction,
  closeDisputeAction,
  adminSubmitNoteEvidenceAction,
  adminSubmitFileEvidenceAction,
  adminGetEvidenceUrlAction,
} from "./actions";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

type DetailRow = {
  id: string;
  booking_id: string;
  raised_by: string;
  reason_code: string;
  description: string;
  status: DisputeStatus;
  opened_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_jsonb: Record<string, unknown> | null;
  bookings: {
    id: string;
    organizer_id: string;
    supplier_id: string;
    service_status: string | null;
    completed_at: string | null;
    accepted_quote_revision_id: string;
    suppliers: { id: string; business_name: string } | null;
    quote_revisions: {
      id: string;
      version: number;
      snapshot_jsonb: unknown;
    } | null;
  } | null;
};

export default async function AdminDisputeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations("admin.disputes");
  const tStatus = await getTranslations("disputes.status");
  const tReason = await getTranslations("disputes.reason");
  const tBooking = await getTranslations("booking");
  const tEvidence = await getTranslations("disputes");

  const gate = await requireRole("admin");
  if (gate.status === "unauthenticated") {
    redirect(`/sign-in?next=${encodeURIComponent(`/admin/disputes/${id}`)}`);
  }
  if (gate.status === "forbidden") {
    return (
      <section className="flex flex-col gap-3">
        <PageHeader title={t("detail.title")} />
        <p className="text-sm text-semantic-danger-500">
          {t("errorAdminRequired")}
        </p>
      </section>
    );
  }
  const { admin } = gate;

  const { data: row } = await admin
    .from("disputes")
    .select(
      `id, booking_id, raised_by, reason_code, description, status,
       opened_at, resolved_at, resolved_by, resolution_jsonb,
       bookings (
         id, organizer_id, supplier_id, service_status, completed_at,
         accepted_quote_revision_id,
         suppliers ( id, business_name ),
         quote_revisions:accepted_quote_revision_id ( id, version, snapshot_jsonb )
       )`,
    )
    .eq("id", id)
    .maybeSingle();
  const d = row as unknown as DetailRow | null;
  if (!d || !d.bookings) notFound();

  // Pull every evidence row with submitter names.
  const { data: evRows } = await admin
    .from("dispute_evidence")
    .select(
      `id, dispute_id, submitted_by, kind, file_path, text_note,
       visible_to_other_party, created_at`,
    )
    .eq("dispute_id", id)
    .order("created_at", { ascending: true });
  const evidence = (evRows ?? []) as DisputeEvidenceRow[];
  const authorIds = Array.from(
    new Set([d.raised_by, ...evidence.map((e) => e.submitted_by)]),
  );
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, role")
    .in("id", authorIds);
  const profileById = new Map(
    ((profiles ?? []) as Array<{
      id: string;
      full_name: string | null;
      role: string | null;
    }>).map((p) => [p.id, p]),
  );
  const evidenceWithAuthor: EvidenceWithAuthor[] = evidence.map((e) => {
    const p = profileById.get(e.submitted_by);
    return {
      ...e,
      authorName: p?.full_name ?? "—",
      authorRoleLabel: p?.role ?? null,
    };
  });

  const raiser = profileById.get(d.raised_by);
  const reason = (DISPUTE_REASON_CODES as readonly string[]).includes(
    d.reason_code,
  )
    ? tReason(
        (d.reason_code === "service_not_delivered"
          ? "serviceNotDelivered"
          : d.reason_code === "service_below_spec"
            ? "serviceBelowSpec"
            : d.reason_code === "no_show"
              ? "noShow"
              : d.reason_code === "damaged_or_unsafe"
                ? "damagedOrUnsafe"
                : d.reason_code === "billing_dispute"
                  ? "billingDispute"
                  : d.reason_code === "schedule_conflict"
                    ? "scheduleConflict"
                    : "other") as never,
      )
    : d.reason_code;

  const snapshot = (d.bookings.quote_revisions?.snapshot_jsonb ?? null) as
    | QuoteSnapshot
    | null;
  const isActive = d.status === "open" || d.status === "investigating";

  const boundResolve = resolveDisputeAction.bind(null, d.id);
  const boundClose = closeDisputeAction.bind(null, d.id);
  const submitNoteBound = adminSubmitNoteEvidenceAction.bind(
    null,
    d.id,
    d.booking_id,
  );
  const submitFileBound = adminSubmitFileEvidenceAction.bind(
    null,
    d.id,
    d.booking_id,
  );

  return (
    <section className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/admin/disputes">
          <ArrowLeft className="rtl:rotate-180" aria-hidden />
          {t("detail.backToList")}
        </Link>
      </Button>

      <PageHeader
        title={`${t("detail.title")} — ${d.bookings.suppliers?.business_name ?? "—"}`}
        description={t("detail.subtitle", { bookingId: d.booking_id.slice(0, 8) })}
        actions={
          <Badge
            variant={isActive ? "destructive" : "secondary"}
            className="capitalize"
          >
            {tStatus(d.status as never)}
          </Badge>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>{t("detail.bookingHeading")}</CardDescription>
            <CardTitle className="text-base">
              {d.bookings.suppliers?.business_name ?? "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="text-muted-foreground">
              Service status:{" "}
              <span className="font-medium text-foreground">
                {d.bookings.service_status ?? "—"}
              </span>
            </p>
            <p className="text-muted-foreground">
              {tBooking("detail.revision")} #
              {d.bookings.quote_revisions?.version ?? "—"}
              {snapshot ? (
                <span className="ms-1 text-foreground">
                  · {formatHalalas(snapshot.total_halalas)}
                </span>
              ) : null}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>{t("detail.partiesHeading")}</CardDescription>
            <CardTitle className="text-base">{raiser?.full_name ?? "—"}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-xs text-muted-foreground">
            <p>
              {tEvidence("detail.raisedBy")}:{" "}
              <span className="font-medium text-foreground">
                {raiser?.full_name ?? "—"}
              </span>{" "}
              · {raiser?.role ?? "—"}
            </p>
            <p>
              {tEvidence("detail.openedAt")}:{" "}
              <span className="text-foreground">
                {fmtDateTimeHelper(d.opened_at, locale)}
              </span>
            </p>
            {d.resolved_at ? (
              <p>
                Resolved:{" "}
                <span className="text-foreground">
                  {fmtDateTimeHelper(d.resolved_at, locale)}
                </span>
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {tEvidence("detail.reasonHeading")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tEvidence("detail.reasonHeading")}
            </h3>
            <p className="mt-1">{reason}</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tEvidence("detail.descriptionHeading")}
            </h3>
            <p className="mt-1 whitespace-pre-line">{d.description}</p>
          </div>
          {d.resolution_jsonb ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Resolution
              </h3>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(d.resolution_jsonb, null, 2)}
              </pre>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {tEvidence("detail.evidenceHeading")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <EvidenceList
            evidence={evidenceWithAuthor}
            locale={locale}
            labels={{
              empty: tEvidence("detail.evidenceEmpty"),
              visibleToOther: tEvidence("detail.evidenceVisibleToOther"),
              private: tEvidence("detail.evidencePrivate"),
              submittedBy: tEvidence("detail.submittedBy"),
              downloadFile: tEvidence("detail.downloadFile"),
            }}
            getSignedUrl={adminGetEvidenceUrlAction}
          />
          {isActive ? (
            <div className="grid gap-4 md:grid-cols-2">
              <AddNoteForm
                disputeId={d.id}
                action={submitNoteBound}
                labels={{
                  heading: tEvidence("evidence.addNoteHeading"),
                  noteLabel: tEvidence("evidence.noteLabel"),
                  notePlaceholder: tEvidence("evidence.notePlaceholder"),
                  visibilityLabel: tEvidence("evidence.visibilityLabel"),
                  submit: tEvidence("evidence.submitNote"),
                }}
              />
              <UploadFileForm
                disputeId={d.id}
                action={submitFileBound}
                labels={{
                  heading: tEvidence("evidence.uploadHeading"),
                  fileLabel: tEvidence("evidence.fileLabel"),
                  visibilityLabel: tEvidence("evidence.visibilityLabel"),
                  submit: tEvidence("evidence.submitFile"),
                }}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("detail.resolveHeading")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isActive ? (
            <ResolveDisputeForm
              resolveAction={boundResolve}
              closeAction={boundClose}
              labels={{
                noteLabel: t("detail.resolutionNoteLabel"),
                notePlaceholder: t("detail.resolutionNotePlaceholder"),
                resolveButton: t("detail.resolveButton"),
                closeButton: t("detail.closeButton"),
                actionSuccess: t("detail.actionSuccess"),
              }}
            />
          ) : (
            <Alert>
              <AlertDescription>
                {t("detail.alreadyClosed", { status: tStatus(d.status as never) })}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
