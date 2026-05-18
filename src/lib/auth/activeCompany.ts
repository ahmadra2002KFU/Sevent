/**
 * Active-company resolution primitives.
 *
 * Pure resolution + cookie / HMAC plumbing for the multi-user company-
 * organizer refactor (PR 1). No database access here — the resolver in
 * `access.ts` fetches active memberships once, then hands the list to
 * `resolveActiveCompanyForRequest()` for the cookie / query-param / fallback
 * decision.
 *
 * Three signals, in order of authority (matches the plan):
 *   1. Signed query param `?company=<uuid>:<ts>:<sig>` — 60s HMAC TTL.
 *      Required for email-callback flows that need to outlive a single page
 *      load and predate cookie context.
 *   2. HttpOnly cookie `sevent_active_company` — per-browser default for
 *      normal navigation, written by middleware on auto-resolve.
 *   3. `profiles.last_active_company_id` — authoritative fallback when neither
 *      of the above is present.
 *   4. If exactly one current membership → auto-resolve.
 *   5. If multiple memberships, no signal → most-recently-joined.
 *
 * Every resolved id MUST be re-verified against the membership list inside
 * the resolver; this file does that check (memberships are passed in as the
 * source of truth so a stale cookie cannot grant access to a company the
 * caller is no longer a member of).
 */

import { cookies } from "next/headers";
import {
  constantTimeEqual,
  getAccessSigningSecret,
  hmacSha256,
} from "./access";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CompanyRole = "owner" | "admin" | "member";

export type ActiveCompanyMembership = {
  company_id: string;
  role: CompanyRole;
  joined_at: string;
};

export type ActiveCompanyResolution = {
  activeCompanyId: string | null;
  companyRole: CompanyRole | null;
};

