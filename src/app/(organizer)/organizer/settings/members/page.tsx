import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { requireAccess } from "@/lib/auth/access";
import { MembersTable, type MemberRow } from "./members-table";

export const dynamic = "force-dynamic";

// Supabase typegen models a single-row FK join as an array even though the
// underlying constraint is many-to-one, so we accept the array shape here
// and pick element 0 on read.
type MembershipQueryRow = {
  profile_id: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
  profiles:
    | {
        id: string;
        full_name: string | null;
        phone: string | null;
      }
    | Array<{
        id: string;
        full_name: string | null;
        phone: string | null;
      }>
    | null;
};

function pickProfile(
  raw: MembershipQueryRow["profiles"],
): { id: string; full_name: string | null; phone: string | null } | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

/**
 * Members list. Member viewers see roster + their own row highlighted but no
 * action buttons. Admins/owners see role-change + remove actions; ownership
 * transfer is a separate explicit flow exposed only to the active owner.
 */
export default async function OrganizerMembersSettingsPage() {
  const { admin, decision, user } = await requireAccess("organizer.settings");
  const companyId = decision.activeCompanyId;
  if (!companyId) {
    notFound();
  }

  const t = await getTranslations("organizer.settings.members");

  const { data: rows, error } = await admin
    .from("organizer_memberships")
    .select(
      "profile_id, role, joined_at, profiles!organizer_memberships_profile_id_fkey(id, full_name, phone)",
    )
    .eq("company_id", companyId)
    .is("removed_at", null)
    .order("joined_at", { ascending: true });

  if (error) {
    console.error("[settings/members] load failed", error);
    return (
      <Alert variant="destructive">
        <AlertTriangle aria-hidden />
        <AlertDescription>{t("loadError")}</AlertDescription>
      </Alert>
    );
  }

  // Fetch the email for each member from auth.users via service_role admin
  // API. We do this in one batch and then merge by id. Display-only;
  // missing emails fall back to null.
  const memberships = (rows ?? []) as unknown as MembershipQueryRow[];
  const profileIds = memberships.map((r) => r.profile_id).filter(Boolean);
  const emails = new Map<string, string | null>();
  if (profileIds.length > 0) {
    const { data: usersPage } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: Math.max(profileIds.length, 50),
    });
    if (usersPage?.users) {
      for (const u of usersPage.users) {
        if (profileIds.includes(u.id)) {
          emails.set(u.id, u.email ?? null);
        }
      }
    }
  }

  const members: MemberRow[] = memberships.map((r) => {
    const profile = pickProfile(r.profiles);
    return {
      profileId: r.profile_id,
      fullName: profile?.full_name ?? null,
      email: emails.get(r.profile_id) ?? null,
      phone: profile?.phone ?? null,
      role: r.role,
      joinedAt: r.joined_at,
      isSelf: r.profile_id === user.id,
    };
  });

  return (
    <MembersTable
      members={members}
      viewerRole={decision.companyRole}
      viewerProfileId={user.id}
    />
  );
}
