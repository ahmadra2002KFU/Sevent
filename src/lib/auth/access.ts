import { cache } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseServiceRoleClient,
  getCurrentUser,
  type AppRole,
} from "@/lib/supabase/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  STATE_CONFIG,
  type AccessFeature,
  type AccessState,
} from "./featureMatrix";
import {
  readActiveCompanyCookie,
  resolveActiveCompanyForRequest,
  type ActiveCompanyMembership,
  type CompanyRole,
} from "./activeCompany";

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
  // ---------------------------------------------------------------------
  // Multi-user company-organizer fields (PR 1).
  //
  // Null/empty for:
  //   * non-organizer roles
  //   * individual organizers (organizer_legal_type IS NULL or 'individual')
  //   * any role when IS_COMPANY_FEATURES_ENABLED='false' (kill-switch)
  //
  // availableCompanyIds reflects ACTIVE memberships only (removed_at IS NULL).
  // ---------------------------------------------------------------------
  activeCompanyId: string | null;
  companyRole: CompanyRole | null;
  availableCompanyIds: string[];
};

// Header used by the middleware to forward an HMAC-signed access decision to
// the page render so `requireAccess()` can skip a duplicate DB round-trip.
// Middleware overwrites it on every request; the HMAC stops a forged client
// header from being trusted.
export const ACCESS_HEADER_NAME = "x-sevent-access";
const ACCESS_HEADER_TTL_MS = 60_000; // 60s — enough for a single render.

// Tighter TTL for the company-aware fields. A removed-mid-session member
// should not have a 60s acting window — 15s gets the forwarded company
// context invalidated quickly while still skipping the DB round-trip on
// back-to-back renders inside a single user interaction.
const ACCESS_HEADER_COMPANY_TTL_MS = 15_000;

export type ForwardableAccess = {
  userId: string;
  email: string | null;
  role: AppRole | null;
  state: AccessState;
  bestDestination: string;
  allowedRoutePrefixes: string[];
  features: Partial<Record<AccessFeature, boolean>>;
  supplierId: string | null;
  // Multi-user company-organizer fields (PR 1). Included in the HMAC payload
  // so a forwarded header cannot strip them client-side — verifyAccessPayload
  // enforces a separate 15s TTL on these specifically.
  activeCompanyId: string | null;
  companyRole: CompanyRole | null;
  availableCompanyIds: string[];
  iat: number; // ms epoch, for TTL check
};

type SupplierRow = {
  id: string;
  legal_type: string | null;
  verification_status: "pending" | "approved" | "rejected";
};

type OrganizerProfileRow = {
  role: string;
  organizer_legal_type: "individual" | "company" | null;
  last_active_company_id: string | null;
};

type MembershipRow = {
  company_id: string;
  role: CompanyRole;
  joined_at: string;
};

/**
 * Runtime kill-switch for the multi-user company-organizer flow.
 *
 * Default in PR 1: DISABLED. The schema migrations are additive and safe
 * to apply, but the resolver behavior stays single-user-only until
 * IS_COMPANY_FEATURES_ENABLED='true' is set in the environment. PR 3 flips
 * the staging env, PR 5 flips production. When disabled, the resolver
 * returns activeCompanyId=null/companyRole=null/availableCompanyIds=[] for
 * every organizer regardless of organizer_legal_type or membership rows, and
 * the organizer.no_company state is never emitted.
 */
