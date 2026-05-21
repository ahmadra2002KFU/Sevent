/**
 * Company-aware visibility helpers for organizer surfaces.
 *
 * Background: organizer pages read through the SERVICE-ROLE client (the user
 * JWT is not forwarded for RLS-scoped SELECTs — see `lib/supabase/server.ts`),
 * so the DB's company-aware RLS never runs on those reads. Each page therefore
 * has to re-express the visibility predicate in the query itself. Historically
 * that predicate was the individual `organizer_id = user.id`, which hid a
 * company's opportunities from every member except the one who created them.
 *
 * These helpers centralise the company-aware predicate so every organizer
 * surface scopes data the same way, mirroring the RLS policies in
 * `20260518130000_organizer_companies_rls.sql`:
 *
 *     row visible  ⇔  company_id = activeCompanyId
 *                     OR (company_id IS NULL AND <owner> = userId)
 *
 * Scoped to the *active* company (the one the caller is currently acting as),
 * not every company they belong to — this matches the active-company UX where
 * a multi-company member switches companies to see each workspace.
 */

import type { AccessDecision } from "./access";

export type OrganizerScope = {
  /** The signed-in user's id (profiles.id / auth.uid()). */
  userId: string;
  /**
   * The company the caller is currently acting as, or null for individual
   * organizers (and any organizer when the company kill-switch is off).
   */
  activeCompanyId: string | null;
};

/** Build an OrganizerScope from a resolved access decision. */
export function organizerScopeFor(
  decision: Pick<AccessDecision, "activeCompanyId">,
  userId: string,
): OrganizerScope {
  return { userId, activeCompanyId: decision.activeCompanyId ?? null };
}

/**
 * PostgREST `.or(...)` argument for tables where BOTH `company_id` and the
 * owner column live on the same row (e.g. `events`, `bookings`). Expresses:
 *
 *     company_id = activeCompanyId OR (company_id IS NULL AND <ownerColumn> = userId)
 *
 * Returns `null` for individual organizers (no active company) — the caller
 * should then apply the plain `.eq(ownerColumn, userId)` it used before.
 *
 * `userId` / `activeCompanyId` are server-resolved UUIDs (auth session +
 * verified access decision), so they are safe to interpolate into the filter.
 */
export function companyOwnedOrFilter(
  scope: OrganizerScope,
  ownerColumn = "organizer_id",
): string | null {
  if (!scope.activeCompanyId) return null;
  return `company_id.eq.${scope.activeCompanyId},and(company_id.is.null,${ownerColumn}.eq.${scope.userId})`;
}

/**
 * In-memory visibility check mirroring the RLS predicate, for detail pages /
 * loaders that fetch a single row by id and then decide whether the caller may
 * see it:
 *
 *     company_id != null → must equal activeCompanyId (company branch)
 *     company_id == null → owner must equal userId    (individual branch)
 *
 * `ownerId` is the row's individual-owner column: `organizer_id` for
 * events/bookings, or the joined `events.organizer_id` for rfqs/quotes.
 */
export function canViewOrganizerRow(
  scope: OrganizerScope,
  row: {
    company_id: string | null | undefined;
    ownerId: string | null | undefined;
  },
): boolean {
  if (row.company_id) {
    return !!scope.activeCompanyId && row.company_id === scope.activeCompanyId;
  }
  return !!row.ownerId && row.ownerId === scope.userId;
}
