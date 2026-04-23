import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarCheck,
  CheckCircle2,
  Clock,
  FileCheck,
  FileWarning,
  FileX,
  Inbox,
  Info,
  ListChecks,
  MailWarning,
  MessageSquare,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
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
import {
  fmtDate as fmtDateHelper,
  fmtDateTime as fmtDateTimeHelper,
  type SupportedLocale,
} from "@/lib/domain/formatDate";
import { segmentNameFor } from "@/lib/domain/segments";
import { cityNameFor } from "@/lib/domain/cities";
import { categoryName } from "@/lib/domain/taxonomy";

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
  cat: { id: string; name_en: string; name_ar: string | null } | null;
  sub: { id: string; name_en: string; name_ar: string | null } | null;
};

type AdminNotificationRow = {
  id: string;
  kind: string;
  payload_jsonb: Record<string, unknown> | null;
  created_at: string;
};

type Tone = "success" | "danger" | "warning" | "info" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-semantic-success-100 text-semantic-success-500",
  danger: "bg-semantic-danger-100 text-semantic-danger-500",
  warning: "bg-semantic-warning-100 text-semantic-warning-500",
  info: "bg-brand-cobalt-100 text-brand-cobalt-500",
  neutral: "bg-neutral-200 text-neutral-600",
};

function iconForNotificationKind(kind: string): { icon: LucideIcon; tone: Tone } {
  switch (kind) {
    case "supplier.approved":
      return { icon: CheckCircle2, tone: "success" };
    case "supplier.rejected":
      return { icon: XCircle, tone: "danger" };
    case "supplier.doc.approved":
      return { icon: FileCheck, tone: "success" };
    case "supplier.doc.rejected":
      return { icon: FileX, tone: "danger" };
    case "supplier.email.delivery_failed":
      return { icon: MailWarning, tone: "warning" };
    case "quote.sent":
    case "quote.revised":
      return { icon: MessageSquare, tone: "info" };
    case "quote.accepted":
      return { icon: CheckCircle2, tone: "success" };
    case "quote.rejected":
      return { icon: XCircle, tone: "danger" };
    case "booking.created":
      return { icon: CalendarCheck, tone: "info" };
    case "booking.awaiting_supplier":
      return { icon: AlertTriangle, tone: "warning" };
    default:
      return { icon: Info, tone: "neutral" };
  }
}

