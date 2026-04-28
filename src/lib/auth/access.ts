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

// Header used by the middleware to forward an HMAC-signed access decision to
// the page render so `requireAccess()` can skip a duplicate DB round-trip.
// Middleware overwrites it on every request; the HMAC stops a forged client
// header from being trusted.
export const ACCESS_HEADER_NAME = "x-sevent-access";
const ACCESS_HEADER_TTL_MS = 60_000; // 60s — enough for a single render.

export type ForwardableAccess = {
  userId: string;
  email: string | null;
  role: AppRole | null;
  state: AccessState;
  bestDestination: string;
  allowedRoutePrefixes: string[];
  features: Partial<Record<AccessFeature, boolean>>;
  supplierId: string | null;
  iat: number; // ms epoch, for TTL check
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

  // Speculatively fetch profile + supplier in parallel. Suppliers are the
  // dominant user role, so paying for the suppliers query on non-supplier
  // accounts (an indexed point lookup that returns null) is cheaper overall
  // than serializing the two round-trips on the supplier path.
  const [profileRes, supplierRes] = await Promise.all([
    admin.from("profiles").select("role").eq("id", userId).maybeSingle(),
    admin
      .from("suppliers")
      .select("id, legal_type, verification_status")
      .eq("profile_id", userId)
      .maybeSingle(),
  ]);
  const role = ((profileRes.data as { role: string } | null)?.role ?? null) as
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

function base64UrlFromBytes(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bytesFromBase64Url(s: string): Uint8Array {
  let b = s.replace(/-/g, "+").replace(/_/g, "/");
  while (b.length % 4) b += "=";
  const bin = atob(b);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSha256(secret: string, message: string): Promise<string> {
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

function constantTimeEqual(a: string, b: string): boolean {
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
    if (
      typeof payload.iat !== "number" ||
      Date.now() - payload.iat > ACCESS_HEADER_TTL_MS
    ) {
      return null;
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
