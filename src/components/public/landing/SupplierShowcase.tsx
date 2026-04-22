import Link from "next/link";
import { Check, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "./SectionHeading";
import type { ShowcaseBullet } from "./RfqShowcase";

type DashboardMockProps = {
  path: string;
  greet: string;
  sub: string;
  approved: string;
  k1Label: string;
  k1Value: string;
  k1Trend: string;
  k2Label: string;
  k2Value: string;
  k2Trend: string;
  k3Label: string;
  k3Value: string;
  invitesHeading: string;
  invites: ReadonlyArray<{
    event: string;
    sub: string;
    due: string;
    cta: string;
    ctaStyle: "primary" | "ghost";
    open?: boolean;
  }>;
};

type SupplierShowcaseProps = {
  id?: string;
  eyebrow: string;
  heading: string;
  lede: string;
  cta1: string;
  cta2: string;
  bullets: ReadonlyArray<ShowcaseBullet>;
  dashboard: DashboardMockProps;
};

/**
 * "For suppliers" split. A browser-framed dashboard mock on one side, value
 * props + CTAs on the other. Demonstrates what suppliers get without
 * requiring them to sign up first.
 */
export function SupplierShowcase({
  id,
  eyebrow,
  heading,
  lede,
  cta1,
  cta2,
  bullets,
  dashboard,
}: SupplierShowcaseProps) {
  return (
    <section
      aria-labelledby={id}
      className="bg-neutral-50 py-20 sm:py-24"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="grid gap-14 md:grid-cols-[1.1fr_1fr] md:items-center md:gap-16">
          <DashboardMock {...dashboard} />

          <div className="flex flex-col gap-6">
            <SectionHeading
              id={id}
              eyebrow={eyebrow}
              heading={heading}
              lede={lede}
            />
            <ul className="mt-2 flex flex-col gap-4">
              {bullets.map((b) => (
                <li key={b.title} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 inline-flex size-[22px] flex-shrink-0 items-center justify-center rounded-full bg-semantic-success-100 text-semantic-success-500"
                  >
                    <Check className="size-3" strokeWidth={3} aria-hidden />
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <strong className="text-[15px] font-bold text-brand-navy-900">
                      {b.title}
                    </strong>
                    <span className="text-sm leading-relaxed text-neutral-600">
                      {b.body}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="bg-brand-cobalt-500 text-white shadow-brand-md hover:bg-brand-cobalt-400"
              >
                <Link href="/sign-up/supplier">{cta1}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/categories">{cta2}</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardMock({
  path,
  greet,
  sub,
  approved,
  k1Label,
  k1Value,
  k1Trend,
  k2Label,
  k2Value,
  k2Trend,
  k3Label,
  k3Value,
  invitesHeading,
  invites,
}: DashboardMockProps) {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-brand-lg"
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 border-b border-border bg-neutral-50 px-4 py-3">
        <span className="size-2.5 rounded-full bg-neutral-200" />
        <span className="size-2.5 rounded-full bg-neutral-200" />
        <span className="size-2.5 rounded-full bg-neutral-200" />
        <span className="ms-3 font-mono text-[11px] text-neutral-400">
          {path}
        </span>
      </div>

      <div className="p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[17px] font-extrabold text-brand-navy-900">
              {greet}
            </span>
            <span className="mt-0.5 text-[13px] text-neutral-600">{sub}</span>
          </div>
          <span className="whitespace-nowrap rounded-full bg-semantic-success-100 px-2.5 py-1 text-[11px] font-bold text-semantic-success-500">
            {approved}
          </span>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-3 gap-3">
          <KpiCell label={k1Label} value={k1Value} trend={k1Trend} />
          <KpiCell label={k2Label} value={k2Value} trend={k2Trend} />
          <KpiCell label={k3Label} value={k3Value} />
        </div>

        {/* Invites list */}
        <div className="mt-5">
          <h4 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-600">
            {invitesHeading}
          </h4>
          <div className="flex flex-col gap-2">
            {invites.map((inv, idx) => (
              <div
                key={idx}
                className="relative grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-[0.625rem] border border-border bg-card px-3.5 py-3"
              >
                {inv.open ? (
                  <span
                    aria-hidden
                    className="absolute size-1.5 rounded-full bg-accent-gold-500 start-[-0.375rem] top-4"
                  />
                ) : null}
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-bold text-brand-navy-900">
                    {inv.event}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-neutral-600">
                    {inv.sub}
                  </div>
                </div>
                <div className="whitespace-nowrap text-[11px] text-neutral-600">
                  {inv.due}
                </div>
                <span
                  className={[
                    "rounded-[0.5rem] px-2.5 py-1.5 text-[12px] font-bold",
                    inv.ctaStyle === "primary"
                      ? "bg-brand-cobalt-500 text-white"
                      : "bg-neutral-100 text-brand-navy-900",
                  ].join(" ")}
                >
                  {inv.cta}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCell({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend?: string;
}) {
  return (
    <div className="rounded-[0.75rem] border border-border bg-neutral-50 p-3.5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-600">
        {label}
      </div>
      <div className="mt-1 text-[20px] font-extrabold text-brand-navy-900">
        {value}
      </div>
      {trend ? (
        <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-semantic-success-500">
          <TrendingUp className="size-3" aria-hidden />
          {trend}
        </div>
      ) : (
        <div className="mt-0.5 h-[16px]" aria-hidden />
      )}
    </div>
  );
}
