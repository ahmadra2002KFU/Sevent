import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { fmtDateTime, type SupportedLocale } from "@/lib/domain/formatDate";
import { requireAccess } from "@/lib/auth/access";
import {
  DISPUTE_REASON_CODES,
  type DisputeReasonCode,
  type DisputeEvidenceRow,
  type DisputeRow,
} from "@/lib/domain/disputes";
import { resolveOpenDisputeContext } from "@/lib/domain/disputes.server";
import { OpenDisputeForm } from "@/components/disputes/OpenDisputeForm";
import {
  EvidenceList,
  type EvidenceWithAuthor,
} from "@/components/disputes/EvidenceList";
import {
  AddNoteForm,
  UploadFileForm,
} from "@/components/disputes/EvidenceForms";
import {
  openDisputeAction,
  submitNoteEvidenceAction,
  submitFileEvidenceAction,
  getEvidenceUrlAction,
} from "./actions";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function SupplierDisputePage({ params }: PageProps) {
  const { id } = await params;
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations("disputes");
  const { user, admin } = await requireAccess("supplier.bookings");

  const openCtx = await resolveOpenDisputeContext({
    admin,
    bookingId: id,
    viewerProfileId: user.id,
  });

  if (!openCtx.ok && openCtx.reason === "not_found") notFound();
  if (!openCtx.ok && openCtx.reason === "not_party") notFound();
  if (openCtx.ok && openCtx.role !== "supplier") {
    redirect(`/organizer/bookings/${id}/dispute`);
  }

  const { data: disputeRows } = await admin
    .from("disputes")
    .select(
      `id, booking_id, raised_by, reason_code, description, status,
       opened_at, resolved_at, resolved_by, resolution_jsonb, created_at`,
    )
    .eq("booking_id", id)
    .order("created_at", { ascending: false });
  const disputes = (disputeRows ?? []) as DisputeRow[];

  const disputeIds = disputes.map((d) => d.id);
  let evidenceByDispute = new Map<string, EvidenceWithAuthor[]>();
  if (disputeIds.length > 0) {
    const { data: evRows } = await admin
      .from("dispute_evidence")
      .select(
        `id, dispute_id, submitted_by, kind, file_path, text_note,
         visible_to_other_party, created_at`,
      )
      .in("dispute_id", disputeIds)
      .order("created_at", { ascending: true });
    const evidence = (evRows ?? []) as DisputeEvidenceRow[];
    const authorIds = Array.from(
      new Set([
        ...disputes.map((d) => d.raised_by),
        ...evidence.map((e) => e.submitted_by),
      ]),
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
    evidenceByDispute = new Map<string, EvidenceWithAuthor[]>();
    for (const e of evidence) {
      const p = profileById.get(e.submitted_by);
      const arr = evidenceByDispute.get(e.dispute_id) ?? [];
      arr.push({
        ...e,
        authorName: p?.full_name ?? "—",
        authorRoleLabel: p?.role ?? null,
      });
      evidenceByDispute.set(e.dispute_id, arr);
    }
  }

  const viewerHasFiled = disputes.some((d) => d.raised_by === user.id);

  const reasonOptions: Record<DisputeReasonCode, string> = Object.fromEntries(
    DISPUTE_REASON_CODES.map((code) => [
      code,
      t(
        `reason.${
          code === "service_not_delivered"
            ? "serviceNotDelivered"
            : code === "service_below_spec"
              ? "serviceBelowSpec"
              : code === "no_show"
                ? "noShow"
                : code === "damaged_or_unsafe"
                  ? "damagedOrUnsafe"
                  : code === "billing_dispute"
                    ? "billingDispute"
                    : code === "schedule_conflict"
                      ? "scheduleConflict"
                      : "other"
        }` as never,
      ),
    ]),
  ) as Record<DisputeReasonCode, string>;

  const boundOpenAction = openDisputeAction.bind(null, id);

  return (
    <section className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href={`/supplier/bookings/${id}`}>
          <ArrowLeft className="rtl:rotate-180" aria-hidden />
          {t("backToBooking")}
        </Link>
      </Button>

      <PageHeader
        title={t("openTitle")}
        description={t("openDescription")}
      />

      {!openCtx.ok && !viewerHasFiled ? (
        <Alert>
          <AlertDescription>
            {openCtx.reason === "not_completed"
              ? t("blocked.notCompleted")
              : openCtx.reason === "missing_completed_at"
                ? t("blocked.notCompleted")
                : openCtx.reason === "window_closed"
                  ? t("blocked.windowClosed")
                  : openCtx.reason === "already_open_by_viewer"
                    ? t("blocked.alreadyOpenByViewer")
                    : t("blocked.generic")}
          </AlertDescription>
        </Alert>
      ) : null}

      {disputes.length > 0 ? (
        <div className="flex flex-col gap-6">
          {disputes.map((d) => {
            const evidence = evidenceByDispute.get(d.id) ?? [];
            const submitNoteBound = submitNoteEvidenceAction.bind(null, d.id, id);
            const submitFileBound = submitFileEvidenceAction.bind(null, d.id, id);
            const isActive =
              d.status === "open" || d.status === "investigating";
            return (
              <Card key={d.id}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 border-b">
                  <div className="flex flex-col gap-1">
                    <CardTitle className="text-base">
                      {t("detail.title")}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {t("detail.openedAt")}: {fmtDateTime(d.opened_at, locale)}
                    </p>
                  </div>
                  <Badge
                    variant={isActive ? "destructive" : "secondary"}
                    className="capitalize"
                  >
                    {t(`status.${d.status}` as never)}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 pt-6">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("detail.reasonHeading")}
                    </h3>
                    <p className="mt-1 text-sm">
                      {reasonOptions[d.reason_code as DisputeReasonCode] ??
                        d.reason_code}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("detail.descriptionHeading")}
                    </h3>
                    <p className="mt-1 whitespace-pre-line text-sm">
                      {d.description}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("detail.evidenceHeading")}
                    </h3>
                    <div className="mt-2">
                      <EvidenceList
                        evidence={evidence}
                        locale={locale}
                        labels={{
                          empty: t("detail.evidenceEmpty"),
                          visibleToOther: t("detail.evidenceVisibleToOther"),
                          private: t("detail.evidencePrivate"),
                          submittedBy: t("detail.submittedBy"),
                          downloadFile: t("detail.downloadFile"),
                        }}
                        getSignedUrl={getEvidenceUrlAction}
                      />
                    </div>
                  </div>
                  {isActive ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <AddNoteForm
                        disputeId={d.id}
                        action={submitNoteBound}
                        labels={{
                          heading: t("evidence.addNoteHeading"),
                          noteLabel: t("evidence.noteLabel"),
                          notePlaceholder: t("evidence.notePlaceholder"),
                          visibilityLabel: t("evidence.visibilityLabel"),
                          submit: t("evidence.submitNote"),
                        }}
                      />
                      <UploadFileForm
                        disputeId={d.id}
                        action={submitFileBound}
                        labels={{
                          heading: t("evidence.uploadHeading"),
                          fileLabel: t("evidence.fileLabel"),
                          visibilityLabel: t("evidence.visibilityLabel"),
                          submit: t("evidence.submitFile"),
                        }}
                      />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      {openCtx.ok && !viewerHasFiled ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("openTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("windowHint")}</p>
          </CardHeader>
          <CardContent>
            <OpenDisputeForm
              bookingId={id}
              action={boundOpenAction}
              labels={{
                reasonLabel: t("form.reasonLabel"),
                reasonPlaceholder: t("form.reasonPlaceholder"),
                descriptionLabel: t("form.descriptionLabel"),
                descriptionPlaceholder: t("form.descriptionPlaceholder"),
                submit: t("form.submit"),
                reasonOptions,
              }}
            />
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
