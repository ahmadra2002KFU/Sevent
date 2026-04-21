import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import {
  StatusPill,
  type StatusPillStatus,
} from "@/components/ui-ext/StatusPill";
import { authenticateAndGetAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

type RfqDetail = {
  id: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  requirements_jsonb: unknown;
  events: {
    id: string;
    event_type: string;
    client_name: string | null;
    city: string;
    starts_at: string;
    ends_at: string;
    guest_count: number | null;
  } | null;
  parent: { id: string; name_en: string } | null;
  sub: { id: string; name_en: string } | null;
};

type InviteDetail = {
  id: string;
  source: string;
  status: string;
  sent_at: string;
  response_due_at: string;
  responded_at: string | null;
  decline_reason_code: string | null;
  suppliers: {
    id: string;
    business_name: string;
    slug: string;
    base_city: string;
  } | null;
};

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function toPillStatus(raw: string): StatusPillStatus {
  const allowed: StatusPillStatus[] = [
    "draft",
    "pending",
    "sent",
    "quoted",
    "invited",
    "awaiting_supplier",
    "accepted",
    "confirmed",
    "booked",
    "approved",
    "paid",
    "completed",
    "declined",
    "rejected",
    "cancelled",
    "expired",
    "withdrawn",
  ];
  return (allowed as string[]).includes(raw)
    ? (raw as StatusPillStatus)
    : "draft";
}

function PrettyRequirements({ req }: { req: unknown }) {
  if (!req || typeof req !== "object")
    return <p className="text-sm">—</p>;
  const obj = req as Record<string, unknown>;
  const kind = typeof obj.kind === "string" ? obj.kind : "unknown";

  const rows: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(obj)) {
    if (key === "kind") continue;
    let display: string;
    if (Array.isArray(value)) {
      display = value.length === 0 ? "—" : value.join(", ");
    } else if (typeof value === "boolean") {
      display = value ? "Yes" : "No";
    } else if (value === null || value === undefined || value === "") {
      display = "—";
    } else {
      display = String(value);
    }
    rows.push([key, display]);
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="inline-flex w-fit items-center rounded-full bg-brand-cobalt-100 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-brand-cobalt-500">
        {kind}
      </span>
      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-col">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {k}
            </dt>
            <dd className="text-sm">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default async function OrganizerRfqDetailPage({ params }: PageProps) {
  const { id } = await params;
  const t = await getTranslations("organizer.rfqs");
  const eventFormT = await getTranslations("organizer.eventForm");

  const auth = await authenticateAndGetAdminClient();
  if (!auth) redirect(`/sign-in?next=/organizer/rfqs/${id}`);
  const { user, admin } = auth;

  const { data: rfqData } = await admin
    .from("rfqs")
    .select(
      `id, status, sent_at, created_at, requirements_jsonb,
       events ( id, event_type, client_name, city, starts_at, ends_at, guest_count, organizer_id ),
       parent:categories!rfqs_category_id_fkey ( id, name_en ),
       sub:categories!rfqs_subcategory_id_fkey ( id, name_en )`,
    )
    .eq("id", id)
    .maybeSingle();

  const rfq = rfqData as unknown as
    | (RfqDetail & {
        events:
          | (RfqDetail["events"] & { organizer_id?: string })
          | null;
      })
    | null;
  if (!rfq) notFound();

  const ownsEvent = rfq.events?.organizer_id === user.id;
  if (!ownsEvent) {
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = (profile as { role: string } | null)?.role;
    if (role !== "admin") notFound();
  }

  const { data: invitesData } = await admin
    .from("rfq_invites")
    .select(
      `id, source, status, sent_at, response_due_at, responded_at, decline_reason_code,
       suppliers ( id, business_name, slug, base_city )`,
    )
    .eq("rfq_id", id)
    .order("sent_at", { ascending: true });

  const invites = (invitesData ?? []) as unknown as InviteDetail[];

  const { count: sentQuoteCount } = await admin
    .from("quotes")
    .select("id", { count: "exact", head: true })
    .eq("rfq_id", id)
    .eq("status", "sent");

  const title = `${rfq.parent?.name_en ?? "RFQ"}${
    rfq.sub ? ` · ${rfq.sub.name_en}` : ""
  }`;

  return (
    <section className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" asChild>
        <Link
          href={
            rfq.events
              ? `/organizer/events/${rfq.events.id}`
              : "/organizer/rfqs"
          }
        >
          <ArrowLeft className="rtl:rotate-180" aria-hidden />
          {rfq.events ? t("backToEvent") : t("backToRfqs")}
        </Link>
      </Button>

      <PageHeader
        title={title}
        description={
          rfq.events
            ? `${eventFormT(`eventType.${rfq.events.event_type}` as never)}${
                rfq.events.client_name ? ` · ${rfq.events.client_name}` : ""
              } · ${rfq.events.city} · ${fmt(rfq.events.starts_at)}`
            : t("detailEyebrow")
        }
        actions={
          <>
            <StatusPill
              status={toPillStatus(rfq.status)}
              label={t(`status.${rfq.status}` as never)}
            />
            {sentQuoteCount && sentQuoteCount > 0 ? (
              <Button size="lg" asChild>
                <Link href={`/organizer/rfqs/${id}/quotes`}>
                  <FileCheck aria-hidden />
                  {t("compareQuotes")} ({sentQuoteCount})
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-lg">
            {t("requirementsHeading")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <PrettyRequirements req={rfq.requirements_jsonb} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-lg">{t("invitesHeading")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {invites.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              {t("noInvites")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">
                    {t("invitesTable.supplier")}
                  </TableHead>
                  <TableHead className="px-4">
                    {t("invitesTable.source")}
                  </TableHead>
                  <TableHead className="px-4">
                    {t("invitesTable.status")}
                  </TableHead>
                  <TableHead className="px-4">
                    {t("invitesTable.sent")}
                  </TableHead>
                  <TableHead className="px-4">
                    {t("invitesTable.responseDue")}
                  </TableHead>
                  <TableHead className="px-4">
                    {t("invitesTable.responded")}
                  </TableHead>
                  <TableHead className="px-4">
                    {t("invitesTable.declineReason")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-brand-navy-900">
                          {inv.suppliers?.business_name ?? "—"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {inv.suppliers?.base_city ?? ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm">
                      {t(`source.${inv.source}` as never) ?? inv.source}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <StatusPill
                        status={toPillStatus(inv.status)}
                        label={t(`inviteStatus.${inv.status}` as never)}
                      />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                      {fmt(inv.sent_at)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                      {fmt(inv.response_due_at)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                      {fmt(inv.responded_at)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm">
                      {inv.decline_reason_code ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
