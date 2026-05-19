import { ProfileBody } from "@/components/admin/profile/ProfileBody";

export const dynamic = "force-dynamic";

/**
 * Intercepting parallel-route page: when the admin clicks "View profile"
 * from inside `/admin/messages/*`, the soft navigation is intercepted and
 * the profile body renders inside the Sheet (via the `@profile` slot in
 * `messages/layout.tsx`). The inbox / thread / compose surface stays
 * visible behind the Sheet — the URL is `/admin/messages/profile/<id>` but
 * the layout's `children` remain the inbox.
 */
export default async function ProfileSlotPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return <ProfileBody userId={userId} />;
}
