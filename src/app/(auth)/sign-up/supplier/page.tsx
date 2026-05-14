import { redirect } from "next/navigation";

/**
 * Legacy route. The organizer and supplier tracks are now one in-place
 * toggle on `/sign-up`; `?role=supplier` seeds the supplier track so the
 * supplier marketing funnel keeps landing on the right form.
 */
export default function SignUpSupplierRedirect() {
  redirect("/sign-up?role=supplier");
}
