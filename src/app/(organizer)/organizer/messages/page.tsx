import { requireAccess } from "@/lib/auth/access";
import { UserMessagesList } from "@/app/_components/messaging/UserMessagesList";

export const dynamic = "force-dynamic";

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export default async function OrganizerMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const { admin, user } = await requireAccess("messaging.user.read");
  return (
    <UserMessagesList
      admin={admin}
      user_id={user.id}
      role="organizer"
      page={parsePage(params.page)}
    />
  );
}
