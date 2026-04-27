"use client";

/**
 * Lane 3 · Sprint 3 — shortlist editor component.
 *
 * Controlled by the RFQ wizard (step 3). Renders:
 *   - Top matches from auto-match with reason chips + remove button
 *   - "Added by you" manual section with remove button
 *   - Popover/Command (cmdk) search to find approved+published suppliers by
 *     name/slug and append them to the manual section
 *
 * No direct DB access — the parent passes in `onSearchSuppliers` which calls
 * the `searchApprovedSuppliersAction` server action.
 *
 * VISUAL RESTYLE (Lane 2): rebuilt on shadcn Table + Command + Popover +
 * Tooltip. Search behavior (debounced 300ms, request sequencing) is unchanged.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  const t = useTranslations("organizer.shortlist");
  const [query, setQuery] = useState("");
  const [rawSuggestions, setRawSuggestions] = useState<ShortlistSupplier[]>([]);
  const [searching, setSearching] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqSeqRef = useRef(0);

  const alreadyAdded = useMemo(() => {
    const s = new Set<string>();
    for (const m of matches) s.add(m.supplier_id);
    for (const m of manualAdds) s.add(m.id);
    return s;
  }, [matches, manualAdds]);

  const trimmed = query.trim();
  const suggestions = useMemo(
    () => rawSuggestions.filter((h) => !alreadyAdded.has(h.id)),
    [rawSuggestions, alreadyAdded],
  );

  useEffect(() => {
    // Short queries don't fire a server search — the render branch below hides
    // any stale suggestions via `trimmed.length < 2`, so we don't need to wipe
    // state synchronously here (calling setState in an effect body triggers
    // cascading renders per the React Compiler lint rule).
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
        })
        .catch(() => {
          if (seq !== reqSeqRef.current) return;
          setRawSuggestions([]);
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
      setPopoverOpen(false);
    },
    [onAddManual],
  );

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        {/* ------------------------------------------------------------------ */}
        {/* Suggested matches */}
        {/* ------------------------------------------------------------------ */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("heading")}
            </h3>
            <span className="text-xs tabular-nums text-muted-foreground">
              {matches.length}
            </span>
          </div>

          {matches.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
              {t("noMatches")}
            </p>
          ) : (
            <Card className="overflow-hidden py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">{t("table.supplier")}</TableHead>
                    <TableHead className="px-4">
                      {t("table.matchReasons")}
                    </TableHead>
                    <TableHead className="px-4 text-end">
                      {t("table.score")}
                    </TableHead>
                    <TableHead className="px-4 w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map((m) => (
                    <TableRow key={m.supplier_id}>
                      <TableCell className="px-4 py-3">
                        <span className="font-medium text-brand-navy-900">
                          {m.business_name}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {m.reasons.map((reason) => (
                            <span
                              key={reason}
                              className="inline-flex items-center rounded-full bg-brand-cobalt-100 px-2 py-0.5 text-xs font-medium text-brand-cobalt-500"
                            >
                              {reason}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-end">
                        <span className="inline-flex items-center rounded-full border bg-card px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground">
                          {(m.breakdown.total * 100).toFixed(0)}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-end">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => onRemoveMatch(m.supplier_id)}
                              aria-label={t("removeLabel", {
                                name: m.business_name,
                              })}
                            >
                              <X aria-hidden />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t("removeTooltip")}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Added by you */}
        {/* ------------------------------------------------------------------ */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("addHeading")}
            </h3>
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <Plus aria-hidden />
                  {t("addCta")}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-[360px] p-0"
                sideOffset={8}
              >
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder={t("searchPlaceholder")}
                    value={query}
                    onValueChange={setQuery}
                  />
                  <CommandList>
                    {trimmed.length < 2 ? (
                      <div className="px-3 py-4 text-sm text-muted-foreground">
                        <Search
                          className="mb-2 inline size-4 opacity-70"
                          aria-hidden
                        />{" "}
                        {t("searchHint")}
                      </div>
                    ) : searching ? (
                      <div className="px-3 py-4 text-sm text-muted-foreground">
                        {t("searching")}
                      </div>
                    ) : suggestions.length === 0 ? (
                      <CommandEmpty>{t("noResults")}</CommandEmpty>
                    ) : (
                      suggestions.map((s) => (
                        <CommandItem
                          key={s.id}
                          value={`${s.business_name} ${s.slug}`}
                          onSelect={() => handlePick(s)}
                          className="cursor-pointer"
                        >
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate font-medium">
                              {s.business_name}
                            </span>
                            <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                              {s.base_city}
                              {s.out_of_subcategory ? (
                                <span className="inline-flex items-center rounded-full bg-semantic-warning-100 px-1.5 py-0.5 text-[11px] font-medium text-semantic-warning-500">
                                  {t("outOfSubcategoryShort")}
                                </span>
                              ) : null}
                            </span>
                          </div>
                        </CommandItem>
                      ))
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {manualAdds.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
              {t("noManual")}
            </p>
          ) : (
            <Card className="overflow-hidden py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">{t("table.supplier")}</TableHead>
                    <TableHead className="px-4">{t("table.city")}</TableHead>
                    <TableHead className="px-4 w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manualAdds.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-brand-navy-900">
                            {s.business_name}
                          </span>
                          {s.out_of_subcategory ? (
                            <span className="mt-0.5 inline-flex w-fit items-center rounded-full bg-semantic-warning-100 px-2 py-0.5 text-[11px] font-medium text-semantic-warning-500">
                              {t("outOfSubcategoryLong")}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                        {s.base_city}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-end">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => onRemoveManual(s.id)}
                              aria-label={t("removeLabel", {
                                name: s.business_name,
                              })}
                            >
                              <X aria-hidden />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t("removeTooltip")}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </section>
      </div>
    </TooltipProvider>
  );
}
