"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MailPlus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createInviteAction,
  resendInviteAction,
  revokeInviteAction,
  type InviteMutationState,
} from "./actions";
import { canInviteAtRole } from "@/lib/auth/companyPermissions";

export type InviteRow = {
  inviteId: string;
  email: string;
  role: "admin" | "member";
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
};

type InvitesPanelProps = {
  invites: InviteRow[];
  canManage: boolean;
  /**
   * The viewer's company role. Needed on top of `canManage` because
   * `create_organizer_invite_tx` refuses an admin-role invite issued by an
   * admin (P0061) — only owners may mint admins. Without the exact role the
   * panel would offer a choice the server rejects (review finding F4).
   */
  viewerRole: "owner" | "admin" | "member" | null;
};

function ts(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

const initial: InviteMutationState = { status: "idle" };

export function InvitesPanel({
  invites,
  canManage,
  viewerRole,
}: InvitesPanelProps) {
  const t = useTranslations("organizer.settings.invites");
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<InviteMutationState>(initial);
  const [emailValue, setEmailValue] = useState("");
  const [roleValue, setRoleValue] = useState<"admin" | "member">("member");

  // Only owners may issue admin invites (P0061). Admins get a member-only
  // form; hiding the option beats surfacing an error after submit.
  const canInviteAdmin = canInviteAtRole(viewerRole, "admin");

  const submit = (
    fn: (
      prev: InviteMutationState | undefined,
      fd: FormData,
    ) => Promise<InviteMutationState>,
    fd: FormData,
    onSuccess?: () => void,
  ) => {
    startTransition(async () => {
      const next = await fn(state, fd);
      setState(next);
      if (next.status === "success" && onSuccess) onSuccess();
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Create form */}
      {canManage ? (
        <form
          action={(fd) => {
            // Mirror the controlled state into the FormData since the email
            // input + select are controlled below.
            fd.set("email", emailValue);
            fd.set("role", roleValue);
            submit(createInviteAction, fd, () => {
              setEmailValue("");
              setRoleValue("member");
            });
          }}
          className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[minmax(0,1fr)_140px_auto] sm:items-end"
          noValidate
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-email">{t("emailLabel")}</Label>
            <Input
              id="invite-email"
              type="email"
              required
              maxLength={255}
              placeholder={t("emailPlaceholder")}
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-role">{t("roleLabel")}</Label>
            <Select
              value={roleValue}
              onValueChange={(v) => {
                if (v === "admin" || v === "member") setRoleValue(v);
              }}
            >
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {canInviteAdmin ? (
                  <SelectItem value="admin">{t("role.admin")}</SelectItem>
                ) : null}
                <SelectItem value="member">{t("role.member")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="submit"
            disabled={pending || emailValue.trim().length === 0}
            className="sm:w-fit"
          >
            {pending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <MailPlus aria-hidden />
            )}
            {t("submit")}
          </Button>
        </form>
      ) : null}

      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden />
          <AlertDescription>
            {t(`errors.${state.code}` as never)}
          </AlertDescription>
        </Alert>
      ) : null}
      {state.status === "success" ? (
        state.action !== "revoke" && state.emailQueued === false ? (
          <Alert className="border-brand-gold-400 [&>svg]:text-brand-gold-700">
            <AlertTriangle aria-hidden />
            <AlertDescription>{t("success.emailQueueWarning")}</AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <CheckCircle2 aria-hidden />
            <AlertDescription>
              {t(`success.${state.action}` as never)}
            </AlertDescription>
          </Alert>
        )
      ) : null}

      {invites.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {invites.map((iv) => (
            <li
              key={iv.inviteId}
              className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-brand-navy-900">
                    {iv.email}
                  </span>
                  <StatusBadge status={iv.status} />
                  <Badge variant="outline">
                    {t(`role.${iv.role}` as never)}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {iv.status === "pending"
                    ? t("expiresOn", { date: ts(iv.expiresAt) })
                    : iv.status === "accepted"
                      ? t("acceptedOn", {
                          date: ts(iv.acceptedAt ?? iv.createdAt),
                        })
                      : iv.status === "revoked"
                        ? t("revokedOn", {
                            date: ts(iv.revokedAt ?? iv.createdAt),
                          })
                        : t("createdOn", { date: ts(iv.createdAt) })}
                </p>
              </div>
              {canManage && iv.status === "pending" ? (
                <div className="flex items-center gap-2">
                  <form
                    action={(fd) => submit(resendInviteAction, fd)}
                    className="inline-flex"
                  >
                    <input
                      type="hidden"
                      name="invite_id"
                      value={iv.inviteId}
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
                        <RotateCcw className="size-4" aria-hidden />
                      )}
                      {t("resend")}
                    </Button>
                  </form>
                  <form
                    action={(fd) => submit(revokeInviteAction, fd)}
                    className="inline-flex"
                  >
                    <input
                      type="hidden"
                      name="invite_id"
                      value={iv.inviteId}
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
                      ) : (
                        <Trash2 className="size-4" aria-hidden />
                      )}
                      {t("revoke")}
                    </Button>
                  </form>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: InviteRow["status"] }) {
  const t = useTranslations("organizer.settings.invites.status");
  if (status === "pending") {
    return (
      <Badge className="bg-brand-cobalt-100 text-brand-cobalt-700">
        {t("pending")}
      </Badge>
    );
  }
  if (status === "accepted") {
    return (
      <Badge className="bg-success/15 text-success">{t("accepted")}</Badge>
    );
  }
  if (status === "revoked") {
    return <Badge variant="outline">{t("revoked")}</Badge>;
  }
  return <Badge variant="outline">{t("expired")}</Badge>;
}
