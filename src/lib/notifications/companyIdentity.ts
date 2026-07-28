import "server-only";

import type { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

type AdminClient = ReturnType<typeof createSupabaseServiceRoleClient>;

/**
 * Resolve `organizer_companies.name` for an email template's
 * `organizerCompanyName` prop.
 *
 * Background (review finding F2): `formatOrganizerIdentity()` and the
 * `organizerCompanyName` prop have existed on five lifecycle templates since
 * the company refactor, but every call site passed a literal `null` — the
 * follow-up that was supposed to resolve the name never landed. Suppliers
 * working with a company therefore always saw an individual's personal name,
 * which defeats the point of the company workspace.
 *
 * Contract:
 *   * `null` company id → `null` (individual organizer; templates fall back to
 *     the actor's name alone, which is the historical behaviour).
 *   * Lookup failure → `null` plus a log line. A missing company name must
 *     never block a lifecycle email; degrading to the actor's name is exactly
 *     the pre-fix behaviour.
 *
 * Reads through the service-role client because the caller is already inside a
 * server action that owns one, and `organizer_companies` SELECT is not granted
 * to `authenticated` for the finance columns (see 20260519120000).
 */
export async function resolveOrganizerCompanyName(
  admin: AdminClient,
  companyId: string | null | undefined,
): Promise<string | null> {
  if (!companyId) return null;

  const { data, error } = await admin
    .from("organizer_companies")
    .select("name")
    .eq("id", companyId)
    .maybeSingle();

  if (error) {
    console.error("[companyIdentity] company name lookup failed", {
      companyId,
      code: (error as { code?: string }).code ?? null,
      message: error.message,
    });
    return null;
  }

  const name = (data as { name?: string | null } | null)?.name ?? null;
  return name && name.trim().length > 0 ? name.trim() : null;
}

/**
 * Resolve the owning company for a booking, then its name. Convenience wrapper
 * for the supplier-side actions, which hold a booking row rather than an event.
 */
export async function resolveCompanyNameForBooking(
  admin: AdminClient,
  bookingId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("bookings")
    .select("company_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    console.error("[companyIdentity] booking company lookup failed", {
      bookingId,
      message: error.message,
    });
    return null;
  }

  return resolveOrganizerCompanyName(
    admin,
    (data as { company_id?: string | null } | null)?.company_id ?? null,
  );
}
