"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Compass, MessageCircle, ShieldCheck, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type PendingReviewChecklistProps = {
  /** Email we'll notify when verification completes. */
  email: string;
  /** Current supplier verification status from the DB. */
  verificationStatus: "pending" | "approved" | "rejected";
  /**
   * Admin-supplied notes on a rejected application. Rendered as a quoted
   * "reviewer note" block under the rejected hero. Ignored in the pending
   * and approved branches.
   */
  verificationNotes?: string | null;
  className?: string;
};

/**
 * Status surface rendered on the supplier dashboard while verification is
 * still outstanding.
 *
 *  - `pending`  → reassurance hero ("We've received your application")
 *                 with an email notice + navigation CTAs.
 *  - `rejected` → red-tinted hero with reviewer notes and a "Edit
 *                 application" CTA pointing back at the onboarding wizard.
 *  - `approved` → renders nothing; the dashboard owns that branch.
 *
 * The prior v2 checklist + timeline + "start your catalog" side card have
 * all been removed — we no longer lie about per-check status because the
 * DB doesn't track it, and the side card linked to a catalog surface the
 * supplier can't use until approval anyway.
 */
export function PendingReviewChecklist({
  email,
  verificationStatus,
  verificationNotes,
  className,
}: PendingReviewChecklistProps) {
  if (verificationStatus === "approved") {
    return null;
  }

  if (verificationStatus === "rejected") {
    return (
      <RejectedHero notes={verificationNotes ?? null} className={className} />
    );
  }

  return <PendingHero email={email} className={className} />;
}

function PendingHero({
  email,
  className,
}: {
  email: string;
  className?: string;
}) {
  const t = useTranslations("supplier.pending");

  return (
    <div className={cn("mx-auto w-full max-w-[980px]", className)}>
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
              href={t("primaryHref")}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cobalt-500 focus-visible:ring-offset-2"
            >
              {t("primaryCta")}
            </Link>
            <Link
              href={t("browseHref")}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 transition-colors hover:border-brand-cobalt-500/40 hover:text-brand-cobalt-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cobalt-500 focus-visible:ring-offset-2"
            >
              <Compass className="h-4 w-4" aria-hidden />
              {t("browseCta")}
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
    </div>
  );
}

function RejectedHero({
  notes,
  className,
}: {
  notes: string | null;
  className?: string;
}) {
  const t = useTranslations("supplier.rejected");
  const hasNotes = typeof notes === "string" && notes.trim().length > 0;

  return (
    <div className={cn("mx-auto w-full max-w-[980px]", className)}>
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 28 }}
        className="flex flex-col items-start gap-6 rounded-2xl border border-semantic-danger-500/40 p-8 sm:flex-row sm:items-start sm:gap-6"
        style={{
          background:
            "linear-gradient(135deg, #ffffff 0%, rgb(254 226 226 / 0.55) 100%)",
        }}
      >
        {/* Static red-tinted badge — no spinning ring; the state is not in flight. */}
        <div className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full border-[3px] border-semantic-danger-500 bg-white text-semantic-danger-500">
          <XCircle className="h-8 w-8" aria-hidden />
        </div>

        <div className="flex-1">
          <div className="text-xs font-bold tracking-wide text-semantic-danger-500">
            {t("statusPill")}
          </div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-brand-navy-900">
            {t("title")}
          </h1>
          <p className="mt-2.5 max-w-[600px] text-sm leading-relaxed text-neutral-600">
            {t("body")}
          </p>

          {hasNotes ? (
            <div className="mt-4 rounded-xl border border-semantic-danger-500/30 bg-semantic-danger-100/50 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-semantic-danger-500">
                {t("notesHeading")}
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-brand-navy-900">
                {notes}
              </p>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <Link
              href="/supplier/onboarding"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-navy-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cobalt-500 focus-visible:ring-offset-2"
            >
              {t("ctaPrimary")}
            </Link>
          </div>
        </div>
      </motion.section>
    </div>
  );
}

export default PendingReviewChecklist;
