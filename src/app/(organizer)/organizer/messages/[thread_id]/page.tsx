import { requireAccess } from "@/lib/auth/access";
import { UserMessageThread } from "@/app/_components/messaging/UserMessageThread";

export const dynamic = "force-dynamic";

export default async function OrganizerMessageThreadPage({
  params,
}: {
  params: Promise<{ thread_id: string }>;
}) {
  const { thread_id } = await params;
  const { admin, user } = await requireAccess("messaging.user.read");
  return (
    <UserMessageThread
      admin={admin}
      user_id={user.id}
      role="organizer"
      thread_id={thread_id}
    />
  );
}
