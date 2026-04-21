"use client";

/**
 * Lane 3 · Sprint 3 — shortlist editor component.
 *
 * Controlled by the RFQ wizard (step 3). Renders:
 *   - Top matches from auto-match with reason chips + remove ✕ button
 *   - "Added by you" manual section with remove ✕ button
 *   - Debounced search box (300ms) to find approved+published suppliers by
 *     name/slug and append them to the manual section
 *
 * No direct DB access — the parent passes in `onSearchSuppliers` which calls
 * the `searchApprovedSuppliersAction` server action.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MatchResult } from "@/lib/domain/matching/autoMatch";

export type ShortlistSupplier = {
  id: string;
  business_name: string;
  base_city: string;
  slug: string;
  /**
   * True when the supplier is linked to the RFQ's subcategory. False when an
   * organizer manually picked them despite category mismatch (e.g. off-platform
   * relationship). Undefined for auto-match rows, which are subcategory-scoped
   * by construction.
   */
  out_of_subcategory?: boolean;
};

type Props = {
  matches: MatchResult[];
  manualAdds: ShortlistSupplier[];
  onRemoveMatch: (supplier_id: string) => void;
  onAddManual: (s: ShortlistSupplier) => void;
  onRemoveManual: (supplier_id: string) => void;
  onSearchSuppliers: (q: string) => Promise<ShortlistSupplier[]>;
};

const SEARCH_DEBOUNCE_MS = 300;

export function ShortlistEditor({
  matches,
  manualAdds,
  onRemoveMatch,
  onAddManual,
  onRemoveManual,
  onSearchSuppliers,
}: Props) {
  const [query, setQuery] = useState("");
  const [rawSuggestions, setRawSuggestions] = useState<ShortlistSupplier[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropdownQuery, setDropdownQuery] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqSeqRef = useRef(0);

  // Union set — used to hide already-shortlisted suppliers from the dropdown.
  const alreadyAdded = useMemo(() => {
    const s = new Set<string>();
    for (const m of matches) s.add(m.supplier_id);
    for (const m of manualAdds) s.add(m.id);
    return s;
  }, [matches, manualAdds]);

  // Derived visibility — dropdown is shown whenever there's an active query
  // that has produced a search result for a long-enough term.
  const trimmed = query.trim();
  const showDropdown = trimmed.length >= 2 && dropdownQuery !== null;
  const suggestions = useMemo(
    () => rawSuggestions.filter((h) => !alreadyAdded.has(h.id)),
    [rawSuggestions, alreadyAdded],
  );

  useEffect(() => {
    // Short queries do not trigger a search; the derived `showDropdown`
    // naturally hides the panel so we don't need to touch state here.
    if (trimmed.length < 2) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const seq = ++reqSeqRef.current;
      setSearching(true);
      onSearchSuppliers(trimmed)
        .then((hits) => {
          if (seq !== reqSeqRef.current) return;
          setRawSuggestions(hits);
          setDropdownQuery(trimmed);
        })
        .catch(() => {
          if (seq !== reqSeqRef.current) return;
          setRawSuggestions([]);
          setDropdownQuery(trimmed);
        })
        .finally(() => {
          if (seq !== reqSeqRef.current) return;
          setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [trimmed, onSearchSuppliers]);

  const handlePick = useCallback(
    (s: ShortlistSupplier) => {
      onAddManual(s);
      setQuery("");
      setRawSuggestions([]);
      setDropdownQuery(null);
    },
    [onAddManual],
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          Suggested matches
        </h3>
        {matches.length === 0 ? (
          <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-4 text-sm text-[var(--color-muted-foreground)]">
            No auto-match suggestions available for this event.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {matches.map((m) => (
              <li
                key={m.supplier_id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-[var(--color-border)] bg-white px-4 py-3"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{m.business_name}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {m.reasons.map((reason) => (
                      <span
                        key={reason}
                        className="rounded-full border border-[var(--color-border)] bg-[var(--color-muted)] px-2 py-0.5 text-xs"
                      >
                        {reason}
                      </span>
                    ))}
                    <span className="rounded-full border border-[var(--color-border)] bg-white px-2 py-0.5 text-xs text-[var(--color-muted-foreground)]">
                      Score {(m.breakdown.total * 100).toFixed(0)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveMatch(m.supplier_id)}
                  className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-muted)]"
                  aria-label={`Remove ${m.business_name}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          Added by you
        </h3>

        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search approved suppliers by name or slug…"
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
          {showDropdown ? (
            <div className="absolute start-0 end-0 top-full z-10 mt-1 overflow-hidden rounded-md border border-[var(--color-border)] bg-white shadow-sm">
              {searching ? (
                <p className="px-3 py-2 text-sm text-[var(--color-muted-foreground)]">
                  Searching…
                </p>
              ) : suggestions.length === 0 ? (
                <p className="px-3 py-2 text-sm text-[var(--color-muted-foreground)]">
                  No suppliers found.
                </p>
              ) : (
                <ul className="max-h-64 overflow-auto">
                  {suggestions.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => handlePick(s)}
                        className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-start text-sm hover:bg-[var(--color-muted)]"
                      >
                        <span className="font-medium">{s.business_name}</span>
                        <span className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
                          {s.base_city}
                          {s.out_of_subcategory ? (
                            <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                              Outside this subcategory
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>

        {manualAdds.length === 0 ? (
          <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-4 text-sm text-[var(--color-muted-foreground)]">
            Search above to add suppliers manually.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {manualAdds.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-white px-4 py-3"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{s.business_name}</span>
                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
                    {s.base_city}
                    {s.out_of_subcategory ? (
                      <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                        Outside this subcategory — supplier may decline
                      </span>
                    ) : null}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveManual(s.id)}
                  className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-muted)]"
                  aria-label={`Remove ${s.business_name}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
