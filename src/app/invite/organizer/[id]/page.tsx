import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, Building2, Crown, ShieldCheck, UserCog } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createSupabaseServiceRoleClient,
  getCurrentUser,
} from "@/lib/supabase/server";
import { AcceptInviteForm } from "./accept-invite-form";

export const dynamic = "force-dynamic";

type InvitePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type InviteContext = {
  inviteId: string;
  token: string;
  email: string;
  role: "admin" | "member";
  companyName: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string;
};

/**
 * Public invite landing page. Reachable without auth so a recipient who
 * doesn't yet have a Sevent account can click the link from email. The
 * actual accept flow is gated server-side: only signed-in organizer-role
 * users can submit the form, and the RPC re-verifies the token.
 *
 * Unauthenticated users get bounced to /sign-up with the invite preserved
 * via `?invite=<id>&t=<token>` so the post-signup redirect can drop them
 * back here. Strict email match is NOT enforced — too many KSA users have
 * multiple email identities — instead we render a warning when the
 * signed-in user's email differs from the invite's recipient.
 */
export default async function OrganizerInviteAcceptPage({
  params,
  searchParams,
}: InvitePageProps) {
  const { id: inviteId } = await params;
  const sp = await searchParams;
  const tokenRaw = sp.t;
  const token =
    typeof tokenRaw === "string"
      ? tokenRaw
      : Array.isArray(tokenRaw)
        ? tokenRaw[0]
        : "";

  const admin = createSupabaseServiceRoleClient();
  const { data: row } = await admin
    .from("organizer_invites")
    .select(
      "id, email, role, status, expires_at, company_id, organizer_companies!organizer_invites_company_id_fkey(name)",
    )
    .eq("id", inviteId)
    .maybeSingle();

  const t = await getTranslations("organizer.invite");

  if (!row) {
    return (
      <Shell title={t("notFoundTitle")} description={t("notFoundDescription")}>
        <Alert variant="destructive">
          <AlertTriangle aria-hidden />
          <AlertDescription>{t("notFoundDescription")}</AlertDescription>
        </Alert>
      </Shell>
    );
  }

  const raw = row as {
    id: string;
    email: string;
    role: "admin" | "member";
    status: "pending" | "accepted" | "revoked" | "expired";
    expires_at: string;
    organizer_companies:
      | { name: string }
      | Array<{ name: string }>
      | null;
  };
  const company = Array.isArray(raw.organizer_companies)
    ? raw.organizer_companies[0]
    : raw.organizer_companies;
  const ctx: InviteContext = {
    inviteId: raw.id,
    token,
    email: raw.email,
    role: raw.role,
    companyName: company?.name ?? "",
    status: raw.status,
    expiresAt: raw.expires_at,
  };

  // Terminal statuses — show an explanatory message + no action.
  if (ctx.status !== "pending") {
    return (
      <Shell
        title={t("title", { company: ctx.companyName })}
        description={t(`status.${ctx.status}` as never)}
      >
        <Alert variant="destructive">
          <AlertTriangle aria-hidden />
          <AlertDescription>{t(`status.${ctx.status}` as never)}</AlertDescription>
        </Alert>
      </Shell>
    );
  }

  // Expired by clock but DB hasn't yet flipped status — treat as expired.
  if (new Date(ctx.expiresAt).getTime() <= Date.now()) {
    return (
      <Shell
        title={t("title", { company: ctx.companyName })}
        description={t("status.expired")}
      >
        <Alert variant="destructive">
          <AlertTriangle aria-hidden />
          <AlertDescription>{t("status.expired")}</AlertDescription>
        </Alert>
      </Shell>
    );
  }

  const user = await getCurrentUser();

  if (!user) {
    // Drop unauthenticated callers into sign-up with the invite preserved.
    // The sign-up flow can read ?invite and ?t and route back here on
    // success.
    const next = `/invite/organizer/${encodeURIComponent(ctx.inviteId)}?t=${encodeURIComponent(ctx.token)}`;
    redirect(
      `/sign-up?role=organizer&invite=${encodeURIComponent(ctx.inviteId)}&next=${encodeURIComponent(next)}`,
    );
  }

  // Authenticated — check role compatibility. A supplier or admin user
  // can't accept an organizer invite without changing roles.
  const { data: profileRow } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const profileRole = (profileRow as { role?: string } | null)?.role ?? null;
  if (profileRole && profileRole !== "organizer" && profileRole !== "agency") {
    return (
      <Shell
        title={t("title", { company: ctx.companyName })}
        description={t("description", { role: t(`role.${ctx.role}` as never) })}
      >
        <Alert variant="destructive">
          <AlertTriangle aria-hidden />
          <AlertDescription>{t("wrongRoleError")}</AlertDescription>
        </Alert>
      </Shell>
    );
  }

  const emailMismatch =
    (user.email ?? "").trim().toLowerCase() !==
    ctx.email.trim().toLowerCase();

  return (
    <Shell
      title={t("title", { company: ctx.companyName })}
      description={t("description", { role: t(`role.${ctx.role}` as never) })}
    >
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="size-5" aria-hidden />
              {ctx.companyName || t("unknownCompany")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              <li className="flex items-center gap-2 text-muted-foreground">
                <RoleIcon role={ctx.role} />
                {t("roleLine", { role: t(`role.${ctx.role}` as never) })}
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <span>•</span>
                {t("expiresOn", {
                  date: new Date(ctx.expiresAt).toISOString().slice(0, 10),
                })}
              </li>
            </ul>
          </CardContent>
        </Card>

        {emailMismatch ? (
          <Alert>
            <AlertTriangle aria-hidden />
            <AlertDescription>
              {t("emailMismatchWarning", {
                signedIn: user.email ?? "",
                invited: ctx.email,
              })}
            </AlertDescription>
          </Alert>
        ) : null}

        <AcceptInviteForm inviteId={ctx.inviteId} token={ctx.token} />
      </div>
    </Shell>
  );
}

function Shell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-6 py-12">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-brand-navy-900 sm:text-3xl">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>
      {children}
    </section>
  );
}

function RoleIcon({ role }: { role: "admin" | "member" }) {
  if (role === "admin") return <ShieldCheck className="size-4" aria-hidden />;
  return <UserCog className="size-4" aria-hidden />;
}
