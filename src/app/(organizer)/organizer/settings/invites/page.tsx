import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { requireAccess } from "@/lib/auth/access";
import { InvitesPanel, type InviteRow } from "./invites-panel";

export const dynamic = "force-dynamic";

type InviteQueryRow = {
  id: string;
  email: string;
  role: "admin" | "member";
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

/**
 * Invites surface — list + create + revoke + resend. The listing covers
 * pending + recently-resolved (accepted/revoked/expired in the last 30
 * days) so admins can see invite history at a glance without scrolling
 * past terminal rows for years of activity.
 */
export default async function OrganizerInvitesSettingsPage() {
  const { admin, decision } = await requireAccess("organizer.settings");
  const companyId = decision.activeCompanyId;
  if (!companyId) {
    notFound();
  }

  const t = await getTranslations("organizer.settings.invites");

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows, error } = await admin
    .from("organizer_invites")
    .select(
      "id, email, role, status, expires_at, created_at, accepted_at, revoked_at",
    )
    .eq("company_id", companyId)
    .or(`status.eq.pending,created_at.gte.${cutoff}`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[settings/invites] load failed", error);
    return (
      <Alert variant="destructive">
        <AlertTriangle aria-hidden />
        <AlertDescription>{t("loadError")}</AlertDescription>
      </Alert>
    );
  }

  const invites: InviteRow[] = ((rows ?? []) as InviteQueryRow[]).map((r) => ({
    inviteId: r.id,
    email: r.email,
    role: r.role,
    status: r.status,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
    acceptedAt: r.accepted_at,
    revokedAt: r.revoked_at,
  }));

  const canManage =
    decision.companyRole === "owner" || decision.companyRole === "admin";

  return <InvitesPanel invites={invites} canManage={canManage} />;
}
