"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Clock,
  Eye,
  Inbox,
  MapPin,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { markApprovedSeenAction } from "@/app/(supplier)/supplier/dashboard/celebration-actions";

export type MatchingRfq = {
  id: string;
  orgInitials: string;
  orgLabel: string;
  /** Pre-localized city label — caller resolves the slug via `cityNameFor`. */
  city: string;
  dateLabel: string;
  budgetLabel: string;
  matchPct: number;
  href: string;
};

export type ApprovedCelebrationProps = {
  firstName: string;
  publicProfileUrl: string;
  pendingRfqCount: number;
  matchingRfqs: MatchingRfq[];
};

// Deterministic-but-varied confetti positions. Using Math.random() on the
// client would hydrate with different coordinates than the server render,
// so we seed once per mount and memoize the layout for the lifetime of the
// component. A small LCG keeps this dependency-free.
function seededConfetti(
  count: number,
  seed: number,
): Array<{
  top: string;
  start: string;
  w: number;
  h: number;
  rot: number;
  color: string;
}> {
  const colors = ["#c8993a", "#ffffff", "#dcebfb"];
  let s = seed || 1;
  const rand = () => {
    // Numerical Recipes LCG. Deterministic, no crypto needed for decoration.
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  return Array.from({ length: count }, (_, i) => ({
    top: `${rand() * 100}%`,
    start: `${rand() * 100}%`,
    w: 6 + rand() * 4,
    h: 10 + rand() * 6,
    rot: rand() * 360,
    color: colors[i % colors.length]!,
  }));
}

export function ApprovedCelebration({
  firstName,
  publicProfileUrl,
  pendingRfqCount,
  matchingRfqs,
}: ApprovedCelebrationProps) {
  const t = useTranslations("supplier.welcome");
  const stamped = useRef(false);

  // Stamp `first_seen_approved_at` exactly once per mount. We only need it
  // to fire once — subsequent mounts won't find a null row and the update
  // is a no-op anyway, but guarding here avoids a redundant RPC during
  // React's Strict-Mode double-invoke in development.
  useEffect(() => {
    if (stamped.current) return;
    stamped.current = true;
    void markApprovedSeenAction();
  }, []);

  const confetti = useMemo(() => seededConfetti(14, 20260422), []);

  return (
    <div className="mx-auto w-full max-w-[1060px]">
      {/* Celebration banner */}
      <section
        className="relative overflow-hidden rounded-2xl p-7 text-white sm:p-8"
        style={{
          background:
            "linear-gradient(105deg, #1e9a5b 0%, #1e7bd8 100%)",
        }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {confetti.map((c, i) => (
            <span
              key={i}
              className="absolute rounded-[1px] opacity-80"
              style={{
                top: c.top,
                insetInlineStart: c.start,
                width: `${c.w}px`,
                height: `${c.h}px`,
                background: c.color,
                transform: `rotate(${c.rot}deg)`,
              }}
            />
          ))}
        </div>

        <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-white/20">
            <BadgeCheck className="size-9" aria-hidden />
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold tracking-wide opacity-85">
              {t("congratsEyebrow", { name: firstName })}
            </div>
            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 28 }}
              className="mt-1 text-3xl font-extrabold tracking-tight"
            >
              {t("congrats")}
            </motion.h1>
            <p className="mt-2 max-w-[600px] text-sm leading-relaxed opacity-90">
              {t("sub", { count: pendingRfqCount })}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:self-center">
            <Link
              href="/supplier/rfqs"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-brand-navy-900 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-cobalt-500"
            >
              {t("cta1")}
              {pendingRfqCount > 0 ? (
                <span className="rounded-full bg-brand-navy-900/10 px-2 py-0.5 text-xs">
                  {pendingRfqCount}
                </span>
              ) : null}
            </Link>
            <Link
              href={publicProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-black/15 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              {t("cta2")}
            </Link>
          </div>
        </div>
      </section>

      {/* KPI strip */}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Kpi
          icon={Inbox}
          accentColor="#1e7bd8"
          label={t("kpi.rfqs")}
          value={pendingRfqCount}
          sub={t("kpi.rfqsSub")}
        />
        <Kpi
          icon={Eye}
          accentColor="#1e9a5b"
          label={t("kpi.views")}
          value={0}
          sub={t("kpi.viewsSub")}
        />
        <Kpi
          icon={Clock}
          accentColor="#c8993a"
          label={t("kpi.responseTime")}
          value="—"
          sub={t("kpi.responseTimeSub")}
        />
      </div>

      {/* Main grid */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Matching RFQs */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-[15px] font-bold text-brand-navy-900">
              {t("matchingRfqsTitle")}
            </h3>
            {matchingRfqs.length > 0 ? (
              <Link
                href="/supplier/rfqs"
                className="text-xs font-semibold text-brand-cobalt-500 hover:text-brand-cobalt-400"
              >
                {t("matchingRfqsViewAll")}
              </Link>
            ) : null}
          </div>
          {matchingRfqs.length === 0 ? (
            <p className="rounded-lg bg-neutral-100 px-4 py-6 text-center text-sm text-neutral-600">
              {t("matchingRfqsEmpty")}
            </p>
          ) : (
            <ul className="flex flex-col">
              {matchingRfqs.map((r, i) => {
                const strong = r.matchPct > 80;
                return (
                  <li
                    key={r.id}
                    className={cn(
                      "flex items-center gap-3.5 py-3.5",
                      i > 0 && "border-t border-neutral-200",
                    )}
                  >
                    <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-[11px] font-extrabold text-neutral-600">
                      {r.orgInitials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-bold text-brand-navy-900">
                        {r.orgLabel}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-neutral-600">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" aria-hidden />
                          {r.city}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="size-3" aria-hidden />
                          {r.dateLabel}
                        </span>
                        <span>{r.budgetLabel}</span>
                      </div>
                    </div>
                    <div className="text-end">
                      <div
                        className={cn(
                          "text-xs font-bold",
                          strong ? "text-semantic-success-500" : "text-accent-gold-500",
                        )}
                      >
                        {r.matchPct}% {t("matchingRfqsMatch")}
                      </div>
                      <Link
                        href={r.href}
                        className="mt-1 inline-block text-xs font-semibold text-brand-cobalt-500 hover:text-brand-cobalt-400"
                      >
                        {t("matchingRfqsSend")}
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Tour card */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h3 className="text-[15px] font-bold text-brand-navy-900">
            {t("tourTitle")}
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-neutral-600">
            {t("tourSub")}
          </p>
          <div className="mt-3.5 grid gap-2.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl bg-neutral-100 p-2.5 px-3"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-neutral-600">
                  <Eye className="size-3.5" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-brand-navy-900">
                    {t(`tour.${i}.title`)}
                  </div>
                  <div className="text-[11.5px] text-neutral-600">
                    {t(`tour.${i}.desc`)}
                  </div>
                </div>
                <ArrowRight className="size-3.5 text-neutral-600 rtl:rotate-180" aria-hidden />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  accentColor,
  label,
  value,
  sub,
}: {
  icon: typeof TrendingUp;
  accentColor: string;
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-neutral-200 bg-white px-4 py-3.5">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
        style={{ background: `${accentColor}22`, color: accentColor }}
      >
        <Icon className="size-4" aria-hidden />
      </div>
      <div>
        <div className="text-[11.5px] font-semibold text-neutral-600">
          {label}
        </div>
        <div className="mt-0.5 text-2xl font-extrabold leading-none text-brand-navy-900">
          {value}
        </div>
        <div className="text-[11px] text-neutral-600">{sub}</div>
      </div>
    </div>
  );
}

export default ApprovedCelebration;
