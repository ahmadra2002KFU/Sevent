import Link from "next/link";
import {
  addDays,
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { cn } from "@/lib/utils";
import type {
  AvailabilityBlockRow,
  AvailabilityReason,
} from "@/lib/supabase/types";

type ReasonClass = Record<AvailabilityReason, string>;

const DOT_COLOR: ReasonClass = {
  manual_block: "bg-[#e08a2b]", // orange — user-controlled block
  soft_hold: "bg-[#9aa3ab]", // gray — reserved pending supplier confirmation
  booked: "bg-[var(--color-sevent-green-soft)]", // green — confirmed booking
};

const REASON_LABEL: Record<AvailabilityReason, string> = {
  manual_block: "Manual block",
  soft_hold: "Soft hold",
  booked: "Booked",
};

export type MonthGridProps = {
  /** 4-digit year to render. */
  year: number;
  /** 1-12 month (calendar, not JS 0-indexed). */
  month: number;
  /** All availability blocks overlapping this visible month. */
  blocks: AvailabilityBlockRow[];
  /**
   * Optional set of "YYYY-MM-DD" day keys to highlight as conflicting. Wired
   * best-effort from the latest action error; degrades gracefully when empty.
   */
  conflictDays?: Set<string>;
  /** Localized labels. Kept as props so the server page can stay pure. */
  labels: {
    title: string;
    prev: string;
    next: string;
    legendManual: string;
    legendSoftHold: string;
    legendBooked: string;
    weekdays: [string, string, string, string, string, string, string];
    today: string;
  };
};

function dayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function blocksOverlappingDay(
  day: Date,
  blocks: AvailabilityBlockRow[],
): AvailabilityBlockRow[] {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = addDays(dayStart, 1);
  return blocks.filter((b) => {
    const s = parseISO(b.starts_at);
    const e = parseISO(b.ends_at);
    return s < dayEnd && e > dayStart;
  });
}

export function MonthGrid({
  year,
  month,
  blocks,
  conflictDays,
  labels,
}: MonthGridProps) {
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  // Week starts Sunday for KSA convention; `startOfWeek` default weekStartsOn
  // is 0 (Sunday), which matches.
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const today = new Date();

  // 6 weeks × 7 days = 42 cells; always stable visual footprint even when
  // a month only needs 4/5 weeks worth of data.
  const cells: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    cells.push(addDays(gridStart, i));
  }

  const prev = subMonths(monthStart, 1);
  const next = addMonths(monthStart, 1);
  const prevHref = `/supplier/calendar?y=${prev.getFullYear()}&m=${prev.getMonth() + 1}`;
  const nextHref = `/supplier/calendar?y=${next.getFullYear()}&m=${next.getMonth() + 1}`;

  return (
    <section
      aria-label={labels.title}
      className="rounded-xl border border-[var(--color-border)] bg-white p-4 sm:p-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href={prevHref}
            aria-label={labels.prev}
            className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-sm hover:bg-[var(--color-muted)]"
          >
            {"<"}
          </Link>
          <h2 className="text-lg font-semibold tracking-tight">
            {format(monthStart, "MMMM yyyy")}
          </h2>
          <Link
            href={nextHref}
            aria-label={labels.next}
            className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-sm hover:bg-[var(--color-muted)]"
          >
            {">"}
          </Link>
        </div>
        <ul className="flex flex-wrap items-center gap-4 text-xs text-[var(--color-muted-foreground)]">
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn("inline-block h-2.5 w-2.5 rounded-full", DOT_COLOR.manual_block)}
            />
            {labels.legendManual}
          </li>
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn("inline-block h-2.5 w-2.5 rounded-full", DOT_COLOR.soft_hold)}
            />
            {labels.legendSoftHold}
          </li>
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn("inline-block h-2.5 w-2.5 rounded-full", DOT_COLOR.booked)}
            />
            {labels.legendBooked}
          </li>
        </ul>
      </header>

      <div className="grid grid-cols-7 gap-px rounded-lg bg-[var(--color-border)] overflow-hidden">
        {labels.weekdays.map((w) => (
          <div
            key={w}
            className="bg-[var(--color-muted)] px-2 py-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]"
          >
            {w}
          </div>
        ))}
        {cells.map((day) => {
          const inMonth = isSameMonth(day, monthStart);
          const dayBlocks = blocksOverlappingDay(day, blocks);
          const reasons = Array.from(
            new Set(dayBlocks.map((b) => b.reason)),
          ) as AvailabilityReason[];
          const isToday = isSameDay(day, today);
          const isConflict = conflictDays?.has(dayKey(day)) ?? false;

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "relative min-h-[72px] bg-white p-1.5 text-xs",
                !inMonth && "bg-[var(--color-muted)]/40 text-[var(--color-muted-foreground)]",
                isConflict && "ring-2 ring-inset ring-red-400 bg-red-50/60",
              )}
            >
              <div className="flex items-start justify-between">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px]",
                    isToday
                      ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] font-semibold"
                      : inMonth
                        ? "text-[var(--color-foreground)]"
                        : "text-[var(--color-muted-foreground)]",
                  )}
                  aria-label={isToday ? `${format(day, "PPP")} · ${labels.today}` : format(day, "PPP")}
                >
                  {format(day, "d")}
                </span>
                {reasons.length > 0 ? (
                  <span
                    aria-hidden
                    className={cn("h-1 w-8 rounded-full", DOT_COLOR[reasons[0]])}
                  />
                ) : null}
              </div>
              {reasons.length > 0 ? (
                <ul
                  aria-label={dayBlocks
                    .map((b) => REASON_LABEL[b.reason])
                    .join(", ")}
                  className="mt-2 flex flex-wrap gap-1"
                >
                  {reasons.map((r) => (
                    <li
                      key={r}
                      title={REASON_LABEL[r]}
                      className={cn(
                        "inline-block h-2 w-2 rounded-full",
                        DOT_COLOR[r],
                      )}
                    />
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
