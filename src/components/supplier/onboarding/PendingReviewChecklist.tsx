"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import {
  ArrowRight,
  CheckCircle2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  deriveChecklistStates,
  type CheckKey,
  type CheckState,
} from "@/lib/domain/verificationDisplay";

export type PendingReviewChecklistProps = {
  /** Email we'll notify when verification completes. */
  email: string;
  /** Current supplier verification status from the DB. */
  verificationStatus: "pending" | "approved" | "rejected";
  className?: string;
};

// When rendering the checklist copy we normally pick between three description
// variants per check. For the `failed` state we re-use the `descDone` copy so
// the surface still reads naturally — the failed-state affordance is
// communicated via the red dot + trailing glyph rather than a new string.
type DescVariant = "Done" | "Running" | "Waiting";

function descVariantForState(state: CheckState): DescVariant {
  switch (state) {
    case "done":
    case "failed":
      return "Done";
    case "running":
      return "Running";
    case "waiting":
    default:
      return "Waiting";
  }
}

function StatusDot({ state }: { state: CheckState }) {
  if (state === "done") {
    return (
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 24 }}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-semantic-success-500 text-white"
        aria-hidden
      >
        <CheckCircle2 className="h-4 w-4" strokeWidth={2.4} />
      </motion.div>
    );
  }

  if (state === "running") {
    return (
      <div
        className="relative flex h-7 w-7 items-center justify-center rounded-full bg-brand-cobalt-500 text-white"
        aria-hidden
      >
        <motion.svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
        >
          <circle
            cx="9"
            cy="9"
            r="7"
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="2.2"
          />
          <circle
            cx="9"
            cy="9"
            r="7"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.2"
            strokeDasharray="12 44"
            strokeLinecap="round"
          />
        </motion.svg>
      </div>
    );
  }

  if (state === "failed") {
    return (
      <div
        className="flex h-7 w-7 items-center justify-center rounded-full bg-semantic-danger-500 text-white"
        aria-hidden
      >
        <XCircle className="h-4 w-4" strokeWidth={2.4} />
      </div>
    );
  }

  return (
    <div
      className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-neutral-600"
      aria-hidden
    >
      <span className="h-1.5 w-1.5 rounded-full bg-neutral-600" />
    </div>
  );
}

function statusTrailing(state: CheckState): string {
  switch (state) {
    case "done":
      return "✓";
    case "running":
      return "…";
    case "failed":
      return "✗";
    case "waiting":
    default:
      return "—";
  }
}

function trailingColor(state: CheckState): string {
  switch (state) {
    case "done":
      return "text-semantic-success-500";
    case "running":
      return "text-brand-cobalt-500";
    case "failed":
      return "text-semantic-danger-500";
    case "waiting":
    default:
      return "text-neutral-400";
  }
}

/**
 * Rich pending-review view for the supplier dashboard.
 * Accepts only the supplier's email + DB verification status — the checklist
 * rows are derived cosmetically via `deriveChecklistStates` and copy comes
 * from the `supplier.pending` translation namespace. Keeps this component a
 * pure translation + status → UI transform so a future per-check state
 * column on the DB can plug in by swapping the derivation function.
 */
