import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { requireAccess } from "@/lib/auth/access";
import { MembersTable, type MemberRow } from "./members-table";
import {
  MembershipAuditLog,
  type AuditEventRow,
} from "./membership-audit-log";

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

  // Audit log — last 50 events for this company. Render below the active
  // members table so admins can see recent invite/role/remove activity
  // without leaving the page. Actor + target names are resolved by
  // joining through profiles in a follow-up batch (some events have
  // target_profile_id=null, e.g. plain `invited` rows where the invitee
  // doesn't have a profile yet).
  const { data: eventRows } = await admin
    .from("organizer_membership_events")
    .select(
      "id, action, actor_profile_id, target_profile_id, from_role, to_role, metadata, created_at",
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(50);

  const rawEvents = (eventRows ?? []) as Array<{
    id: string;
    action: AuditEventRow["action"];
    actor_profile_id: string | null;
    target_profile_id: string | null;
    from_role: AuditEventRow["from_role"];
    to_role: AuditEventRow["to_role"];
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>;

  const eventProfileIds = Array.from(
    new Set(
      rawEvents
        .flatMap((e) => [e.actor_profile_id, e.target_profile_id])
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const profileNames = new Map<string, string | null>();
  if (eventProfileIds.length > 0) {
    const { data: profileRows } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", eventProfileIds);
    for (const p of (profileRows ?? []) as Array<{
      id: string;
      full_name: string | null;
    }>) {
      profileNames.set(p.id, p.full_name);
    }
  }

  const events: AuditEventRow[] = rawEvents.map((e) => ({
    id: e.id,
    action: e.action,
    actor_profile_id: e.actor_profile_id,
    target_profile_id: e.target_profile_id,
    from_role: e.from_role,
    to_role: e.to_role,
    metadata: e.metadata ?? {},
    created_at: e.created_at,
    actorName: e.actor_profile_id
      ? profileNames.get(e.actor_profile_id) ?? null
      : null,
    targetName: e.target_profile_id
      ? profileNames.get(e.target_profile_id) ?? null
      : null,
  }));

  return (
    <div className="flex flex-col gap-8">
      <MembersTable
        members={members}
        viewerRole={decision.companyRole}
        viewerProfileId={user.id}
      />
      <MembershipAuditLog events={events} />
    </div>
  );
}