function isCompanyFeaturesEnabled(): boolean {
  return process.env.IS_COMPANY_FEATURES_ENABLED === "true";
}

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

  // Speculatively fetch profile + supplier + memberships in parallel.
  // Suppliers are the dominant user role today, so paying for the suppliers
  // query on non-supplier accounts (an indexed point lookup that returns null)
  // is cheaper overall than serializing the round-trips on the supplier path.
  // Memberships use the (profile_id, removed_at) partial index — an empty
  // result for non-organizers and individual organizers is a single index
  // probe, so this stays cheap.
  const [profileRes, supplierRes, membershipsRes] = await Promise.all([
    admin
      .from("profiles")
      .select("role, organizer_legal_type, last_active_company_id")
      .eq("id", userId)
      .maybeSingle(),
    admin
      .from("suppliers")
      .select("id, legal_type, verification_status")
      .eq("profile_id", userId)
      .maybeSingle(),
    admin
      .from("organizer_memberships")
      .select("company_id, role, joined_at")
      .eq("profile_id", userId)
      .is("removed_at", null),
  ]);
  const profile = (profileRes.data ?? null) as OrganizerProfileRow | null;
  const role = (profile?.role ?? null) as AppRole | null;

  if (!role) {
    // Authenticated but no profile row (race with the auth trigger) or the
    // role column is unrecognised. Fail closed.
    return buildDecision("forbidden", userId, null, null);
  }

  if (role === "admin") {
    return buildDecision("admin.active", userId, role, null);
  }

  if (role === "organizer") {
    return await buildOrganizerDecision(userId, profile, membershipsRes.data);
  }

  if (role === "agency") {
    return buildDecision("agency.active", userId, role, null);
  }

  // role === "supplier"
  const supplier = (supplierRes.data ?? null) as SupplierRow | null;

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
 * Build the AccessDecision for an organizer-role user. Splits cleanly from
 * the main resolver because the company-aware resolution path needs to
 * inspect cookies / signed query params and apply the runtime feature flag.
 *
 * Inputs are already-fetched rows from `resolveAccessForUserUncached` — this
 * function does NOT issue additional DB calls.
 */
async function buildOrganizerDecision(
  userId: string,
  profile: OrganizerProfileRow | null,
  membershipsRaw: MembershipRow[] | null,
): Promise<AccessDecision> {
  // Kill-switch: behave like an individual organizer in every code path.
  // We deliberately ignore both organizer_legal_type and the memberships
  // result so the decision is identical to the pre-PR1 contract.
  if (!isCompanyFeaturesEnabled()) {
    return buildDecision("organizer.active", userId, "organizer", null);
  }

  const memberships: ActiveCompanyMembership[] = (membershipsRaw ?? []).map(
    (m) => ({
      company_id: m.company_id,
      role: m.role,
      joined_at: m.joined_at,
    }),
  );
  const availableCompanyIds = memberships.map((m) => m.company_id);

  const legalType = profile?.organizer_legal_type ?? null;

  // organizer_legal_type='company' AND no active memberships → onboarding gate.
  // Skip company resolution entirely; the user has nothing to resolve.
  if (legalType === "company" && memberships.length === 0) {
    return buildDecision("organizer.no_company", userId, "organizer", null);
  }

  // Individual organizers (legal_type IS NULL or 'individual') AND no
  // memberships → backwards-compat path with all company fields null.
  if (memberships.length === 0) {
    return buildDecision("organizer.active", userId, "organizer", null);
  }

  // Active company resolution. Cookie is read via next/headers which is only
  // available in request scope (RSC, server actions, route handlers). In the
  // middleware Edge runtime `cookies()` throws — `readActiveCompanyCookie`
  // catches that and returns null, so the resolver falls through to the
  // last_active and auto-resolve branches. The proxy then signs whatever
  // decision we produce into the x-sevent-access header for the page render.
  const cookieValue = await readActiveCompanyCookie();
  const { activeCompanyId, companyRole } = resolveActiveCompanyForRequest(
    memberships,
    {
      // PR 1: signed query param is parsed but always resolves to null in the
      // sync resolver path (see verifyActiveCompanyParamSync). Email-callback
      // flows that need the param land in PR 5.
      signedQueryParam: null,
      cookieValue,
      lastActiveCompanyId: profile?.last_active_company_id ?? null,
    },
  );

  return buildDecision("organizer.active", userId, "organizer", null, {
    activeCompanyId,
    companyRole,
    availableCompanyIds,
  });
}

/**
 * Cached variant for production. Safe to call multiple times in the same RSC
 * tree; React `cache()` coalesces repeated calls into a single DB round-trip.
 */
export const resolveAccessForUser = cache(resolveAccessForUserUncached);

type BuildDecisionCompanyFields = {
  activeCompanyId?: string | null;
  companyRole?: CompanyRole | null;
  availableCompanyIds?: string[];
};

