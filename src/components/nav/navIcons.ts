import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Calendar,
  CalendarCheck,
  CalendarDays,
  FileText,
  Inbox,
  LayoutDashboard,
  Palette,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

/**
 * String-keyed icon registry for nav items.
 *
 * `TopNav` is a server component but the desktop-link list + mobile sheet are
 * client components (they use `usePathname` for active-route highlighting).
 * Lucide icon components can't be serialized across that boundary, so server
 * code passes a string `iconKey` and the client resolves it through this map.
 *
 * Keep this list narrow — it's the union of icons referenced by
 * `NAV_BY_ROLE` in `TopNav.tsx`. Add a new entry here before introducing a new
 * nav item.
 */
export const NAV_ICONS = {
  dashboard: LayoutDashboard,
  events: CalendarDays,
  rfqs: FileText,
  bookings: CalendarCheck,
  onboarding: Sparkles,
  catalog: ShoppingBag,
  calendar: Calendar,
  supplierRfqs: Inbox,
  profile: Palette,
  verifications: ShieldCheck,
  notifications: Bell,
} as const satisfies Record<string, LucideIcon>;

export type NavIconKey = keyof typeof NAV_ICONS;
