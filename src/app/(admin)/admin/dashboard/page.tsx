import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";

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

  // 3) Verification queue preview — 3 oldest pending suppliers.
  const { data: pendingPreviewData } = await admin
    .from("suppliers")
    .select("id, business_name, base_city, created_at")
    .eq("verification_status", "pending")
    .order("created_at", { ascending: true })
    .limit(3);
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
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {t("subtitle")}
        </p>
      </header>

      {/* Supplier status mix */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t("supplierMix.pending")}
          value={pendingCount}
          href="/admin/verifications?status=pending"
          tone="warning"
        />
        <StatCard
          label={t("supplierMix.approved")}
          value={approvedCount}
          href="/admin/verifications?status=approved"
          tone="success"
        />
        <StatCard
          label={t("supplierMix.rejected")}
          value={rejectedCount}
          href="/admin/verifications?status=rejected"
          tone="danger"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Verification queue preview */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {t("verificationQueue.heading")}
            </h2>
            <Link
              href="/admin/verifications"
              className="text-sm text-[var(--color-sevent-green,#0a7)] hover:underline"
            >
              {t("verificationQueue.openQueue")}
            </Link>
          </div>
          {pendingPreview.length === 0 ? (
            <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-4 text-sm text-[var(--color-muted-foreground)]">
              {t("verificationQueue.empty")}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pendingPreview.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/admin/verifications/${s.id}`}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-[var(--color-border)] bg-white px-4 py-3 text-sm transition hover:border-[var(--color-sevent-green)] hover:shadow-sm"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{s.business_name}</span>
                      <span className="text-xs text-[var(--color-muted-foreground)]">
                        {s.base_city} · submitted {fmtDate(s.created_at)}
                      </span>
                    </div>
                    <span className="rounded-full border border-[var(--color-sevent-gold)]/40 bg-[#FFF4DD] px-2 py-0.5 text-xs font-medium text-[#7A5A18]">
                      pending
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent notifications */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {t("notifications.heading")}
            </h2>
          </div>
          {notifications.length === 0 ? (
            <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-4 text-sm text-[var(--color-muted-foreground)]">
              {t("notifications.empty")}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-[var(--color-border)] bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-muted)] text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">
                      {t("notifications.col.kind")}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {t("notifications.col.payload")}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {t("notifications.col.time")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((n) => (
                    <tr
                      key={n.id}
                      className="border-t border-[var(--color-border)] align-top"
                    >
                      <td className="px-3 py-2 font-mono text-xs">{n.kind}</td>
                      <td className="px-3 py-2 text-[var(--color-muted-foreground)]">
                        {summarizePayload(n.payload_jsonb)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-[var(--color-muted-foreground)]">
                        {fmtDateTime(n.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* RFQ monitor — full width */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("rfqMonitor.heading")}</h2>
        {rfqs.length === 0 ? (
          <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-4 text-sm text-[var(--color-muted-foreground)]">
            {t("rfqMonitor.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-[var(--color-border)] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--color-muted)] text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                <tr>
                  <th className="px-3 py-2 font-medium">
                    {t("rfqMonitor.col.event")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("rfqMonitor.col.category")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("rfqMonitor.col.status")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("rfqMonitor.col.invites")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("rfqMonitor.col.sent")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rfqs.map((r) => {
                  const invites = inviteCountByRfq.get(r.id) ?? 0;
                  const eventType = r.events?.event_type
                    ? eventFormT(`eventType.${r.events.event_type}` as never)
                    : "—";
                  const city = r.events?.city ?? "—";
                  const category = r.cat?.name_en ?? "—";
                  const subcategory = r.sub?.name_en ?? "—";
                  return (
                    <tr
                      key={r.id}
                      className="border-t border-[var(--color-border)] align-top"
                    >
                      <td className="px-3 py-2">
                        <span className="font-medium">{eventType}</span>
                        <span className="text-[var(--color-muted-foreground)]">
                          {" · "}
                          {city}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[var(--color-muted-foreground)]">
                        {category}
                        {" · "}
                        {subcategory}
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-muted)] px-2 py-0.5 text-xs font-medium">
                          {rfqT(`status.${r.status}` as never)}
                        </span>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{invites}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-[var(--color-muted-foreground)]">
                        {fmtDateTime(r.sent_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

function StatCard({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  tone: "warning" | "success" | "danger";
}) {
  const toneClasses: Record<typeof tone, string> = {
    warning: "text-[#7A5A18]",
    success: "text-[var(--color-sevent-green)]",
    danger: "text-[#9F1A1A]",
  };
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-lg border border-[var(--color-border)] bg-white p-5 transition hover:border-[var(--color-sevent-green)] hover:shadow-sm"
    >
      <span className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </span>
      <span className={`text-3xl font-semibold ${toneClasses[tone]}`}>
        {value}
      </span>
    </Link>
  );
}
