import Link from "next/link";
import { ArrowRight, BadgeCheck, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "./SectionHeading";

export type ShowcaseBullet = {
  title: string;
  body: string;
};

export type QuoteRow = {
  initial: string;
  initialBg: "cobalt" | "gold" | "success";
  name: string;
  meta: string;
  price: string;
  unit: string;
  verified: string;
  best?: { label: string };
};

type RfqShowcaseProps = {
  eyebrow: string;
  heading: string;
  lede: string;
  cta: string;
  bullets: ReadonlyArray<ShowcaseBullet>;
  mock: {
    rfqTitle: string;
    rfqSub: string;
    rfqStatus: string;
    quotesLeft: string;
    compareAll: string;
    rows: ReadonlyArray<QuoteRow>;
  };
};

const INITIAL_BG_STYLES: Record<QuoteRow["initialBg"], string> = {
  cobalt: "bg-neutral-100 text-brand-navy-900",
  gold: "bg-accent-gold-100 text-accent-gold-500",
  success: "bg-semantic-success-100 text-semantic-success-500",
};

/**
 * "Compare quotes like a pro" section. Two-column layout: copy + bullets on
 * one side, a mock RFQ comparison panel on the other. The panel mirrors the
 * supplier-facing quote comparison UX so organizers can see what they'd use.
 */
export function RfqShowcase({
  eyebrow,
  heading,
  lede,
  cta,
  bullets,
  mock,
}: RfqShowcaseProps) {
  return (
    <section className="bg-neutral-50 py-20 sm:py-24">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="grid gap-14 md:grid-cols-[1fr_1.1fr] md:items-center md:gap-16">
          <div className="flex flex-col gap-6">
            <SectionHeading eyebrow={eyebrow} heading={heading} lede={lede} />
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
            <div className="mt-2">
              <Button
                asChild
                size="lg"
                className="bg-brand-cobalt-500 text-white shadow-brand-md hover:bg-brand-cobalt-400"
              >
                <Link href="/sign-up?role=organizer">
                  {cta}
                  <ArrowRight
                    className="size-4 rtl:-scale-x-100"
                    aria-hidden
                  />
                </Link>
              </Button>
            </div>
          </div>

          {/* Mock RFQ comparison panel */}
          <div
            aria-hidden
            className="overflow-hidden rounded-2xl border border-border bg-card shadow-brand-lg"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border bg-neutral-50 px-5 py-4">
              <div className="flex flex-col">
                <span className="text-[13px] font-bold text-brand-navy-900">
                  {mock.rfqTitle}
                </span>
                <span className="mt-0.5 text-xs text-neutral-600">
                  {mock.rfqSub}
                </span>
              </div>
              <span className="whitespace-nowrap rounded-full bg-brand-cobalt-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-cobalt-500">
                {mock.rfqStatus}
              </span>
            </div>
            <div className="flex flex-col gap-2.5 p-5">
              {mock.rows.map((row, idx) => (
                <QuoteRowBlock key={idx} row={row} />
              ))}
              <div className="mt-2 flex items-center justify-between gap-3 rounded-[0.625rem] border border-dashed border-border bg-neutral-50 px-4 py-3">
                <span className="text-xs text-neutral-600">
                  {mock.quotesLeft}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-cobalt-500">
                  {mock.compareAll}
                  <ArrowRight
                    className="size-3.5 rtl:-scale-x-100"
                    aria-hidden
                  />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuoteRowBlock({ row }: { row: QuoteRow }) {
  const initialStyles = INITIAL_BG_STYLES[row.initialBg];
  const isBest = Boolean(row.best);
  return (
    <div
      className={[
        "grid grid-cols-[40px_1fr_auto] items-center gap-3 rounded-[0.75rem] border p-3",
        isBest
          ? "border-brand-cobalt-500 bg-[color:var(--color-brand-cobalt-100)]/30 shadow-[0_0_0_3px_rgba(30,123,216,0.08)]"
          : "border-border bg-card",
      ].join(" ")}
    >
      <div
        className={`inline-flex size-10 items-center justify-center rounded-[0.625rem] text-sm font-extrabold ${initialStyles}`}
        aria-hidden
      >
        {row.initial}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-bold text-brand-navy-900">
          <span className="truncate">{row.name}</span>
          {row.best ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-gold-500 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white">
              {row.best.label}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-neutral-600">
          <span className="inline-flex items-center gap-1 font-bold text-semantic-success-500">
            <BadgeCheck className="size-3" aria-hidden />
            {row.verified}
          </span>
          <span>{row.meta}</span>
        </div>
      </div>
      <div className="flex min-w-[96px] flex-col items-end text-end rtl:items-start rtl:text-start">
        <span className="whitespace-nowrap text-[15px] font-extrabold leading-tight text-brand-navy-900">
          {row.price}
        </span>
        <span className="mt-0.5 whitespace-nowrap text-[11px] text-neutral-600">
          {row.unit}
        </span>
      </div>
    </div>
  );
}
