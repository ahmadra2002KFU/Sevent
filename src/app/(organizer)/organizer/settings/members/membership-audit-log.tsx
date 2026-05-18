import { getTranslations } from "next-intl/server";

export type AuditEventRow = {
  id: string;
  action:
    | "joined"
    | "left"
    | "removed"
    | "role_changed"
    | "ownership_transferred"
    | "invited"
    | "invite_revoked"
    | "invite_accepted";
  actor_profile_id: string | null;
  target_profile_id: string | null;
  from_role: "owner" | "admin" | "member" | null;
  to_role: "owner" | "admin" | "member" | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actorName: string | null;
  targetName: string | null;
};

/**
 * Read-only audit timeline rendered below the active members table on the
 * /organizer/settings/members page. Each row summarises one
 * organizer_membership_events entry in localized prose so an admin doesn't
 * need to mentally decode the action enum.
 *
 * Server-rendered — no client state, no JS needed for the timeline itself.
 * Paginate "last 50 events" up front; a true paged view can land later if
 * any single company outgrows that.
 */
export async function MembershipAuditLog({
  events,
}: {
  events: AuditEventRow[];
}) {
  const t = await getTranslations("organizer.settings.members.audit");

  return (
    <section className="flex flex-col gap-3 pt-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight text-brand-navy-900">
          {t("title")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </header>

      {events.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {events.map((evt) => (
            <li
              key={evt.id}
              className="rounded-lg border bg-card px-4 py-3 text-sm"
            >
              <p className="text-foreground">{describe(evt, t)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(evt.created_at).toISOString().replace("T", " ").slice(0, 16)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

type Translator = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;

function actorLabel(evt: AuditEventRow, t: Translator) {
  return evt.actorName ?? t("unknownActor");
}

function targetLabel(evt: AuditEventRow, t: Translator) {
  if (evt.targetName) return evt.targetName;
  const meta = evt.metadata ?? {};
  const email = typeof meta.email === "string" ? meta.email : null;
  return email ?? t("unknownTarget");
}

function roleName(
  role: AuditEventRow["from_role"] | AuditEventRow["to_role"],
  t: Translator,
): string {
  if (!role) return "";
  return t(`role.${role}`);
}

function describe(evt: AuditEventRow, t: Translator): string {
  const actor = actorLabel(evt, t);
  const target = targetLabel(evt, t);
  switch (evt.action) {
    case "joined":
      return t("describe.joined", { actor });
    case "left":
      return t("describe.left", { actor });
    case "removed":
      return t("describe.removed", { actor, target });
    case "role_changed":
      return t("describe.roleChanged", {
        actor,
        target,
        from: roleName(evt.from_role, t),
        to: roleName(evt.to_role, t),
      });
    case "ownership_transferred":
      return t("describe.ownershipTransferred", { actor, target });
    case "invited":
      return t("describe.invited", {
        actor,
        target,
        role: roleName(evt.to_role, t),
      });
    case "invite_revoked":
      return t("describe.inviteRevoked", { actor, target });
    case "invite_accepted":
      return t("describe.inviteAccepted", { actor });
    default:
      return evt.action;
  }
}
