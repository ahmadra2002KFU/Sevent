"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createSupabaseServiceRoleClient,
  getCurrentUser,
} from "@/lib/supabase/server";
import { setActiveCompanyCookie } from "./activeCompany";

const InputSchema = z.object({
  company_id: z.string().uuid(),
  redirect_to: z.string().startsWith("/").max(2048).optional(),
});

/**
 * Switch the active company for the current organizer.
 *
 * Reads the current user, verifies membership in the target company under
 * the service-role client (RLS bypass — the membership check is the
 * security boundary), then writes both the active-company cookie and
 * profiles.last_active_company_id. Returns a redirect to the target path
 * (default: /organizer/dashboard).
 *
 * The cookie + DB column are written together so that:
 *   - subsequent same-browser navigations pick the new company up via
 *     the cookie fast-path inside `resolveAccessForUserUncached`
 *   - if the cookie is later cleared (private window, separate device),
 *     `last_active_company_id` is the DB-side fallback signal
 *
 * Idempotent: switching to the already-active company is a no-op redirect.
 */
export async function switchActiveCompanyAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const parsed = InputSchema.safeParse({
    company_id: formData.get("company_id") ?? "",
    redirect_to: formData.get("redirect_to") ?? undefined,
  });
  if (!parsed.success) {
    redirect("/organizer/dashboard");
  }

  const admin = createSupabaseServiceRoleClient();
  const { data: row } = await admin
    .from("organizer_memberships")
    .select("role")
    .eq("company_id", parsed.data.company_id)
    .eq("profile_id", user.id)
    .is("removed_at", null)
    .maybeSingle();
  if (!row) {
    // Not a current member — refuse silently by sending the caller to
    // their best destination rather than the requested company surface.
    redirect("/organizer/dashboard");
  }

  // Best-effort DB write — failures are non-fatal; the cookie alone is
  // enough for the resolver to pick the new company on the next request.
  await admin
    .from("profiles")
    .update({ last_active_company_id: parsed.data.company_id })
    .eq("id", user.id);
  await setActiveCompanyCookie(parsed.data.company_id);

  // Bust the cached AccessDecision for the dashboard + the calling page
  // so the new active company is reflected on the first render after
  // switching.
  revalidatePath("/organizer", "layout");

  redirect(parsed.data.redirect_to ?? "/organizer/dashboard");
}
