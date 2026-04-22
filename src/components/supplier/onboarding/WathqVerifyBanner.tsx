"use client";

import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, ShieldCheck } from "lucide-react";

export type WathqVerifyBannerProps = {
  businessName: string;
  city: string;
  activeSinceYear?: string;
  labels: {
    prefix: string;
    status: string;
  };
};

/**
 * "Auto-verified via Wathq" green confirmation banner.
 * Fades+slides in when businessName transitions from empty → filled.
 */
export function WathqVerifyBanner({
  businessName,
  city,
  activeSinceYear,
  labels,
}: WathqVerifyBannerProps) {
  const shown = businessName.trim().length > 0;

  return (
    <AnimatePresence initial={false}>
      {shown ? (
        <motion.div
          key="banner"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: "spring", stiffness: 360, damping: 28 }}
          role="status"
          className="flex items-center gap-2.5 rounded-lg bg-semantic-success-100 px-3.5 py-2.5 text-[13px] text-brand-navy-900"
        >
          <ShieldCheck
            className="size-4 shrink-0 text-semantic-success-500"
            strokeWidth={1.8}
          />
          <span className="min-w-0 flex-1 truncate">
            <b className="font-bold">{labels.prefix}</b> {businessName} ·{" "}
            {labels.status} · {city}
            {activeSinceYear ? ` · ${activeSinceYear}` : ""}
          </span>
          <CheckCircle2
            className="ms-auto size-4 shrink-0 text-semantic-success-500"
            strokeWidth={2}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
