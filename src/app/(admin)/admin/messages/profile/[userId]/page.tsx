import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileBody } from "@/components/admin/profile/ProfileBody";

export const dynamic = "force-dynamic";

/**
 * Full-page fallback for the profile viewer. Reached on direct visits or
 * hard reloads of `/admin/messages/profile/<userId>` — the App Router only
 * activates the intercepting slot on client-side soft navigation, so this
 * route handles bookmarks and pasted URLs without breaking the experience.
 *
 * Auth + data are owned by `ProfileBody`; this wrapper supplies the page
 * chrome (back link + title) that the Sheet otherwise provides.
 */
export default async function FullPageProfile({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const t = await getTranslations("admin.profileViewer");
  const tMessages = await getTranslations("admin.messages");

  return (
    <section className="flex flex-col gap-6">
      <Button asChild variant="link" size="sm" className="w-fit px-0">
        <Link href="/admin/messages">
          <ArrowLeft aria-hidden />
          {tMessages("thread.back")}
        </Link>
      </Button>
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("sheetTitle")}
      </h1>
      <ProfileBody userId={userId} />
    </section>
  );
}
