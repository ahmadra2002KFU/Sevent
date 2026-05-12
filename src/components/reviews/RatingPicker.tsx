"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  RATING_DIMENSIONS,
  type RatingDimension,
} from "@/lib/domain/reviews";

export type DimensionLabels = Record<RatingDimension, string>;

export type RatingPickerProps = {
  /** Server-rendered translated labels for each dimension. */
  labels: DimensionLabels;
  /** Initial values (defaults to all 0 — required before submit). */
  initial?: Partial<Record<RatingDimension, number>>;
  disabled?: boolean;
};

const SCALE = [1, 2, 3, 4, 5] as const;

/**
 * Four-dimension star picker. Each dimension submits a hidden input with
 * `name="ratings.<dimension>"` so the server action's Zod parser can pick
 * them up via `formData.get('ratings.overall')` etc.
 *
 * Stars are buttons (not radios) so keyboard users can tab through and
 * Enter/Space to pick. The hidden input keeps the value in the form.
 */
export function RatingPicker({
  labels,
  initial,
  disabled,
}: RatingPickerProps) {
  const [values, setValues] = useState<Record<RatingDimension, number>>(() => ({
    overall: initial?.overall ?? 0,
    value: initial?.value ?? 0,
    punctuality: initial?.punctuality ?? 0,
    professionalism: initial?.professionalism ?? 0,
  }));

  function set(dim: RatingDimension, val: number) {
    setValues((prev) => ({ ...prev, [dim]: val }));
  }

  return (
    <div className="flex flex-col gap-4">
      {RATING_DIMENSIONS.map((dim) => (
        <div key={dim} className="flex flex-col gap-2">
          <label className="text-sm font-medium text-foreground">
            {labels[dim]}
          </label>
          <div
            role="radiogroup"
            aria-label={labels[dim]}
            className="flex items-center gap-1"
          >
            {SCALE.map((n) => {
              const filled = values[dim] >= n;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={values[dim] === n}
                  aria-label={`${n} / 5`}
                  disabled={disabled}
                  onClick={() => set(dim, n)}
                  className={cn(
                    "rounded-md p-1 transition-colors",
                    "hover:bg-brand-cobalt-50 focus-visible:outline-none",
                    "focus-visible:ring-2 focus-visible:ring-brand-cobalt-500",
                    disabled && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <Star
                    className={cn(
                      "size-7 transition-colors",
                      filled
                        ? "fill-brand-gold-400 text-brand-gold-500"
                        : "text-muted-foreground",
                    )}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
          <input
            type="hidden"
            name={`ratings.${dim}`}
            value={values[dim] || ""}
          />
        </div>
      ))}
    </div>
  );
}

export default RatingPicker;
