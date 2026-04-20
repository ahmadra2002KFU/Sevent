import { redirect } from "next/navigation";
import { requireRole } from "@/lib/supabase/server";
import { readNotificationsForUser } from "@/lib/notifications/reader";
import NotificationsInbox from "../../../_components/NotificationsInbox";
import { markAllReadAction, markOneReadAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  const gate = await requireRole("admin");
  if (gate.status === "unauthenticated") {
    redirect("/sign-in?next=/admin/notifications");
  }
  if (gate.status === "forbidden") {
    redirect("/");
  }

  const { recent } = await readNotificationsForUser({
    admin: gate.admin,
    user_id: gate.user.id,
    limit: 50,
  });

  return (
    <NotificationsInbox
      role="admin"
      rows={recent}
      markOneAction={markOneReadAction}
      markAllAction={markAllReadAction}
    />
  );
}
