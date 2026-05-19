import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Building2, ChevronRight, Users } from "lucide-react";

/**
 * Sub-header strip under the dashboard PageHeader for company organizers.
 * Surfaces the active company name + active-member count as a clickable
 * pill that deep-links into Settings → Members. Hidden for individual
 * organizers (no `companyId`) — they don't need it.
 */
export async function CompanyMetaLine({
  companyName,
  memberCount,
  role,
}: {
  companyName: string;
  memberCount: number;
  role: "owner" | "admin" | "member";
}) {
  const t = await getTranslations("organizer.dashboard.companyMeta");
  return (
    <Link
      href="/organizer/settings/members"
      className="-mt-2 inline-flex w-fit items-center gap-3 rounded-full border border-border bg-card px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:border-brand-cobalt-100 hover:text-brand-navy-900"
    >
      <span className="flex items-center gap-1.5">
        <Building2 className="size-3.5" aria-hidden />
        <span className="font-medium text-brand-navy-900">{companyName}</span>
      </span>
      <span className="text-border" aria-hidden>
        ·
      </span>
      <span className="flex items-center gap-1.5">
        <Users className="size-3.5" aria-hidden />
        {t("teammates", { count: memberCount })}
      </span>
      <span className="text-border" aria-hidden>
        ·
      </span>
      <span className="font-medium uppercase tracking-wider text-[10px] text-brand-cobalt-500">
        {t(`role.${role}` as never)}
      </span>
      <ChevronRight className="ms-1 size-3.5 rtl:rotate-180" aria-hidden />
    </Link>
  );
}
