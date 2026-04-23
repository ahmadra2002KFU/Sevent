import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import {
  StatusPill,
  type StatusPillStatus,
} from "@/components/ui-ext/StatusPill";
import { requireAccess } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

type RfqRow = {
  id: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  events: {
    id: string;
    event_type: string;
    client_name: string | null;
    starts_at: string;
    city: string;
  } | null;
  parent: { id: string; slug: string; name_en: string } | null;
  sub: { id: string; slug: string; name_en: string } | null;
  rfq_invites: Array<{
    id: string;
    response_due_at: string;
    status: string;
  }>;
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
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

function responseRate(
  invites: Array<{ status: string }>,
): { rate: number; responded: number; total: number } {
  const total = invites?.length ?? 0;
  if (total === 0) return { rate: 0, responded: 0, total: 0 };
  const responded = invites.filter(
    (i) => i.status === "quoted" || i.status === "declined",
  ).length;
  return { rate: Math.round((responded / total) * 100), responded, total };
}

export default async function OrganizerRfqsPage() {
  const t = await getTranslations("organizer.rfqs");
  const eventFormT = await getTranslations("organizer.eventForm");

  const { user, admin } = await requireAccess("organizer.rfqs");

  const { data } = await admin
    .from("rfqs")
    .select(
      `id, status, sent_at, created_at,
       events!inner ( id, event_type, client_name, starts_at, city, organizer_id ),
       parent:categories!rfqs_category_id_fkey ( id, slug, name_en ),
       sub:categories!rfqs_subcategory_id_fkey ( id, slug, name_en ),
       rfq_invites ( id, response_due_at, status )`,
    )
    .eq("events.organizer_id", user.id)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as RfqRow[];

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button size="lg" asChild>
            <Link href="/organizer/rfqs/new">
              <Sparkles aria-hidden />
              {t("newRfq")}
            </Link>
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t("empty")}
          description={t("emptyDescription")}
          action={
            <Button asChild>
              <Link href="/organizer/events">{t("emptyAction")}</Link>
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">{t("table.subcategory")}</TableHead>
                <TableHead className="px-4">{t("table.event")}</TableHead>
                <TableHead className="px-4">{t("table.sentAt")}</TableHead>
                <TableHead className="px-4">{t("table.invites")}</TableHead>
                <TableHead className="px-4">
                  {t("table.responseRate")}
                </TableHead>
                <TableHead className="px-4">{t("table.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const rr = responseRate(row.rfq_invites ?? []);
                return (
                  <TableRow key={row.id} className="group">
                    <TableCell className="px-4 py-3">
                      <Link
                        href={`/organizer/rfqs/${row.id}`}
                        className="flex flex-col outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                      >
                        <span className="font-medium text-brand-navy-900 group-hover:text-brand-cobalt-500">
                          {row.sub?.name_en ?? "—"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {row.parent?.name_en ?? ""}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {row.events
                            ? eventFormT(
                                `eventType.${row.events.event_type}` as never,
                              )
                            : "—"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {row.events?.city ?? ""}
                          {row.events?.starts_at
                            ? ` · ${fmtDate(row.events.starts_at)}`
                            : ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                      {fmtDate(row.sent_at ?? row.created_at)}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-brand-cobalt-100 px-2.5 py-0.5 text-xs font-medium text-brand-cobalt-500">
                        {row.rfq_invites?.length ?? 0}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200">
                          <div
                            className="h-full bg-brand-cobalt-500 transition-all"
                            style={{ width: `${rr.rate}%` }}
                            aria-hidden
                          />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {rr.responded}/{rr.total}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <StatusPill
                        status={toPillStatus(row.status)}
                        label={t(`status.${row.status}` as never)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </section>
  );
}