export function PendingReviewChecklist({
  email,
  verificationStatus,
  className,
}: PendingReviewChecklistProps) {
  const t = useTranslations("supplier.pending");
  const checks = deriveChecklistStates(verificationStatus);

  return (
    <div className={cn("mx-auto w-full max-w-[980px]", className)}>
      {/* Top banner */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 28 }}
        className="flex flex-col items-start gap-6 rounded-2xl border border-neutral-200 p-8 sm:flex-row sm:items-start sm:gap-6"
        style={{
          background:
            "linear-gradient(135deg, #ffffff 0%, rgb(220 235 251 / 0.55) 100%)",
        }}
      >
        {/* Animated spinner ring with shield */}
        <div className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full border-[3px] border-brand-cobalt-500 bg-white text-brand-cobalt-500">
          <motion.svg
            width="72"
            height="72"
            viewBox="0 0 72 72"
            className="absolute -inset-[3px]"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            aria-hidden
          >
            <circle
              cx="36"
              cy="36"
              r="34"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray="50 214"
              strokeLinecap="round"
            />
          </motion.svg>
          <ShieldCheck className="h-8 w-8" aria-hidden />
        </div>

        <div className="flex-1">
          <div className="text-xs font-bold tracking-wide text-brand-cobalt-500">
            {t("statusPill")}
          </div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-brand-navy-900">
            {t("title")}
          </h1>
          <p className="mt-2.5 max-w-[600px] text-sm leading-relaxed text-neutral-600">
            {t("sub")}{" "}
            <span className="text-brand-navy-900">
              {t("emailNotice", { email })}
            </span>
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <Link
              href="/supplier/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cobalt-500 focus-visible:ring-offset-2"
            >
              {t("primaryCta")}
            </Link>
            <a
              href="mailto:verification@sevent.sa"
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 transition-colors hover:border-brand-cobalt-500/40 hover:text-brand-cobalt-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cobalt-500 focus-visible:ring-offset-2"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              {t("chatCta")}
            </a>
          </div>
        </div>
      </motion.section>

      {/* Two-column grid */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        {/* Checklist card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, type: "spring", stiffness: 220, damping: 28 }}
          className="rounded-2xl border border-neutral-200 bg-white px-5 py-4"
        >
          <h3 className="text-[15px] font-bold text-brand-navy-900">
            {t("checklistTitle")}
          </h3>
          <ul className="mt-2">
            {checks.map((c, i) => {
              const variant = descVariantForState(c.state);
              return (
                <motion.li
                  key={c.key}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: 0.18 + i * 0.06,
                    type: "spring",
                    stiffness: 260,
                    damping: 28,
                  }}
                  className={cn(
                    "grid grid-cols-[32px_1fr_auto] items-start gap-3 py-3.5",
                    i > 0 && "border-t border-neutral-200",
                  )}
                >
                  <StatusDot state={c.state} />
                  <div>
                    <div className="text-sm font-semibold text-neutral-900">
                      {t(`checks.${c.key as CheckKey}.title`)}
                    </div>
                    <div className="mt-1 text-[13px] leading-relaxed text-neutral-600">
                      {t(`checks.${c.key as CheckKey}.desc${variant}`)}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "text-[11px] font-bold uppercase tracking-wider",
                      trailingColor(c.state),
                    )}
                  >
                    {statusTrailing(c.state)}
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </motion.div>

        {/* Right column: timeline + navy card */}
        <div className="flex flex-col gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, type: "spring", stiffness: 220, damping: 28 }}
            className="rounded-2xl border border-neutral-200 bg-white px-5 py-4"
          >
            <h3 className="mb-3.5 text-[15px] font-bold text-brand-navy-900">
              {t("timelineTitle")}
            </h3>
            <div className="relative ps-4">
              <div className="absolute start-[6px] top-1 bottom-1 w-[1.5px] bg-neutral-200" />
              {[0, 1, 2].map((i) => (
                <div key={i} className="relative pb-4 last:pb-0">
                  <div
                    className={cn(
                      "absolute -start-3 top-0.5 h-[13px] w-[13px] rounded-full border-2",
                      i === 0
                        ? "border-brand-cobalt-500 bg-brand-cobalt-500"
                        : "border-neutral-200 bg-white",
                    )}
                  />
                  <div className="text-sm font-bold text-brand-navy-900">
                    {t(`timeline.${i}.title`)}
                  </div>
                  <div className="mt-0.5 text-xs text-neutral-600">
                    {t(`timeline.${i}.desc`)}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Navy side card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, type: "spring", stiffness: 220, damping: 28 }}
            className="relative overflow-hidden rounded-2xl bg-brand-navy-900 p-5 text-white"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -top-8 end-[-30px] h-32 w-32 rounded-full"
              style={{
                background: "rgb(30 123 216 / 0.27)",
                filter: "blur(30px)",
              }}
            />
            <div className="relative">
              <Sparkles
                className="h-5 w-5 text-accent-gold-500"
                aria-hidden
              />
              <div className="mt-2.5 text-[15px] font-bold leading-snug">
                {t("sideCard.title")}
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/65">
                {t("sideCard.body")}
              </p>
              <Link
                href="/supplier/catalog"
                className="mt-3.5 inline-flex items-center gap-1.5 rounded-md bg-white/15 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                {t("sideCard.cta")}
                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default PendingReviewChecklist;
