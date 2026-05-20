"use server";

import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth/access";

/**
 * Post-signup CTA — declare that this organizer will operate as an individual.
 *
 * Sets `profiles.organizer_legal_type='individual'` so the company-choice page
 * doesn't reappear on later visits, then redirects to the dashboard. The
 * column was added in 20260518100000_organizer_companies_enums.sql; NULL means
 * "not declared" (the post-signup default), and the user can pick either
 * branch from this page.
 *
 * Idempotent on the DB side — re-running just confirms the same value. The
 * return type is Promise<void> so the action can be used as a `<form action>`
 * target directly. On a DB error the user is redirected back to the choice
 * page so they can retry; the rare failure mode is logged for ops.
 */
export async function markAsIndividualAction(): Promise<void> {
  const { user, admin } = await requireAccess("organizer.onboarding");

  // Conditional UPDATE — only flip NULL → 'individual' atomically. The
  // SELECT-then-UPDATE pattern this replaces had a TOCTOU window where a
  // concurrent createCompanyAction (which writes
  // organizer_legal_type='company') could be silently overwritten back to
  // 'individual'. Filtering on `.is(...)` pushes the precondition into the
  // single UPDATE statement so the DB enforces it under MVCC.
  const { error } = await admin
    .from("profiles")
    .update({ organizer_legal_type: "individual" })
    .eq("id", user.id)
    .is("organizer_legal_type", null);
  if (error) {
    console.error("[markAsIndividualAction] update failed", error);
    redirect("/organizer/onboarding/company-choice?error=db");
  }

  redirect("/organizer/dashboard");
}
