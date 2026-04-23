import { cache } from "react";
import { redirect } from "next/navigation";
import type { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
  type AppRole,
} from "@/lib/supabase/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  STATE_CONFIG,
  type AccessFeature,
  type AccessState,
} from "./featureMatrix";

export type { AccessFeature, AccessState } from "./featureMatrix";

type AdminClient = ReturnType<typeof createSupabaseServiceRoleClient>;

export type AccessDecision = {
  userId: string | null;
  role: AppRole | null;
  state: AccessState;
  bestDestination: string;
  allowedRoutePrefixes: string[];
  features: Partial<Record<AccessFeature, boolean>>;
  // For supplier states, carries the supplier id so callers don't need a
  // second lookup. Null for non-supplier roles or when the row doesn't exist.
  supplierId: string | null;
};

type SupplierRow = {
  id: string;
  legal_type: string | null;
  verification_status: "pending" | "approved" | "rejected";
};

/**
 * Core resolver (uncached). Given a userId, returns the caller's
 * `AccessDecision` — role, state, features, best redirect destination.
 *
 * Exported for unit tests that need deterministic behaviour without React's
 * per-request memoization interfering. Production callers should prefer
 * `resolveAccessForUser`, the `cache()`-wrapped variant below.
 */
export async function resolveAccessForUserUncached(
  userId: string | null,
  opts?: { admin?: AdminClient },
): Promise<AccessDecision> {
  if (!userId) {
    return buildDecision("unauthenticated", null, null, null);
  }

  const admin = opts?.admin ?? createSupabaseServiceRoleClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const role = ((profile as { role: string } | null)?.role ?? null) as
    | AppRole
    | null;

  if (!role) {
    // Authenticated but no profile row (race with the auth trigger) or the
    // role column is unrecognised. Fail closed.
    return buildDecision("forbidden", userId, null, null);
  }

  if (role === "admin") {
    return buildDecision("admin.active", userId, role, null);
  }

  if (role === "organizer") {
    return buildDecision("organizer.active", userId, role, null);
  }

  if (role === "agency") {
    return buildDecision("agency.active", userId, role, null);
  }

  // role === "supplier"
  const { data: supplierRaw } = await admin
    .from("suppliers")
    .select("id, legal_type, verification_status")
    .eq("profile_id", userId)
    .maybeSingle();
  const supplier = (supplierRaw ?? null) as SupplierRow | null;

  if (!supplier) {
    return buildDecision("supplier.no_row", userId, role, null);
  }

  if (supplier.verification_status === "approved") {
    return buildDecision("supplier.approved", userId, role, supplier.id);
  }
  if (supplier.verification_status === "rejected") {
    return buildDecision("supplier.rejected", userId, role, supplier.id);
  }

  // verification_status === "pending" — distinguish in_onboarding from
  // pending_review by whether the user has completed wizard steps 2 + 3.
  const [docsRes, categoriesRes] = await Promise.all([
    admin
      .from("supplier_docs")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", supplier.id),
    admin
      .from("supplier_categories")
      .select("subcategory_id", { count: "exact", head: true })
      .eq("supplier_id", supplier.id),
  ]);
  const hasDocs = (docsRes.count ?? 0) > 0;
  const hasCategories = (categoriesRes.count ?? 0) > 0;

  const state: AccessState =
    hasDocs && hasCategories
      ? "supplier.pending_review"
      : "supplier.in_onboarding";
  return buildDecision(state, userId, role, supplier.id);
}

/**
 * Cached variant for production. Safe to call multiple times in the same RSC
 * tree; React `cache()` coalesces repeated calls into a single DB round-trip.
 */
export const resolveAccessForUser = cache(resolveAccessForUserUncached);

function buildDecision(
  state: AccessState,
  userId: string | null,
  role: AppRole | null,
  supplierId: string | null,
): AccessDecision {
  const cfg = STATE_CONFIG[state];
  return {
    userId,
    role,
    state,
    bestDestination: cfg.bestDestination,
    allowedRoutePrefixes: [...cfg.allowedRoutePrefixes],
    features: { ...cfg.features },
    supplierId,
  };
}

/**
 * Middleware-flavoured resolver. Runs the session refresh, then consults
 * `resolveAccessForUser` with the newly-refreshed user id. Returns both the
 * response (which may carry refreshed cookies) and the decision.
 */
export async function resolveAccessFromRequest(
  request: NextRequest,
): Promise<{ decision: AccessDecision; response: NextResponse }> {
  const { response, user } = await updateSession(request);
  const decision = await resolveAccessForUser(user?.id ?? null);
  return { decision, response };
}

export type RequireAccessOk = {
  decision: AccessDecision;
  userId: string;
  user: { id: string; email: string | null };
  admin: AdminClient;
};

/**
 * Server-side feature gate for use inside server components + server actions.
 *
 * On failure this function calls Next.js `redirect()` — which throws a
 * `NEXT_REDIRECT` special error that the framework intercepts. Callers can
 * therefore rely on control flow not returning if the user lacks access.
 *
 * @param feature the AccessFeature required for the caller's surface
 */
export async function requireAccess(
  feature: AccessFeature,
): Promise<RequireAccessOk> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const admin = createSupabaseServiceRoleClient();
  const decision = await resolveAccessForUser(user.id, { admin });

  if (!decision.features[feature]) {
    redirect(decision.bestDestination);
  }

  return {
    decision,
    userId: user.id,
    user: { id: user.id, email: user.email ?? null },
    admin,
  };
}