function buildDecision(
  state: AccessState,
  userId: string | null,
  role: AppRole | null,
  supplierId: string | null,
  company?: BuildDecisionCompanyFields,
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
    activeCompanyId: company?.activeCompanyId ?? null,
    companyRole: company?.companyRole ?? null,
    availableCompanyIds: company?.availableCompanyIds
      ? [...company.availableCompanyIds]
      : [],
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
  // Fast path: the middleware (proxy.ts) signs and forwards the access
  // decision in `x-sevent-access`. If present and valid, skip the duplicate
  // auth + role round-trip. Falls through to the DB path on missing/expired
  // header (route handlers, the signing secret being unset, etc).
  const forwarded = await tryReadForwardedAccess();
  if (forwarded) {
    if (!forwarded.features[feature]) {
      redirect(forwarded.bestDestination);
    }
    return {
      decision: {
        userId: forwarded.userId,
        role: forwarded.role,
        state: forwarded.state,
        bestDestination: forwarded.bestDestination,
        allowedRoutePrefixes: forwarded.allowedRoutePrefixes,
        features: forwarded.features,
        supplierId: forwarded.supplierId,
        activeCompanyId: forwarded.activeCompanyId,
        companyRole: forwarded.companyRole,
        availableCompanyIds: forwarded.availableCompanyIds,
      },
      userId: forwarded.userId,
      user: { id: forwarded.userId, email: forwarded.email },
      admin: createSupabaseServiceRoleClient(),
    };
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const decision = await resolveAccessForUser(user.id);

  if (!decision.features[feature]) {
    redirect(decision.bestDestination);
  }

  const admin = createSupabaseServiceRoleClient();

  return {
    decision,
    userId: user.id,
    user,
    admin,
  };
}

// ---------------------------------------------------------------------------
// Signed access-header helpers (middleware → page render).
// ---------------------------------------------------------------------------

function getSigningSecret(): string | null {
  return process.env.SEVENT_ACCESS_SIGNING_SECRET || null;
}

/**
 * Public re-export of the access HMAC signing secret accessor. Internal to
 * the auth layer — `activeCompany.ts` consumes this so the `?company=`
 * signed-query-param helpers share the same key as the access header. Keep
 * this internal: no other module should be reaching for the secret directly.
 */
export function getAccessSigningSecret(): string | null {
  return getSigningSecret();
}

/** Internal HMAC primitives, exported for the active-company helper module. */
export function base64UrlFromBytes(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function bytesFromBase64Url(s: string): Uint8Array {
  let b = s.replace(/-/g, "+").replace(/_/g, "/");
  while (b.length % 4) b += "=";
  const bin = atob(b);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function hmacSha256(
  secret: string,
  message: string,
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return base64UrlFromBytes(new Uint8Array(sig));
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/**
 * Sign a `ForwardableAccess` payload with HMAC-SHA256. Returns null when no
 * signing secret is configured — middleware then skips the optimization and
 * pages fall back to the DB path.
 */
export async function signAccessPayload(
  payload: ForwardableAccess,
): Promise<string | null> {
  const secret = getSigningSecret();
  if (!secret) return null;
  const json = JSON.stringify(payload);
  const body = base64UrlFromBytes(new TextEncoder().encode(json));
  const sig = await hmacSha256(secret, body);
  return `${body}.${sig}`;
}

async function verifyAccessPayload(
  token: string,
): Promise<ForwardableAccess | null> {
  const secret = getSigningSecret();
  if (!secret) return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmacSha256(secret, body);
  if (!constantTimeEqual(sig, expected)) return null;
  try {
    const json = new TextDecoder().decode(bytesFromBase64Url(body));
    const payload = JSON.parse(json) as ForwardableAccess;
    if (typeof payload.iat !== "number") return null;
    const age = Date.now() - payload.iat;
    if (age > ACCESS_HEADER_TTL_MS) {
      return null;
    }
    // Company fields have a tighter 15s TTL so a removed-mid-session member
    // is not left with an effective acting window of the full 60s. The HMAC
    // covers these fields (they're in the signed payload), so we cannot
    // forge them — only strip-on-stale at verify time.
    if (age > ACCESS_HEADER_COMPANY_TTL_MS) {
      payload.activeCompanyId = null;
      payload.companyRole = null;
      payload.availableCompanyIds = [];
    }
    return payload;
  } catch {
    return null;
  }
}

async function tryReadForwardedAccess(): Promise<ForwardableAccess | null> {
  try {
    const h = await headers();
    const token = h.get(ACCESS_HEADER_NAME);
    if (!token) return null;
    return await verifyAccessPayload(token);
  } catch {
    // headers() throws outside a request scope (e.g. unit tests); fall back
    // to the DB path.
    return null;
  }
}
