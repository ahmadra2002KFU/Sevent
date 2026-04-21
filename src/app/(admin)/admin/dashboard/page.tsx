import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  FileWarning,
  Inbox,
  ListChecks,
  XCircle,
} from "lucide-react";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { MetricCard } from "@/components/ui-ext/MetricCard";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { StatusPill } from "@/components/ui-ext/StatusPill";
import type { StatusPillStatus } from "@/components/ui-ext/StatusPill";
import { EmptyState } from "@/components/ui-ext/EmptyState";

export const dynamic = "force-dynamic";

type PendingSupplier = {
  id: string;
  business_name: string;
  base_city: string;
  created_at: string;
};

type AdminRfqRow = {
  id: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  events: {
    id: string;
    city: string;
    event_type: string;
    starts_at: string;
  } | null;
  cat: { id: string; name_en: string } | null;
  sub: { id: string; name_en: string } | null;
};

type AdminNotificationRow = {
  id: string;
  kind: string;
  payload_jsonb: Record<string, unknown> | null;
  created_at: string;
};

function fmtDate(iso: string | null): string {
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

function fmtDateTime(iso: string | null): string {
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

function summarizePayload(
  payload: Record<string, unknown> | null | undefined,
): string {
  if (!payload || typeof payload !== "object") return "—";
  const preferred = ["title", "subject", "message", "summary"] as const;
  for (const key of preferred) {
    const val = payload[key];
    if (typeof val === "string" && val.trim().length > 0) {
      return val.length > 120 ? `${val.slice(0, 117)}…` : val;
    }
  }
  try {
    const json = JSON.stringify(payload);
    return json.length > 120 ? `${json.slice(0, 117)}…` : json;
  } catch {
    return "—";
  }
}

// Map the raw rfq.status + notification.kind strings onto the shared
// StatusPill status union. Anything unknown falls through to "pending"
// (neutral tone) — the visual stays consistent even when a new kind lands
// before this map is updated.
function rfqStatusPill(status: string): StatusPillStatus {
  switch (status) {
    case "draft":
    case "pending":
    case "sent":
    case "quoted":
    case "expired":
    case "booked":
    case "cancelled":
      return status as StatusPillStatus;
    default:
      return "pending";
  }
}

function notificationStatusPill(kind: string): StatusPillStatus {
  if (kind.endsWith(".approved") || kind.endsWith(".accepted")) return "approved";
  if (kind.endsWith(".rejected") || kind.endsWith(".declined")) return "rejected";
  if (kind.endsWith(".created") || kind.endsWith(".sent")) return "sent";
  if (kind.endsWith(".awaiting_supplier")) return "awaiting_supplier";
  if (kind.endsWith(".revised")) return "quoted";
  if (kind.endsWith(".delivery_failed")) return "cancelled";
  return "pending";
}

export default async function AdminDashboardPage() {
  const t = await getTranslations("admin.dashboard");
  const eventFormT = await getTranslations("organizer.eventForm");
  const rfqT = await getTranslations("organizer.rfqs");

  // 1) Re-assert admin role using the user-scoped client.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in?next=/admin/dashboard");
  }

  const admin = createSupabaseServiceRoleClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

  // 2) Supplier status-mix counts (three parallel head/count queries).
  const [pendingCountRes, approvedCountRes, rejectedCountRes] =
    await Promise.all([
      admin
        .from("suppliers")
        .select("id", { count: "exact", head: true })
        .eq("verification_status", "pending"),
      admin
        .from("suppliers")
        .select("id", { count: "exact", head: true })
        .eq("verification_status", "approved"),
      admin
        .from("suppliers")
        .select("id", { count: "exact", head: true })
        .eq("verification_status", "rejected"),
    ]);
  const pendingCount = pendingCountRes.count ?? 0;
  const approvedCount = approvedCountRes.count ?? 0;
  const rejectedCount = rejectedCountRes.count ?? 0;

  // 3) Verification queue preview — 5 oldest pending suppliers.
  const { data: pendingPreviewData } = await admin
    .from("suppliers")
    .select("id, business_name, base_city, created_at")
    .eq("verification_status", "pending")
    .order("created_at", { ascending: true })
    .limit(5);
  const pendingPreview = (pendingPreviewData ?? []) as PendingSupplier[];

  // 4) Recent RFQs — last 10. Primary select joins events + both category rows.
  //    A secondary group-by query collects invite counts keyed by rfq_id.
  // TODO(sprint5): admin RFQ detail view — organizer-scoped detail pages aren't
  // admin-readable today, so this panel is observation-only.
  const { data: rfqsData } = await admin
    .from("rfqs")
    .select(
      `id, status, sent_at, created_at,
       events ( id, city, event_type, starts_at ),
       cat:categories!rfqs_category_id_fkey ( id, name_en ),
       sub:categories!rfqs_subcategory_id_fkey ( id, name_en )`,
    )
    .order("sent_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(10);
  const rfqs = (rfqsData ?? []) as unknown as AdminRfqRow[];

  const rfqIds = rfqs.map((r) => r.id);
  const inviteCountByRfq = new Map<string, number>();
  if (rfqIds.length > 0) {
    const { data: invitesData } = await admin
      .from("rfq_invites")
      .select("rfq_id")
      .in("rfq_id", rfqIds);
    for (const row of (invitesData ?? []) as Array<{ rfq_id: string }>) {
      inviteCountByRfq.set(
        row.rfq_id,
        (inviteCountByRfq.get(row.rfq_id) ?? 0) + 1,
      );
    }
  }

  // 5) Recent notifications — last 10 across all users.
  const { data: notificationsData } = await admin
    .from("notifications")
    .select("id, kind, payload_jsonb, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  const notifications = (notificationsData ?? []) as AdminNotificationRow[];

  return (
    <section className="flex flex-col gap-8">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {/* Supplier status mix — three metric cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label={t("supplierMix.pending")}
          value={pendingCount}
          hint={t("supplierMix.pendingHint")}
          icon={Clock}
          tone="warning"
        />
        <MetricCard
          label={t("supplierMix.approved")}
          value={approvedCount}
          hint={t("supplierMix.approvedHint")}
          icon={CheckCircle2}
          tone="success"
        />
        <MetricCard
          label={t("supplierMix.rejected")}
          value={rejectedCount}
          hint={t("supplierMix.rejectedHint")}
          icon={XCircle}
          tone="danger"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Verification queue preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="size-4 text-brand-cobalt-500" aria-hidden />
              {t("verificationQueue.heading")}
            </CardTitle>
            <CardDescription>
              {t("verificationQueue.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            {pendingPreview.length === 0 ? (
              <EmptyState
                icon={FileWarning}
                title={t("verificationQueue.empty")}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("verificationQueue.col.supplier")}</TableHead>
                    <TableHead>{t("verificationQueue.col.city")}</TableHead>
                    <TableHead>{t("verificationQueue.col.submitted")}</TableHead>
                    <TableHead className="text-end">
                      {t("verificationQueue.col.action")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingPreview.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium text-foreground">
                        {s.business_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.base_city}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {fmtDate(s.created_at)}
                      </TableCell>
                      <TableCell className="text-end">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/admin/verifications/${s.id}`}>
                            {t("verificationQueue.reviewCta")}
                            <ArrowRight aria-hidden />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="mt-3 flex justify-end">
              <Button asChild variant="link" size="sm">
                <Link href="/admin/verifications?filter=pending">
                  {t("verificationQueue.openQueue")}
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="size-4 text-brand-cobalt-500" aria-hidden />
              {t("notifications.heading")}
            </CardTitle>
            <CardDescription>{t("notifications.description")}</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            {notifications.length === 0 ? (
              <EmptyState icon={Inbox} title={t("notifications.empty")} />
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <StatusPill
                          status={notificationStatusPill(n.kind)}
                          label={n.kind.replace(/[._]/g, " ")}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {summarizePayload(n.payload_jsonb)}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {fmtDateTime(n.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* RFQ monitor — full width */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("rfqMonitor.heading")}</CardTitle>
          <CardDescription>{t("rfqMonitor.description")}</CardDescription>
        </CardHeader>
        <CardContent className="pb-4">
          {rfqs.length === 0 ? (
            <EmptyState icon={Inbox} title={t("rfqMonitor.empty")} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("rfqMonitor.col.event")}</TableHead>
                  <TableHead>{t("rfqMonitor.col.category")}</TableHead>
                  <TableHead>{t("rfqMonitor.col.status")}</TableHead>
                  <TableHead className="text-end">
                    {t("rfqMonitor.col.invites")}
                  </TableHead>
                  <TableHead>{t("rfqMonitor.col.sent")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rfqs.map((r) => {
                  const invites = inviteCountByRfq.get(r.id) ?? 0;
                  const eventType = r.events?.event_type
                    ? eventFormT(`eventType.${r.events.event_type}` as never)
                    : "—";
                  const city = r.events?.city ?? "—";
                  const category = r.cat?.name_en ?? "—";
                  const subcategory = r.sub?.name_en ?? "—";
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <span className="font-medium text-foreground">
                          {eventType}
                        </span>
                        <span className="text-muted-foreground">
                          {" · "}
                          {city}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {category}
                        {" · "}
                        {subcategory}
                      </TableCell>
                      <TableCell>
                        <StatusPill
                          status={rfqStatusPill(r.status)}
                          label={rfqT(`status.${r.status}` as never)}
                        />
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {invites}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {fmtDateTime(r.sent_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