export type ActiveCompanySignals = {
  /** Raw `<companyId>:<timestamp>:<sig>` value from the `?company=` query param. */
  signedQueryParam?: string | null;
  /** Plain company id read from the `sevent_active_company` cookie. */
  cookieValue?: string | null;
  /** `profiles.last_active_company_id`. */
  lastActiveCompanyId?: string | null;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ACTIVE_COMPANY_COOKIE_NAME = "sevent_active_company";

/** HMAC-signed `?company=` query-param TTL. Email-callback flows must outlive
 * a single page load but not session-length staleness. 60s matches the
 * existing forwarded access header. */
const ACTIVE_COMPANY_PARAM_TTL_MS = 60_000;

/** 30 days. The cookie is a UX convenience, not a security claim — every
 * resolver invocation re-validates membership against the DB. */
const ACTIVE_COMPANY_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

// ---------------------------------------------------------------------------
// Resolution (pure)
// ---------------------------------------------------------------------------

/**
 * Resolve the active company for the current request from the supplied
 * signals + membership list. Pure: no DB, no cookies, no headers. The caller
 * is responsible for reading the inputs and persisting any side-effect cookie
 * write afterwards.
 *
 * Memberships are assumed to already be filtered to active rows
 * (`removed_at IS NULL`). The function will only return ids that appear in
 * that list; a stale cookie / param / last_active referencing a company the
 * caller is no longer a member of is dropped to null/null.
 */
export function resolveActiveCompanyForRequest(
  memberships: ReadonlyArray<ActiveCompanyMembership>,
  opts: ActiveCompanySignals,
): ActiveCompanyResolution {
  if (memberships.length === 0) {
    return { activeCompanyId: null, companyRole: null };
  }

  const lookup = new Map<string, CompanyRole>();
  for (const m of memberships) {
    lookup.set(m.company_id, m.role);
  }

  const verify = (
    candidate: string | null | undefined,
  ): ActiveCompanyResolution | null => {
    if (!candidate) return null;
    const role = lookup.get(candidate);
    if (!role) return null;
    return { activeCompanyId: candidate, companyRole: role };
  };

  // 1. Signed query param wins.
  if (opts.signedQueryParam) {
    const verified = verifyActiveCompanyParamSync(opts.signedQueryParam);
    const hit = verify(verified);
    if (hit) return hit;
  }

  // 2. Cookie.
  const cookieHit = verify(opts.cookieValue);
  if (cookieHit) return cookieHit;

  // 3. Profile fallback.
  const lastActiveHit = verify(opts.lastActiveCompanyId);
  if (lastActiveHit) return lastActiveHit;

  // 4. Single-membership auto-resolve.
  if (memberships.length === 1) {
    const only = memberships[0];
    return { activeCompanyId: only.company_id, companyRole: only.role };
  }

  // 5. Most-recently-joined.
  let best = memberships[0];
  for (let i = 1; i < memberships.length; i++) {
    const candidate = memberships[i];
    if (candidate.joined_at > best.joined_at) {
      best = candidate;
    }
  }
  return { activeCompanyId: best.company_id, companyRole: best.role };
}

// ---------------------------------------------------------------------------
// Signed query-param HMAC (mirrors the access-header HMAC pattern).
// ---------------------------------------------------------------------------

/**
 * Encode a company id with an HMAC-SHA256 timestamp signature. Returns
 * `<companyId>:<ts>:<sig>` suitable for embedding as the `?company=` query
 * param in email-callback URLs.
 *
 * Returns null when no signing secret is configured. Callers should fall back
 * to the cookie + last_active resolution path.
 */
export async function signActiveCompanyParam(
  companyId: string,
): Promise<string | null> {
  const secret = getAccessSigningSecret();
  if (!secret) return null;
  const ts = Date.now().toString();
  const message = `${companyId}:${ts}`;
  const sig = await hmacSha256(secret, message);
  return `${companyId}:${ts}:${sig}`;
}

/**
 * Verify a `<companyId>:<ts>:<sig>` token and return the company id if HMAC
 * is valid AND within the 60s TTL. Returns null otherwise.
 *
 * Async variant — preferred from server actions. The sync variant below is
 * used inside `resolveActiveCompanyForRequest` because that function must
 * stay synchronous to keep the resolver hot path simple.
 */
export async function verifyActiveCompanyParam(
  param: string,
): Promise<string | null> {
  const parsed = parseActiveCompanyParam(param);
  if (!parsed) return null;
  const secret = getAccessSigningSecret();
  if (!secret) return null;
  const expected = await hmacSha256(secret, `${parsed.companyId}:${parsed.ts}`);
  if (!constantTimeEqual(parsed.sig, expected)) return null;
  if (Date.now() - parsed.tsMs > ACTIVE_COMPANY_PARAM_TTL_MS) return null;
  return parsed.companyId;
}

type ParsedParam = {
  companyId: string;
  ts: string;
  tsMs: number;
  sig: string;
};

function parseActiveCompanyParam(param: string): ParsedParam | null {
  const parts = param.split(":");
  if (parts.length !== 3) return null;
  const [companyId, ts, sig] = parts;
  if (!companyId || !ts || !sig) return null;
  const tsMs = Number.parseInt(ts, 10);
  if (!Number.isFinite(tsMs) || tsMs <= 0) return null;
  return { companyId, ts, tsMs, sig };
}

/**
 * Synchronous verification for use inside the resolver hot path.
 *
 * NOTE: Web Crypto's `crypto.subtle.sign` is async-only on the Edge runtime.
 * To avoid making the resolver async-recursive we drop param-based resolution
 * to null in the sync path and rely on the cookie / last_active / auto-resolve
 * fallbacks. Callers that NEED the query-param path (e.g. an invite-accept
 * server action) should call `verifyActiveCompanyParam` directly and pass the
 * result into the resolver via `opts.lastActiveCompanyId` or by setting the
 * cookie before re-rendering.
 *
 * In practice the only consumer that resolves on the param-only path is the
 * email-callback URL handler, which is implemented in PR 5 and runs in a
 * server action context where the async verifier is reachable.
 */
function verifyActiveCompanyParamSync(_param: string): string | null {
  // PR 1: no synchronous HMAC; param-based resolution defers to the server
  // action layer (PR 5). Returning null here is a sound default — the cookie
  // + DB fallback chain still produces a correct decision.
  return null;
}

// ---------------------------------------------------------------------------
// Cookie helpers (server-side; Next.js `cookies()` API).
// ---------------------------------------------------------------------------

/**
 * Persist the active-company cookie. Server-action-only — middleware needs to
 * set the cookie via `response.cookies.set(...)` instead (different runtime).
 */
export async function setActiveCompanyCookie(companyId: string): Promise<void> {
  const jar = await cookies();
  jar.set(ACTIVE_COMPANY_COOKIE_NAME, companyId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACTIVE_COMPANY_COOKIE_MAX_AGE_SECONDS,
  });
}

/**
 * Clear the active-company cookie. Used when a stale company id is detected
 * mid-resolution (member removed, company deleted, etc).
 */
export async function clearActiveCompanyCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(ACTIVE_COMPANY_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Read the active-company cookie from the current request scope. Returns
 * null when the cookie is absent OR when called outside a request scope
 * (e.g. unit tests, middleware Edge runtime).
 */
export async function readActiveCompanyCookie(): Promise<string | null> {
  try {
    const jar = await cookies();
    return jar.get(ACTIVE_COMPANY_COOKIE_NAME)?.value ?? null;
  } catch {
    return null;
  }
}
