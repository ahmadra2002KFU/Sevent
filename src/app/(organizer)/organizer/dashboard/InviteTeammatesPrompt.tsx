import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, MailPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Soft prompt shown to owner/admin viewers of a 1-person company.
 *
 * The journey from "I just set up a company" → "I have a team to manage"
 * has an awkward gap: the dashboard renders the normal organizer UI with
 * no hint that invites are even a thing. This card surfaces the next
 * step inline and disappears as soon as a second member joins.
 *
 * Renders nothing for member-role viewers — they don't have invite
 * permissions, so prompting them would be misleading.
 */
export async function InviteTeammatesPrompt({
  role,
}: {
  role: "owner" | "admin";
}) {
  const t = await getTranslations("organizer.dashboard.inviteTeammates");
  return (
    <Card className="border-dashed border-brand-cobalt-100 bg-brand-cobalt-100/30">
      <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white text-brand-cobalt-500">
            <MailPlus className="size-5" aria-hidden />
          </span>
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold text-brand-navy-900">
              {t("title")}
            </p>
            <p className="text-xs text-muted-foreground">
              {role === "owner" ? t("subtitleOwner") : t("subtitleAdmin")}
            </p>
          </div>
        </div>
        <Button asChild size="sm" className="w-fit shrink-0">
          <Link href="/organizer/settings/invites">
            <MailPlus aria-hidden />
            {t("cta")}
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
