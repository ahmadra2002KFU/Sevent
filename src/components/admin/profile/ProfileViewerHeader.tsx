import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui-ext/StatusPill";
import {
  SupplierLogo,
  hasStaleApproval,
  verificationStatusPill,
} from "./shared";
import type { SupplierVerificationStatus } from "@/lib/supabase/types";

/**
 * Compact header for the Sheet view: logo + name + role badge + (when
 * applicable) verification status pill and a "papers updated since last
 * review" callout. The verifications detail page keeps its own larger
 * `PageHeader`-based header — this component is purpose-built for the
 * tighter Sheet column.
 */
export async function ProfileViewerHeader({
  fullName,
  email,
  role,
  logoUrl,
  initial,
  verificationStatus,
  papersChangedAt,
  verifiedAt,
}: {
  fullName: string;
  email: string | null;
  role: "supplier" | "organizer" | "admin" | "agency";
  logoUrl: string | null;
  initial: string;
  verificationStatus?: SupplierVerificationStatus | null;
  papersChangedAt?: string | null;
  verifiedAt?: string | null;
}) {
  const t = await getTranslations("admin.profileViewer");
  const tRole = await getTranslations("admin.profileViewer.roleBadge");
  const stale = hasStaleApproval(papersChangedAt, verifiedAt);

  return (
    <header className="flex items-start gap-4">
      <SupplierLogo
        logoUrl={logoUrl}
        initial={initial}
        missingLabel={t("logoMissing")}
        headingLabel={fullName}
        size="size-16"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h2 className="truncate text-lg font-semibold text-foreground">
          {fullName}
        </h2>
        {email ? (
          <a
            href={`mailto:${email}`}
            className="truncate text-xs text-brand-cobalt-500 underline-offset-2 hover:underline"
          >
            {email}
          </a>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-xs font-medium">
            {tRole(role)}
          </Badge>
          {verificationStatus ? (
            <StatusPill status={verificationStatusPill(verificationStatus)} />
          ) : null}
          {stale ? (
            <span className="inline-flex items-center rounded-full border border-semantic-warning-500/40 bg-semantic-warning-100 px-2 py-0.5 text-xs font-medium text-semantic-warning-500">
              {t("supplier.papersUpdated")}
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