function pickString(
  payload: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  if (!payload) return null;
  const v = payload[key];
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

function pickNumber(
  payload: Record<string, unknown> | null | undefined,
  key: string,
): number | null {
  if (!payload) return null;
  const v = payload[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// Map the raw rfq.status strings onto the shared StatusPill status union.
// Anything unknown falls through to "pending" (neutral tone).
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

export default async function AdminDashboardPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations("admin.dashboard");
  const rfqT = await getTranslations("organizer.rfqs");

  const fmtDate = (iso: string | null): string =>
    fmtDateHelper(iso, locale) || "—";
  const fmtDateTime = (iso: string | null): string =>
    fmtDateTimeHelper(iso, locale) || "—";

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
       cat:categories!rfqs_category_id_fkey ( id, name_en, name_ar ),
       sub:categories!rfqs_subcategory_id_fkey ( id, name_en, name_ar )`,
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

  // Resolve supplier_id → business_name for any supplier.* notifications so
  // the admin row body can read "Supplier approved — Acme Events" instead of
  // dumping the raw UUID.
  const supplierIdsInNotifications = Array.from(
    new Set(
      notifications
        .map((n) => pickString(n.payload_jsonb, "supplier_id"))
        .filter((x): x is string => x !== null),
    ),
  );
  const supplierNameById = new Map<string, string>();
  if (supplierIdsInNotifications.length > 0) {
    const { data: supplierNameRows } = await admin
      .from("suppliers")
      .select("id, business_name")
      .in("id", supplierIdsInNotifications);
    for (const row of (supplierNameRows ?? []) as Array<{
      id: string;
      business_name: string;
    }>) {
      supplierNameById.set(row.id, row.business_name);
    }
  }

  const notificationsT = await getTranslations(
    "admin.dashboard.notifications",
  );
  const notificationViews = notifications.map((n) => {
    const payload = n.payload_jsonb;
    const supplierId = pickString(payload, "supplier_id");
    const businessName =
      pickString(payload, "business_name") ??
      (supplierId ? supplierNameById.get(supplierId) ?? null : null);
    const version = pickNumber(payload, "version");
    const reason = pickString(payload, "reason");
    const { icon, tone } = iconForNotificationKind(n.kind);

    // Build a localized per-kind title line. Unknown kinds fall through to a
    // human-readable split of the raw identifier so nothing hard-crashes when
    // the NotificationKind union grows.
    let title: string;
    switch (n.kind) {
      case "supplier.approved":
        title = businessName
          ? notificationsT("kindLine.supplier_approved_named", {
              name: businessName,
            })
          : notificationsT("kindLine.supplier_approved");
        break;
      case "supplier.rejected":
        title = businessName
          ? notificationsT("kindLine.supplier_rejected_named", {
              name: businessName,
            })
          : notificationsT("kindLine.supplier_rejected");
        break;
      case "supplier.doc.approved":
        title = notificationsT("kindLine.supplier_doc_approved");
        break;
      case "supplier.doc.rejected":
        title = notificationsT("kindLine.supplier_doc_rejected");
        break;
      case "supplier.email.delivery_failed":
        title = businessName
          ? notificationsT("kindLine.supplier_email_delivery_failed_named", {
              name: businessName,
            })
          : notificationsT("kindLine.supplier_email_delivery_failed");
        break;
      case "quote.sent":
        title =
          version != null
            ? notificationsT("kindLine.quote_sent_versioned", { version })
            : notificationsT("kindLine.quote_sent");
        break;
      case "quote.revised":
        title =
          version != null
            ? notificationsT("kindLine.quote_revised_versioned", { version })
            : notificationsT("kindLine.quote_revised");
        break;
      case "quote.accepted":
        title = notificationsT("kindLine.quote_accepted");
        break;
      case "quote.rejected":
        title = notificationsT("kindLine.quote_rejected");
        break;
      case "booking.created":
        title = notificationsT("kindLine.booking_created");
        break;
      case "booking.awaiting_supplier":
        title = notificationsT("kindLine.booking_awaiting_supplier");
        break;
      default:
        title = n.kind.replace(/[._]/g, " ");
    }

    let detail: string | null = null;
    if (n.kind === "quote.rejected" && reason === "another_quote_accepted") {
      detail = notificationsT("kindDetail.quote_rejected_another_accepted");
    } else if (
      n.kind === "supplier.email.delivery_failed" &&
      pickString(payload, "error")
    ) {
      detail = pickString(payload, "error");
    }

    // Deep link: admin only routes to /admin/verifications/:id for supplier.*
    // kinds today. Sprint 5 may add /admin/rfqs + /admin/bookings routes.
    const href =
      n.kind.startsWith("supplier.") && supplierId
        ? `/admin/verifications/${supplierId}`
        : null;

    return {
      id: n.id,
      kind: n.kind,
      title,
      detail,
      href,
      icon,
      tone,
      created_at: n.created_at,
    };
  });

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
                        {cityNameFor(s.base_city, locale)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {fmtDate(s.created_at)}
                      </TableCell>
                      <TableCell className="text-end">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/admin/verifications/${s.id}`}>
                            {t("verificationQueue.reviewCta")}
                            <ArrowRight aria-hidden className="rtl:-scale-x-100" />
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
            {notificationViews.length === 0 ? (
              <EmptyState icon={Inbox} title={t("notifications.empty")} />
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {notificationViews.map((n) => {
                  const Icon = n.icon;
                  const row = (
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg",
                          TONE_CLASSES[n.tone],
                        )}
                        aria-hidden
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-sm font-medium text-foreground">
                          {n.title}
                        </span>
                        {n.detail ? (
                          <span className="line-clamp-2 text-xs text-muted-foreground">
                            {n.detail}
                          </span>
                        ) : null}
                      </div>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {fmtDateTime(n.created_at)}
                      </span>
                    </div>
                  );
                  return (
                    <li key={n.id} className="py-3 first:pt-0 last:pb-0">
                      {n.href ? (
                        <Link
                          href={n.href}
                          className="block rounded-md -mx-2 px-2 py-1 transition-colors hover:bg-muted/60"
                        >
                          {row}
                        </Link>
                      ) : (
                        row
                      )}
                    </li>
                  );
                })}
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
                    ? segmentNameFor(r.events.event_type, locale)
                    : "—";
                  const city = r.events?.city
                    ? cityNameFor(r.events.city, locale)
                    : "—";
                  const category = categoryName(r.cat, locale) || "—";
                  const subcategory = categoryName(r.sub, locale) || "—";
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
