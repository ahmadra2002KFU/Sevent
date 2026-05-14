import { redirect } from "next/navigation";

/**
 * Legacy route. The organizer and supplier tracks are now one in-place
 * toggle on `/sign-up`; organizer is the default role there.
 */
export default function SignUpOrganizerRedirect() {
  redirect("/sign-up");
}
