/**
 * Sanitize the `?next=` parameter used by the sign-in flow.
 *
 * The old `signInAction` trusted `next` verbatim — an attacker (or an out-of-date
 * bookmark) could redirect a freshly-signed-in user to `//evil.com`,
 * `javascript:...`, or a surface they shouldn't have access to (e.g. an admin
 * URL when signed in as supplier). This helper normalises and filters the
 * candidate so only a safe in-app path survives.
 *
 * Rules (any failure returns `null` — caller falls back to `bestDestination`):
 *   1. Must be a non-empty string.
 *   2. Must not start with `//` or `\\` (protocol-relative or UNC-path tricks).
 *   3. Must not contain a URL scheme (`http:`, `javascript:`, `data:`, etc.).
 *   4. Must not contain ASCII control characters (`\x00`–`\x1F`, `\x7F`).
 *   5. Must start with a single `/`.
 *   6. Must resolve to the same origin as `APP_URL` when parsed via `new URL`.
 *   7. Must start with one of `allowedPrefixes`, OR be exactly `/`.
 *
 * @param candidate the raw `next` value off the query string / form
 * @param allowedPrefixes the route prefixes from the caller's AccessDecision
 * @param appUrl base URL used for same-origin check (default: APP_URL env)
 */
export function sanitizeNextParam(
  candidate: string | null | undefined,
  allowedPrefixes: readonly string[],
  appUrl: string = process.env.APP_URL ?? "http://localhost:3000",
): string | null {
  if (typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  if (trimmed.length === 0) return null;

  // Protocol-relative / UNC path — the leading `//` or `\\` makes the browser
  // resolve against a different origin.
  if (trimmed.startsWith("//") || trimmed.startsWith("\\\\")) return null;
  if (trimmed.startsWith("\\")) return null;

  // Full URL scheme or pseudo-scheme.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;

  // ASCII control characters — `\n`, `\r`, null byte, etc. Next.js' redirect
  // header already strips these, but rejecting here keeps the contract honest.
  if (/[\x00-\x1F\x7F]/.test(trimmed)) return null;

  if (!trimmed.startsWith("/")) return null;

  // Same-origin check via URL parser. `new URL("/foo", "https://app")` resolves
  // to `https://app/foo`; if the candidate tries anything fancier it will
  // either throw or produce a different origin.
  let parsed: URL;
  try {
    parsed = new URL(trimmed, appUrl);
  } catch {
    return null;
  }
  const base = new URL(appUrl);
  if (parsed.origin !== base.origin) return null;

  const pathWithQuery = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  if (!pathWithQuery.startsWith("/")) return null;

  // Root path is always safe (falls back to role-home via bestDestination if
  // the caller wants that, but rendering "/" never leaks role-specific data).
  if (parsed.pathname === "/") return pathWithQuery;

  // Otherwise require a prefix match against the user's allowedRoutePrefixes.
  for (const prefix of allowedPrefixes) {
    if (parsed.pathname === prefix) return pathWithQuery;
    if (parsed.pathname.startsWith(`${prefix}/`)) return pathWithQuery;
  }
  return null;
}
