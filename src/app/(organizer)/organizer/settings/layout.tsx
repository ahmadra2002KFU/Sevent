import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAccess } from "@/lib/auth/access";
import { SettingsSideNav, type SettingsNavItem } from "./SettingsSideNav";

export const dynamic = "force-dynamic";

/**
 * Shared shell for /organizer/settings/{company,members,invites}.
 *
 * Gating: requireAccess("organizer.settings") admits `organizer.active`. We
 * additionally short-circuit to `/organizer/dashboard` when the resolver
 * could not pin an active company — i.e. when the caller is an individual
 * organizer or when the kill-switch is engaged. The Settings section
 * doesn't apply to those users.
 *
 * The shared shell renders an in-page side-nav with the three tabs and a
 * heading. Each child page renders inside the right column.
 */
export default async function OrganizerSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { decision } = await requireAccess("organizer.settings");
  if (!decision.activeCompanyId) {
    redirect("/organizer/dashboard");
  }
  const t = await getTranslations("organizer.settings");

  const items: SettingsNavItem[] = [
    {
      href: "/organizer/settings/company",
      label: t("nav.company"),
      iconKey: "company",
    },
    {
      href: "/organizer/settings/members",
      label: t("nav.members"),
      iconKey: "members",
    },
    {
      href: "/organizer/settings/invites",
      label: t("nav.invites"),
      iconKey: "invites",
    },
  ];

  return (
    <section className="flex flex-col gap-6 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-brand-navy-900">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
        <SettingsSideNav items={items} />
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}
