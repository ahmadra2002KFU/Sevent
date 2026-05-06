import { requireAccess } from "@/lib/auth/access";
import { UserNewThreadForm } from "@/app/_components/messaging/UserNewThreadForm";

export const dynamic = "force-dynamic";

export default async function OrganizerNewThreadPage() {
  await requireAccess("messaging.user.write");
  return <UserNewThreadForm role="organizer" />;
}
