/**
 * Supplier proposal-upload page. Reached from the "Upload proposal" CTA in
 * the supplier RFQ detail when the organizer has requested a technical
 * proposal. If there is no pending request (e.g. organizer cancelled, or the
 * supplier visited a stale URL), redirect quietly back to the RFQ detail.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, FileText } from "lucide-react";
import { requireAccess } from "@/lib/auth/access";
import { fmtDateTime, type SupportedLocale } from "@/lib/domain/formatDate";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { ProposalUploadForm } from "./ProposalUploadForm";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function ProposalUploadPage({ params }: PageProps) {
  const { id } = await params;
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations("supplier.rfp");

  const { decision, admin } = await requireAccess("supplier.rfqs.view");
  const supplierId = decision.supplierId;
  if (!supplierId) notFound();

  const { data: inviteRow } = await admin
    .from("rfq_invites")
    .select("id, supplier_id, rfq_id")
    .eq("id", id)
    .maybeSingle();
  const invite = inviteRow as {
    id: string;
    supplier_id: string;
    rfq_id: string;
  } | null;
  if (!invite || invite.supplier_id !== supplierId) notFound();

  const { data: quoteRow } = await admin
    .from("quotes")
    .select("id, supplier_id")
    .eq("rfq_id", invite.rfq_id)
    .eq("supplier_id", supplierId)
    .maybeSingle();
  const quote = quoteRow as { id: string; supplier_id: string } | null;
  if (!quote) {
    // No quote yet — go submit the quote instead.
    redirect(`/supplier/rfqs/${id}`);
  }

  const { data: reqRow } = await admin
    .from("quote_proposal_requests")
    .select("id, status, message, requested_at")
    .eq("quote_id", quote.id)
    .eq("status", "pending")
    .maybeSingle();
  const request = reqRow as {
    id: string;
    status: "pending";
    message: string | null;
    requested_at: string;
  } | null;
  if (!request) {
    // Stale URL — quietly bounce back to the RFQ detail.
    redirect(`/supplier/rfqs/${id}`);
  }

  return (
    <section className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" asChild>
        <Link href={`/supplier/rfqs/${id}`}>
          <ArrowLeft className="rtl:rotate-180" aria-hidden />
          {t("backToRfq")}
        </Link>
      </Button>

      <PageHeader
        title={t("uploadPageTitle")}
        description={t("uploadPageDescription")}
      />

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 border-b">
          <FileText className="size-4 text-brand-cobalt-500" aria-hidden />
          <div>
            <CardTitle>{t("requestCardTitle")}</CardTitle>
            <CardDescription>
              {t("requestCardSubtitle", {
                date: fmtDateTime(request.requested_at, locale) || "",
              })}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {request.message ? (
            <p className="mb-4 whitespace-pre-line rounded-md border bg-muted/30 p-3 text-sm">
              {request.message}
            </p>
          ) : null}
          <ProposalUploadForm inviteId={invite.id} />
        </CardContent>
      </Card>
    </section>
  );
}
