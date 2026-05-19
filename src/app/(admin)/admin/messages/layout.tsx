import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { ProfileViewerSheet } from "@/components/admin/profile/ProfileViewerSheet";

/**
 * Hosts the `@profile` parallel slot used by the admin messages surface.
 *
 * The slot is opt-in via path: navigating to `/admin/messages/profile/<id>`
 * (intercepted by `@profile/(.)profile/[userId]/page.tsx`) renders the
 * Sheet body; any other path falls back to `@profile/default.tsx` (null)
 * and the Sheet stays closed.
 *
 * Direct visits to `/admin/messages/profile/<id>` bypass the intercept and
 * land on the full-page route, which sits inside this same layout.
 */
export default async function MessagesLayout({
  children,
  profile,
}: {
  children: ReactNode;
  profile: ReactNode;
}) {
  const t = await getTranslations("admin.profileViewer");
  return (
    <>
      {children}
      <ProfileViewerSheet profile={profile} sheetTitle={t("sheetTitle")} />
    </>
  );
}
