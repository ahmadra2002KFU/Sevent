"use client";

import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2 } from "lucide-react";

export type AutoSaveIndicatorProps = {
  label: string;
  visible: boolean;
};

/**
 * Subtle "draft saved" indicator line. Fades in/out via AnimatePresence.
 */
export function AutoSaveIndicator({ label, visible }: AutoSaveIndicatorProps) {
  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.span
          key="autosave"
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -2 }}
          transition={{ duration: 0.2 }}
          role="status"
          aria-live="polite"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-600"
        >
          <CheckCircle2
            className="size-3 text-semantic-success-500"
            strokeWidth={2.2}
          />
          {label}
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}
