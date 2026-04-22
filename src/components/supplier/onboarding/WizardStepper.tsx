"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { Fragment } from "react";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";

export type WizardStepperProps = {
  current: 1 | 2 | 3;
  labels: [string, string, string];
};

// Arabic-Indic digits for the step circles when the locale is ar. Mirrors
// the mock's `AR.path.step` convention — Latin callers still see 1/2/3.
const ARABIC_DIGITS: Record<1 | 2 | 3, string> = {
  1: "١",
  2: "٢",
  3: "٣",
};

/**
 * 3-step horizontal connected stepper with spring transitions
 * on the active circle and color animation on connecting lines.
 */
export function WizardStepper({ current, labels }: WizardStepperProps) {
  const locale = useLocale();
  const isArabic = locale === "ar";
  return (
    <div
      role="list"
      aria-label="progress"
      className="mb-7 flex items-center gap-0"
    >
      {labels.map((label, i) => {
        const index = (i + 1) as 1 | 2 | 3;
        const done = index < current;
        const active = index === current;

        return (
          <Fragment key={label}>
            <div role="listitem" className="flex items-center gap-2.5">
              <motion.div
                animate={{
                  scale: active ? 1.05 : 1,
                  backgroundColor: done
                    ? "rgb(30 154 91)"
                    : active
                      ? "rgb(30 123 216)"
                      : "rgb(231 230 223)",
                  color: done || active ? "rgb(255 255 255)" : "rgb(107 107 100)",
                }}
                transition={{ type: "spring", stiffness: 360, damping: 22 }}
                className="flex size-7 items-center justify-center rounded-full text-xs font-bold"
                aria-current={active ? "step" : undefined}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {done ? (
                    <motion.span
                      key="check"
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0, rotate: 45 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className="flex"
                    >
                      <Check className="size-3.5" strokeWidth={3} />
                    </motion.span>
                  ) : (
                    <motion.span
                      key={`n-${index}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {isArabic ? ARABIC_DIGITS[index] : index}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
              <span
                className={cn(
                  "text-[13.5px] transition-colors",
                  // Labels disappear on very narrow screens — on xs/sm the
                  // circles + connectors carry the progress info. Keeps the
                  // stepper from overflowing and creating a horizontal
                  // scrollbar on mobile, where the Arabic step titles are
                  // long (e.g. "التوثيق والهوية البصرية").
                  "hidden sm:inline",
                  active
                    ? "font-bold text-brand-navy-900"
                    : "font-medium text-neutral-600",
                )}
              >
                {label}
              </span>
            </div>

            {i < labels.length - 1 ? (
              <motion.div
                aria-hidden
                className="mx-2 h-0.5 flex-1 rounded-full sm:mx-4"
                animate={{
                  backgroundColor: done
                    ? "rgb(30 154 91)"
                    : "rgb(231 230 223)",
                }}
                transition={{ duration: 0.35 }}
              />
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}
