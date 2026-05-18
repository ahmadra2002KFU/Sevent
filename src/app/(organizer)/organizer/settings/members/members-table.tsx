"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  Crown,
  Loader2,
  ShieldCheck,
  Trash2,
  UserCog,
  UserMinus,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  changeMemberRoleAction,
  removeMemberAction,
  transferOwnershipAction,
  type MemberMutationState,
} from "./actions";

export type MemberRow = {
  profileId: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  role: "owner" | "admin" | "member";
  joinedAt: string;
  isSelf: boolean;
};

type MembersTableProps = {
  members: MemberRow[];
  viewerRole: "owner" | "admin" | "member" | null;
  viewerProfileId: string;
};

function ts(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

export function MembersTable({
  members,
  viewerRole,
}: MembersTableProps) {
  const t = useTranslations("organizer.settings.members");
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<MemberMutationState>({ status: "idle" });

  const isAdminLike = viewerRole === "owner" || viewerRole === "admin";

  const submit = (
    fn: (
      prev: MemberMutationState | undefined,
      fd: FormData,
    ) => Promise<MemberMutationState>,
    fd: FormData,
  ) => {
    startTransition(async () => {
      const next = await fn(state, fd);
      setState(next);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden />
          <AlertDescription>
            {t(`errors.${state.code}` as never)}
          </AlertDescription>
        </Alert>
      ) : null}
      {state.status === "success" ? (
        <Alert>
          <AlertDescription>
            {t(`success.${state.action}` as never)}
          </AlertDescription>
        </Alert>
      ) : null}

      <ul className="flex flex-col gap-3">
        {members.map((m) => (
          <li
            key={m.profileId}
            className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-brand-navy-900">
                  {m.fullName ?? m.email ?? t("unnamedMember")}
                </span>
                <RoleBadge role={m.role} />
                {m.isSelf ? (
                  <Badge variant="outline">{t("selfBadge")}</Badge>
                ) : null}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {m.email ?? "—"} · {t("joinedOn", { date: ts(m.joinedAt) })}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Role change — only for admins/owner viewing non-owner rows. */}
              {isAdminLike && m.role !== "owner" ? (
                <RoleSelector
                  member={m}
                  pending={pending}
                  onChange={(role) => {
                    const fd = new FormData();
                    fd.set("profile_id", m.profileId);
                    fd.set("new_role", role);
                    submit(changeMemberRoleAction, fd);
                  }}
                />
              ) : null}

              {/* Transfer ownership — only the active owner sees this on
                  other-member rows. */}
              {viewerRole === "owner" && !m.isSelf ? (
                <form
                  action={(fd) => submit(transferOwnershipAction, fd)}
                  className="inline-flex"
                >
                  <input
                    type="hidden"
                    name="profile_id"
                    value={m.profileId}
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                  >
                    {pending ? (
                      <Loader2 className="animate-spin" aria-hidden />
                    ) : (
                      <Crown className="size-4" aria-hidden />
                    )}
                    {t("transferOwnership")}
                  </Button>
                </form>
              ) : null}

              {/* Remove — admins/owner for non-owner rows, plus self-remove
                  for non-owner self (owners must transfer first). */}
              {((isAdminLike && m.role !== "owner") ||
                (m.isSelf && m.role !== "owner")) ? (
                <form
                  action={(fd) => submit(removeMemberAction, fd)}
                  className="inline-flex"
                >
                  <input
                    type="hidden"
                    name="profile_id"
                    value={m.profileId}
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    className="text-destructive hover:text-destructive"
                  >
                    {pending ? (
                      <Loader2 className="animate-spin" aria-hidden />
                    ) : m.isSelf ? (
                      <UserMinus className="size-4" aria-hidden />
                    ) : (
                      <Trash2 className="size-4" aria-hidden />
                    )}
                    {m.isSelf ? t("leaveCompany") : t("removeMember")}
                  </Button>
                </form>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RoleBadge({ role }: { role: MemberRow["role"] }) {
  const t = useTranslations("organizer.settings.members.role");
  if (role === "owner") {
    return (
      <Badge className="bg-brand-gold-100 text-brand-gold-700">
        <Crown className="mr-1 size-3" aria-hidden />
        {t("owner")}
      </Badge>
    );
  }
  if (role === "admin") {
    return (
      <Badge className="bg-brand-cobalt-100 text-brand-cobalt-700">
        <ShieldCheck className="mr-1 size-3" aria-hidden />
        {t("admin")}
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <UserCog className="mr-1 size-3" aria-hidden />
      {t("member")}
    </Badge>
  );
}

function RoleSelector({
  member,
  pending,
  onChange,
}: {
  member: MemberRow;
  pending: boolean;
  onChange: (next: "admin" | "member") => void;
}) {
  const t = useTranslations("organizer.settings.members.role");
  return (
    <Select
      defaultValue={member.role}
      disabled={pending}
      onValueChange={(value) => {
        if (value === "admin" || value === "member") onChange(value);
      }}
    >
      <SelectTrigger className="h-9 w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">{t("admin")}</SelectItem>
        <SelectItem value="member">{t("member")}</SelectItem>
      </SelectContent>
    </Select>
  );
}
