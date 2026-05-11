import { getTranslations } from "next-intl/server";
import { MonitorTabs } from "./_components/MonitorTabs";

/**
 * Shared layout for the admin monitor scope (RFQs / Applications / Proposals).
 *
 * The route group `(monitor)` doesn't change the URLs — `/admin/rfqs`,
 * `/admin/applications`, `/admin/proposals` all flow through this layout — it
 * only injects the cross-page tab bar so the three views feel like one
 * "Monitor" surface.
 *
 * Each child page still runs `requireRole("admin")` itself, mirroring the
 * dashboard and verifications pattern. The layout intentionally does not
 * duplicate the role gate so that page-level error/redirect rendering stays
 * the single source of truth for unauthorized access.
 */
export default async function MonitorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("admin.monitor.tabs");
  const tabs = [
    { href: "/admin/rfqs", label: t("rfqs") },
    { href: "/admin/applications", label: t("applications") },
    { href: "/admin/proposals", label: t("proposals") },
  ];

  return (
    <div className="flex flex-col gap-6">
      <MonitorTabs tabs={tabs} />
      {children}
    </div>
  );
}
