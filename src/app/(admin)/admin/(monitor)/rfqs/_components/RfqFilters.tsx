import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

/**
 * Server-rendered filter pill group + a `<form method="get">` search input.
 *
 * Mirrors the verifications page filter pattern (`verifications/page.tsx`
 * lines 149-179): every filter is encoded as a URL query so the page stays a
 * pure server component and admins can deep-link any filtered view. The
 * search input submits via standard GET so we don't need any client JS.
 */

export const RFQ_STATUS_FILTERS = [
  "all",
  "draft",
  "sent",
  "quoted",
  "booked",
  "expired",
  "cancelled",
] as const;
export type RfqStatusFilter = (typeof RFQ_STATUS_FILTERS)[number];

export const PUBLISHED_FILTERS = ["all", "yes", "no"] as const;
export type PublishedFilter = (typeof PUBLISHED_FILTERS)[number];

export type RfqFilterState = {
  status: RfqStatusFilter;
  published: PublishedFilter;
  q: string;
  from: string;
  to: string;
};

function buildHref(base: string, state: RfqFilterState, overrides: Partial<RfqFilterState>): string {
  const merged: RfqFilterState = { ...state, ...overrides };
  const params = new URLSearchParams();
  if (merged.status !== "all") params.set("status", merged.status);
  if (merged.published !== "all") params.set("published", merged.published);
  if (merged.q) params.set("q", merged.q);
  if (merged.from) params.set("from", merged.from);
  if (merged.to) params.set("to", merged.to);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export async function RfqFilters({ state }: { state: RfqFilterState }) {
  const t = await getTranslations("admin.rfqs");
  const base = "/admin/rfqs";

  return (
    <div className="flex flex-col gap-3">
      <nav
        aria-label={t("filter.all")}
        className="inline-flex w-fit flex-wrap items-center gap-1 rounded-lg bg-muted p-1"
      >
        {RFQ_STATUS_FILTERS.map((key) => {
          const active = key === state.status;
          return (
            <Link
              key={key}
              href={buildHref(base, state, { status: key })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-7 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`filter.${key}`)}
            </Link>
          );
        })}
      </nav>

      <nav
        aria-label={t("filter.publishedAll")}
        className="inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-1"
      >
        {PUBLISHED_FILTERS.map((key) => {
          const active = key === state.published;
          const labelKey =
            key === "all"
              ? "publishedAll"
              : key === "yes"
                ? "publishedYes"
                : "publishedNo";
          return (
            <Link
              key={key}
              href={buildHref(base, state, { published: key })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-7 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`filter.${labelKey}`)}
            </Link>
          );
        })}
      </nav>

      <form
        method="get"
        action={base}
        className="flex flex-wrap items-end gap-3 text-sm"
      >
        {/* Preserve non-search filters across submits via hidden inputs */}
        {state.status !== "all" ? (
          <input type="hidden" name="status" value={state.status} />
        ) : null}
        {state.published !== "all" ? (
          <input type="hidden" name="published" value={state.published} />
        ) : null}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {t("search.placeholder")}
          </span>
          <input
            type="search"
            name="q"
            defaultValue={state.q}
            placeholder={t("search.placeholder")}
            className="h-9 w-64 rounded-md border border-border bg-background px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {t("filter.dateFrom")}
          </span>
          <input
            type="date"
            name="from"
            defaultValue={state.from}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {t("filter.dateTo")}
          </span>
          <input
            type="date"
            name="to"
            defaultValue={state.to}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          />
        </label>
        <button
          type="submit"
          className="h-9 rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-muted"
        >
          {t("search.submit")}
        </button>
        {state.q || state.from || state.to ? (
          <Link
            href={buildHref(base, state, { q: "", from: "", to: "" })}
            className="h-9 rounded-md px-3 text-sm text-muted-foreground hover:text-foreground inline-flex items-center"
          >
            {t("search.clear")}
          </Link>
        ) : null}
      </form>
    </div>
  );
}
