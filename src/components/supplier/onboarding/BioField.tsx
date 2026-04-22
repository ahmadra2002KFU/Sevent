"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type BioFieldLabels = {
  /** Field label, e.g. "Short bio" */
  label: string;
  /** Textarea placeholder */
  placeholder: string;
  /** Supporting helper text under the field (optional) */
  hint?: string;
  /** `{count}/{max}` — caller pre-interpolates, or passes a function */
  counter: (count: number, max: number) => string;
  /** Inline autosave indicator text, e.g. "Auto-saved moments ago" */
  savedMoments: string;
};

export type BioFieldProps = {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  labels: BioFieldLabels;
  /** Optional error message rendered under the field. */
  error?: string;
  /** Native textarea id if caller needs label association. */
  id?: string;
  /** Pass-through `name` for react-hook-form registration via Controller. */
  name?: string;
  /** Invoked when the textarea blurs — useful for RHF. */
  onBlur?: () => void;
};

/**
 * Textarea with a cobalt focus ring, live character counter, and an inline
 * autosave indicator that blinks in briefly after each edit burst.
 *
 * Visual spec: `Claude Docs/mockup-source/direction-a.jsx:320-338`.
 */
export const BioField = forwardRef<HTMLTextAreaElement, BioFieldProps>(
  function BioField(
    {
      value,
      onChange,
      maxLength = 240,
      labels,
      error,
      id,
      name,
      onBlur,
    },
    ref,
  ) {
    const [focused, setFocused] = useState(false);
    const [savedVisible, setSavedVisible] = useState(false);
    const timers = useRef<{
      debounce: ReturnType<typeof setTimeout> | null;
      hide: ReturnType<typeof setTimeout> | null;
    }>({ debounce: null, hide: null });

    useEffect(() => {
      const t = timers.current;
      if (t.debounce) clearTimeout(t.debounce);
      if (value.length === 0) {
        // No content → no autosave indicator. Clear any pending reveal.
        if (t.hide) clearTimeout(t.hide);
        return;
      }
      t.debounce = setTimeout(() => {
        setSavedVisible(true);
        if (t.hide) clearTimeout(t.hide);
        t.hide = setTimeout(() => setSavedVisible(false), 2000);
      }, 600);
      return () => {
        if (t.debounce) clearTimeout(t.debounce);
      };
    }, [value]);

    useEffect(() => {
      const t = timers.current;
      return () => {
        if (t.debounce) clearTimeout(t.debounce);
        if (t.hide) clearTimeout(t.hide);
      };
    }, []);

    const count = value.length;

    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={id}
          className="text-[13px] font-semibold text-brand-navy-900"
        >
          {labels.label}
        </label>
        <div
          className={cn(
            "rounded-lg border bg-white transition",
            focused
              ? "border-brand-cobalt-500 ring-[3px] ring-brand-cobalt-500/15"
              : "border-neutral-200",
            error && "border-semantic-danger-500",
          )}
        >
          <textarea
            ref={ref}
            id={id}
            name={name}
            value={value}
            onChange={(e) => {
              const next = e.target.value;
              onChange(next.length > maxLength ? next.slice(0, maxLength) : next);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              onBlur?.();
            }}
            placeholder={labels.placeholder}
            maxLength={maxLength}
            rows={4}
            className="block w-full resize-none rounded-t-lg border-0 bg-transparent px-3.5 py-3 text-[14px] leading-relaxed text-brand-navy-900 outline-none placeholder:text-neutral-400"
          />
          <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-3 py-1.5 text-[11.5px] text-neutral-600">
            <span
              className={cn(
                "inline-flex items-center gap-1 transition-opacity",
                savedVisible ? "opacity-100" : "opacity-0",
              )}
              aria-live="polite"
            >
              <CheckCircle2
                className="size-3 text-semantic-success-500"
                strokeWidth={2.2}
                aria-hidden
              />
              {labels.savedMoments}
            </span>
            <span className="tabular-nums">{labels.counter(count, maxLength)}</span>
          </div>
        </div>
        {labels.hint && !error ? (
          <div className="text-[12px] text-neutral-600">{labels.hint}</div>
        ) : null}
        {error ? (
          <div className="text-[12px] text-semantic-danger-500">{error}</div>
        ) : null}
      </div>
    );
  },
);
