"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type CategoryGroup = {
  parentName: string;
  items: Array<{ id: string; name: string }>;
};

export type CategoryPillCloudLabels = {
  heading: string;
  hintMax: string;
  searchPlaceholder: string;
  selectedCounter?: (picked: number, max: number) => string;
  addAria: (name: string) => string;
  removeAria: (name: string) => string;
};

export type CategoryPillCloudProps = {
  groups: CategoryGroup[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClear: (id: string) => void;
  /**
   * Max selectable. When omitted the picker is uncapped and pills never get
   * disabled — the component just lets the user keep picking.
   */
  max?: number;
  labels: CategoryPillCloudLabels;
};

type FlatItem = { id: string; name: string; parentName: string };

/**
 * Pill-cloud category picker with selected chips at top, a search input,
 * and groups (by parent category). Popsayout animation on select/remove.
 */
export function CategoryPillCloud({
  groups,
  selectedIds,
  onToggle,
  onClear,
  max,
  labels,
}: CategoryPillCloudProps) {
  const [query, setQuery] = useState("");

  const flat: FlatItem[] = useMemo(
    () =>
      groups.flatMap((g) =>
        g.items.map((it) => ({ ...it, parentName: g.parentName })),
      ),
    [groups],
  );

  const selectedItems: FlatItem[] = useMemo(
    () =>
      selectedIds
        .map((id) => flat.find((it) => it.id === id))
        .filter((it): it is FlatItem => it !== undefined),
    [selectedIds, flat],
  );

  const visibleGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((it) => it.name.toLowerCase().includes(needle)),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  const picked = selectedIds.length;
  // Uncapped by default — pills stay selectable until explicit `max` is given.
  const full = typeof max === "number" && picked >= max;
  const counterText =
    typeof max === "number" && labels.selectedCounter
      ? labels.selectedCounter(picked, max)
      : null;

  return (
    <div className="relative">
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <label className="text-[13px] font-semibold text-brand-navy-900">
          {labels.heading}
          {counterText ? (
            <span className="ms-1 font-normal text-neutral-600">
              · {counterText}
            </span>
          ) : null}
        </label>
        <span className="text-[11.5px] text-neutral-600">{labels.hintMax}</span>
      </div>

      {/* Selected chips */}
      <div className="mb-3.5 flex min-h-[36px] flex-wrap gap-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {selectedItems.map((it) => (
            <motion.span
              key={it.id}
              layout
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 28 }}
              className="inline-flex items-center gap-2 rounded-full bg-brand-cobalt-500 px-3.5 py-2 text-[13px] font-semibold text-white"
            >
              <Check className="size-[13px]" strokeWidth={3} />
              {it.name}
              <button
                type="button"
                onClick={() => onClear(it.id)}
                aria-label={labels.removeAria(it.name)}
                className="-me-1 rounded-full p-0.5 text-white/70 transition hover:bg-white/15 hover:text-white"
              >
                <X className="size-[13px]" strokeWidth={2.2} />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.searchPlaceholder}
          className="w-full rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-[13.5px] outline-none transition focus:border-brand-cobalt-500 focus:ring-2 focus:ring-brand-cobalt-500/25"
        />
      </div>

      {/* Groups */}
      <div className="space-y-5">
        <AnimatePresence mode="popLayout" initial={false}>
          {visibleGroups.map((group) => (
            <motion.div
              key={group.parentName}
              layout
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
            >
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
                {group.parentName}
              </div>
              <div className="flex flex-wrap gap-2">
                <AnimatePresence mode="popLayout" initial={false}>
                  {group.items.map((it) => {
                    const sel = selectedIds.includes(it.id);
                    const disabled = !sel && full;
                    return (
                      <motion.span
                        key={it.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 400, damping: 22 }}
                        className="inline-flex"
                      >
                        <motion.button
                          type="button"
                          disabled={disabled}
                          onClick={() => onToggle(it.id)}
                          aria-pressed={sel}
                          aria-label={
                            sel ? labels.removeAria(it.name) : labels.addAria(it.name)
                          }
                          whileHover={disabled ? undefined : { y: -1 }}
                          whileTap={disabled ? undefined : { scale: 0.97 }}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] font-medium transition",
                            sel
                              ? "border-brand-cobalt-500 bg-brand-cobalt-100 text-brand-cobalt-500"
                              : "border-neutral-200 bg-white text-brand-navy-900 hover:border-brand-cobalt-500/40",
                            disabled &&
                              "cursor-not-allowed opacity-50 hover:border-neutral-200 hover:bg-white",
                          )}
                        >
                          {sel ? (
                            <Check className="size-[13px]" strokeWidth={3} />
                          ) : (
                            <Plus className="size-[13px]" strokeWidth={2.4} />
                          )}
                          {it.name}
                        </motion.button>
                      </motion.span>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
