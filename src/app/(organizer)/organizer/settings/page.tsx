import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * `/organizer/settings` lands users on the Company tab. The shared layout
 * already gates access; here we just normalise the URL so deep-links go
 * through the tab structure.
 */
export default function OrganizerSettingsIndexPage() {
  redirect("/organizer/settings/company");
}
