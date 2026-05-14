import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";

import { requireAccess } from "@/lib/auth/access";
import { getUserWithEmail } from "@/lib/admin/users";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui-ext/PageHeader";

import { ComposeForm } from "./_components/ComposeForm";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminComposePage({
  searchParams,
}: {
  searchParams: Promise<{ user_id?: string }>;
}) {
  const { admin } = await requireAccess("messaging.admin.write");
  const t = await getTranslations("admin.messages.composeForm");
  const tRoles = await getTranslations("admin.messages.filters.role");

  // When opened from the users list (`?user_id=`), resolve the recipient so the
  // form can show a locked recipient card instead of any free-text input.
  const params = await searchParams;
  const rawUserId = params.user_id?.trim();
  let preselectedUser: { id: string; name: string; email: string | null } | null =
    null;
  if (rawUserId && UUID_RE.test(rawUserId)) {
    const found = await getUserWithEmail(admin, rawUserId);
    if (found) {
      preselectedUser = {
        id: found.id,
        name: found.full_name?.trim() || found.email || found.id,
        email: found.email,
      };
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ms-2">
          <Link href="/admin/messages">
            <ArrowLeft className="me-1 size-4" />
            {t("back")}
          </Link>
        </Button>
      </div>

      <PageHeader title={t("title")} />

      <ComposeForm
        preselectedUser={preselectedUser}
        labels={{
          targetType: t("targetType"),
          targetTypeUser: t("targetTypeUser"),
          targetTypeRole: t("targetTypeRole"),
          targetTypeAll: t("targetTypeAll"),
          recipientLabel: t("recipientLabel"),
          noUserSelected: t("noUserSelected"),
          pickUserCta: t("pickUserCta"),
          role: t("role"),
          roleLabels: {
            supplier: tRoles("supplier"),
            organizer: tRoles("organizer"),
            admin: tRoles("admin"),
            agency: tRoles("agency"),
          },
          subject: t("subject"),
          subjectPlaceholder: t("subjectPlaceholder"),
          body: t("body"),
          bodyPlaceholder: t("bodyPlaceholder"),
          send: t("send"),
          sending: t("sending"),
          successSingle: t("successSingle"),
          successBulk: t("successBulk", { count: 0 }),
          errorEmpty: t("errorEmpty"),
          errorNoTarget: t("errorNoTarget"),
          errorTooMany: t("errorTooMany", { limit: 5000 }),
          errorNotFound: t("errorNotFound"),
          errorGeneric: "Couldn't send the message.",
        }}
      />
    </section>
  );
}
