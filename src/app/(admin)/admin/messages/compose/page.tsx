import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";

import { requireAccess } from "@/lib/auth/access";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui-ext/PageHeader";

import { ComposeForm } from "./_components/ComposeForm";

export const dynamic = "force-dynamic";

export default async function AdminComposePage() {
  await requireAccess("messaging.admin.write");
  const t = await getTranslations("admin.messages.composeForm");
  const tRoles = await getTranslations("admin.messages.filters.role");

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
        labels={{
          targetType: t("targetType"),
          targetTypeUser: t("targetTypeUser"),
          targetTypeRole: t("targetTypeRole"),
          targetTypeAll: t("targetTypeAll"),
          userSearch: t("userSearch"),
          userSearchPlaceholder: t("userSearchPlaceholder"),
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
          errorNotFound: "No user matched that email.",
          errorGeneric: "Couldn't send the message.",
        }}
      />
    </section>
  );
}
