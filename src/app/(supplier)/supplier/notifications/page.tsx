import { requireAccess } from "@/lib/auth/access";
import { readNotificationsForUser } from "@/lib/notifications/reader";
import NotificationsInbox from "../../../_components/NotificationsInbox";
import { markAllReadAction, markOneReadAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SupplierNotificationsPage() {
  const { user, admin } = await requireAccess("supplier.dashboard");

  const { recent } = await readNotificationsForUser({
    admin,
    user_id: user.id,
    limit: 50,
  });

  return (
    <NotificationsInbox
      role="supplier"
      rows={recent}
      markOneAction={markOneReadAction}
      markAllAction={markAllReadAction}
    />
  );
}
