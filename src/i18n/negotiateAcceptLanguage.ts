/**
 * Best-match negotiator for an `Accept-Language` header against a supported
 * locale set. Parses each comma-separated entry, computes its q-weight
 * (default 1.0, range 0..1), normalizes to a base language tag
 * (`fr-FR` → `fr`), and returns the supported locale with the highest q
 * value among matches. Ties resolve to the earlier entry (RFC 9110
 * §12.5.4 — "If multiple language ranges with the highest qvalue are
 * listed, the first one is preferred").
 *
 * Returns `null` if no supported locale appears in the header so the caller
 * can fall through to its own default. Implemented inline (no dependency)
 * so we can swap or shrink the supported set without touching upstream.
 *
 * Lifted out of `src/i18n/request.ts` so it can be unit-tested without
 * pulling in `next/headers` / `next-intl/server` at module-load time.
 */
export function negotiateAcceptLanguage<L extends string>(
  header: string,
  supported: ReadonlyArray<L>,
): L | null {
  if (!header) return null;

  const supportedSet = new Set<string>(supported);
  let best: { locale: L; q: number; index: number } | null = null;

  const entries = header.split(",");
  for (let i = 0; i < entries.length; i++) {
    const raw = entries[i]?.trim();
    if (!raw) continue;

    // `lang[;q=0.x]` — peel off the q-value parameter(s) from `;` tokens.
    const parts = raw.split(";").map((p) => p.trim());
    const rangeRaw = parts[0]?.toLowerCase();
    if (!rangeRaw) continue;

    // Parse q-value if present. Anything malformed (out of range, NaN,
    // negative) is treated as q=0 — "not acceptable" per RFC 9110.
    let q = 1;
    for (let j = 1; j < parts.length; j++) {
      const p = parts[j];
      if (!p || !p.startsWith("q=")) continue;
      const parsed = Number.parseFloat(p.slice(2));
      if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
        q = parsed;
      } else {
        q = 0;
      }
    }
    if (q <= 0) continue;

    // Wildcard `*` matches any supported locale — pick the caller's
    // preferred default (first entry of `supported`) at that q.
    if (rangeRaw === "*") {
      const fallback = supported[0];
      if (fallback && (!best || q > best.q)) {
        best = { locale: fallback, q, index: i };
      }
      continue;
    }

    // Normalize `xx-YY` / `xx_YY` → `xx` for the base-language match.
    const base = rangeRaw.split(/[-_]/)[0];
    if (!base) continue;

    if (supportedSet.has(base)) {
      if (!best || q > best.q) {
        best = { locale: base as L, q, index: i };
      }
    }
  }

  return best?.locale ?? null;
}
