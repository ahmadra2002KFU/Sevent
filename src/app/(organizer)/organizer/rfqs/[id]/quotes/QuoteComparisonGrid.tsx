"use client";

/**
 * Side-by-side quote-comparison grid (suppliers as columns, criteria as rows).
 *
 * The first column is sticky and labels each criterion; every subsequent
 * column is one supplier. Sort + filter are client-only state — the full
 * dataset is loaded once by `loader.ts`. "Inclusions / Exclusions / Line
 * items" rows are collapsible: expanding one collapses the others so the
 * vertical layout stays bounded.
 *
 * Each supplier column owns its own `useActionState` for Accept and
 * Request-Proposal so an error on one supplier never clears another's state.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  FileText,
  Hourglass,
  Loader2,
  Printer,
  ShieldCheck,
  X,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatHalalas } from "@/lib/domain/money";
import { fmtDateTime, type SupportedLocale } from "@/lib/domain/formatDate";
import {
  acceptQuoteAction,
  cancelProposalRequestAction,
  requestProposalAction,
} from "./actions";
import {
  initialActionState,
  initialRfpRequestActionState,
  type ActionState,
  type RfpRequestActionState,
} from "./action-state";
import type { QuoteColumn, QuotesComparisonData } from "./loader";

type SortKey =
  | "submitted_desc"
  | "submitted_asc"
  | "total_asc"
  | "total_desc"
  | "deposit_asc"
  | "deposit_desc"
  | "expires_asc"
  | "expires_desc";

type Filters = {
  hasTechProposal: boolean;
  noConflict: boolean;
  source_self_applied: boolean;
  source_auto_match: boolean;
  source_organizer_picked: boolean;
};

type ExpandKey = "inclusions" | "exclusions" | "line_items" | null;

type Props = {
  data: QuotesComparisonData;
};

// ---------- helpers ---------------------------------------------------------

function compareCols(a: QuoteColumn, b: QuoteColumn, key: SortKey): number {
  const dir = key.endsWith("_asc") ? 1 : -1;
  if (key.startsWith("submitted")) {
    const av = a.submitted_at ?? "";
    const bv = b.submitted_at ?? "";
    return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
  }
  if (key.startsWith("total")) {
    return (a.snapshot.total_halalas - b.snapshot.total_halalas) * dir;
  }
  if (key.startsWith("deposit")) {
    return (a.snapshot.deposit_pct - b.snapshot.deposit_pct) * dir;
  }
  // expires
  const av = a.snapshot.expires_at ?? "";
  const bv = b.snapshot.expires_at ?? "";
  return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
}

function applyFilters(cols: QuoteColumn[], f: Filters): QuoteColumn[] {
  const anySource =
    f.source_self_applied || f.source_auto_match || f.source_organizer_picked;
  return cols.filter((c) => {
    if (f.hasTechProposal && !c.tech_proposal_url) return false;
    if (f.noConflict && c.has_conflict) return false;
    if (anySource) {
      const ok =
        (f.source_self_applied && c.invite_source === "self_applied") ||
        (f.source_auto_match && c.invite_source === "auto_match") ||
        (f.source_organizer_picked && c.invite_source === "organizer_picked");
      if (!ok) return false;
    }
    return true;
  });
}

// ---------- per-supplier action subcomponents ------------------------------

function AcceptForm({
  rfqId,
  quoteId,
}: {
  rfqId: string;
  quoteId: string;
}) {
  const t = useTranslations("organizer.quote.compare");
  const [state, action] = useActionState<ActionState, FormData>(
    acceptQuoteAction,
    initialActionState,
  );
  return (
    <div className="flex flex-col gap-2">
      <form action={action}>
        <input type="hidden" name="quote_id" value={quoteId} />
        <input type="hidden" name="rfq_id" value={rfqId} />
        <AcceptButton label={t("acceptCta")} pendingLabel={t("accepting")} />
      </form>
      {state.status === "error" ? (
        <Alert variant="destructive" className="px-2 py-1.5">
          <AlertTriangle className="size-3.5" aria-hidden />
          <AlertDescription className="text-xs">
            {state.message}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function AcceptButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending} className="w-full">
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          {pendingLabel}
        </>
      ) : (
        <>
          <Check aria-hidden />
          {label}
        </>
      )}
    </Button>
  );
}

function RfpCell({
  rfqId,
  col,
}: {
  rfqId: string;
  col: QuoteColumn;
}) {
  const t = useTranslations("organizer.quote.rfp");
  const tCompare = useTranslations("organizer.quote.compare");
  const [requestState, requestFn] = useActionState<
    RfpRequestActionState,
    FormData
  >(requestProposalAction, initialRfpRequestActionState);
  const [cancelState, cancelFn] = useActionState<
    RfpRequestActionState,
    FormData
  >(cancelProposalRequestAction, initialRfpRequestActionState);

  const errorMessage =
    requestState.status === "error"
      ? requestState.message
      : cancelState.status === "error"
        ? cancelState.message
        : null;

  // Success branch flips the cell back to the request form (cancel) or to a
  // fulfilled link (request); without a transient hint the action feels silent.
  const successMessage =
    cancelState.status === "success"
      ? tCompare("cancelRfpSuccess")
      : requestState.status === "success"
        ? tCompare("requestRfpSuccess")
        : null;

  return (
    <div className="flex flex-col gap-2">
      {col.rfp.status === "fulfilled" && col.rfp.fulfilled_url ? (
        <Button asChild size="sm" variant="outline" className="w-full">
          <a
            href={col.rfp.fulfilled_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FileText aria-hidden />
            {t("viewProposal")}
          </a>
        </Button>
      ) : col.rfp.status === "pending" ? (
        <div className="flex flex-col gap-1.5">
          <span className="inline-flex items-center justify-center gap-1.5 rounded-md bg-semantic-warning-100 px-2 py-1 text-xs font-medium text-semantic-warning-500">
            <Hourglass className="size-3" aria-hidden />
            {t("pending")}
          </span>
          {col.rfp.request_id ? (
            <form action={cancelFn}>
              <input
                type="hidden"
                name="request_id"
                value={col.rfp.request_id}
              />
              <input type="hidden" name="rfq_id" value={rfqId} />
              <CancelRfpButton label={t("cancelCta")} />
            </form>
          ) : null}
        </div>
      ) : (
        <form action={requestFn}>
          <input type="hidden" name="quote_id" value={col.quote_id} />
          <input type="hidden" name="rfq_id" value={rfqId} />
          <RequestRfpButton label={t("requestCta")} />
        </form>
      )}
      {errorMessage ? (
        <Alert variant="destructive" className="px-2 py-1.5">
          <AlertTriangle className="size-3.5" aria-hidden />
          <AlertDescription className="text-xs">
            {errorMessage}
          </AlertDescription>
        </Alert>
      ) : successMessage ? (
        <Alert className="px-2 py-1.5" role="status">
          <Check className="size-3.5" aria-hidden />
          <AlertDescription className="text-xs">
            {successMessage}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function RequestRfpButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant="secondary"
      disabled={pending}
      className="w-full"
    >
      {pending ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : (
        <FileText aria-hidden />
      )}
      {label}
    </Button>
  );
}

function CancelRfpButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant="ghost"
      disabled={pending}
      className="w-full"
    >
      {pending ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : (
        <X aria-hidden />
      )}
      {label}
    </Button>
  );
}

// ---------- supplier-card cell ---------------------------------------------

function SupplierCardCell({ col }: { col: QuoteColumn }) {
  const tSrc = useTranslations("organizer.quote.sourceBadge");
  const t = useTranslations("organizer.quote.compare");
  const sourceLabel =
    col.invite_source === "self_applied"
      ? tSrc("self_applied")
      : col.invite_source === "organizer_picked"
        ? tSrc("organizer_picked")
        : col.invite_source === "auto_match"
          ? tSrc("auto_match")
          : null;

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex items-center gap-2">
        {col.supplier.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={col.supplier.logo_url}
            alt=""
            className="size-8 rounded-md border object-cover"
          />
        ) : (
          <div className="size-8 rounded-md border bg-muted" aria-hidden />
        )}
        <div className="flex flex-col">
          {col.supplier.slug ? (
            <Link
              href={`/s/${col.supplier.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm font-semibold text-brand-navy-900 hover:underline"
            >
              {col.supplier.business_name}
              <ExternalLink className="size-3 ms-1" aria-hidden />
            </Link>
          ) : (
            <span className="text-sm font-semibold text-brand-navy-900">
              {col.supplier.business_name}
            </span>
          )}
          {col.supplier.base_city ? (
            <span className="text-xs text-muted-foreground">
              {col.supplier.base_city}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {col.supplier.verification_status === "approved" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-semantic-success-100 px-2 py-0.5 text-[11px] font-medium text-semantic-success-500">
            <ShieldCheck className="size-3" aria-hidden />
            {t("verified")}
          </span>
        ) : null}
        {sourceLabel ? (
          <span
            className={
              col.invite_source === "self_applied"
                ? "inline-flex items-center rounded-full bg-accent-gold-100 px-2 py-0.5 text-[11px] font-medium text-accent-gold-500"
                : "inline-flex items-center rounded-full bg-brand-cobalt-100 px-2 py-0.5 text-[11px] font-medium text-brand-cobalt-500"
            }
          >
            {sourceLabel}
          </span>
        ) : null}
        {col.has_conflict ? (
          <span
            aria-label={t("dateConflictTooltip")}
            className="inline-flex items-center gap-1 rounded-full bg-semantic-danger-100 px-2 py-0.5 text-[11px] font-medium text-semantic-danger-500"
          >
            <AlertTriangle className="size-3" aria-hidden />
            {t("dateConflict")}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ---------- main component --------------------------------------------------

export function QuoteComparisonGrid({ data }: Props) {
  const t = useTranslations("organizer.quote.compare");
  const locale = useLocale() as SupportedLocale;

  const [sortKey, setSortKey] = useState<SortKey>("submitted_desc");
  const [filters, setFilters] = useState<Filters>({
    hasTechProposal: false,
    noConflict: false,
    source_self_applied: false,
    source_auto_match: false,
    source_organizer_picked: false,
  });
  const [expanded, setExpanded] = useState<ExpandKey>(null);

  const visibleColumns = useMemo(() => {
    const filtered = applyFilters(data.columns, filters);
    return [...filtered].sort((a, b) => compareCols(a, b, sortKey));
  }, [data.columns, filters, sortKey]);

  if (data.columns.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </Card>
    );
  }

  const toggleExpand = (k: Exclude<ExpandKey, null>) =>
    setExpanded((cur) => (cur === k ? null : k));

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <Card className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="sort-key" className="text-xs">
              {t("sortLabel")}
            </Label>
            <Select
              value={sortKey}
              onValueChange={(v) => setSortKey(v as SortKey)}
            >
              <SelectTrigger id="sort-key" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="submitted_desc">
                  {t("sort.submittedDesc")}
                </SelectItem>
                <SelectItem value="submitted_asc">
                  {t("sort.submittedAsc")}
                </SelectItem>
                <SelectItem value="total_asc">
                  {t("sort.totalAsc")}
                </SelectItem>
                <SelectItem value="total_desc">
                  {t("sort.totalDesc")}
                </SelectItem>
                <SelectItem value="deposit_asc">
                  {t("sort.depositAsc")}
                </SelectItem>
                <SelectItem value="deposit_desc">
                  {t("sort.depositDesc")}
                </SelectItem>
                <SelectItem value="expires_asc">
                  {t("sort.expiresAsc")}
                </SelectItem>
                <SelectItem value="expires_desc">
                  {t("sort.expiresDesc")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <FilterCheckbox
              id="f-tech"
              label={t("filter.hasTechProposal")}
              checked={filters.hasTechProposal}
              onChange={(v) =>
                setFilters((f) => ({ ...f, hasTechProposal: v }))
              }
            />
            <FilterCheckbox
              id="f-conflict"
              label={t("filter.noConflict")}
              checked={filters.noConflict}
              onChange={(v) => setFilters((f) => ({ ...f, noConflict: v }))}
            />
            <FilterCheckbox
              id="f-self"
              label={t("filter.sourceSelf")}
              checked={filters.source_self_applied}
              onChange={(v) =>
                setFilters((f) => ({ ...f, source_self_applied: v }))
              }
            />
            <FilterCheckbox
              id="f-auto"
              label={t("filter.sourceAuto")}
              checked={filters.source_auto_match}
              onChange={(v) =>
                setFilters((f) => ({ ...f, source_auto_match: v }))
              }
            />
            <FilterCheckbox
              id="f-org"
              label={t("filter.sourceOrganizer")}
              checked={filters.source_organizer_picked}
              onChange={(v) =>
                setFilters((f) => ({ ...f, source_organizer_picked: v }))
              }
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`/organizer/rfqs/${data.rfq_id}/quotes/export.csv`}>
              <Download aria-hidden />
              {t("export.csv")}
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a
              href={`/organizer/rfqs/${data.rfq_id}/quotes/print?auto=1`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Printer aria-hidden />
              {t("export.pdf")}
            </a>
          </Button>
        </div>
      </Card>

      {/* Grid */}
      <Card className="overflow-x-auto py-0">
        {visibleColumns.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {t("emptyAfterFilter")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setFilters({
                  hasTechProposal: false,
                  noConflict: false,
                  source_self_applied: false,
                  source_auto_match: false,
                  source_organizer_picked: false,
                });
                setSortKey("submitted_desc");
              }}
            >
              {t("clearFilters")}
            </Button>
          </div>
        ) : (
          <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky start-0 z-10 min-w-[180px] border-b bg-card px-4 py-3 text-start font-semibold text-muted-foreground"
                >
                  {t("criterion")}
                </th>
                {visibleColumns.map((col) => (
                  <th
                    key={col.quote_id}
                    scope="col"
                    className="min-w-[220px] border-s border-b px-4 py-3 text-start"
                  >
                    <SupplierCardCell col={col} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Row
                label={t("total")}
                cols={visibleColumns}
                cell={(c) => (
                  <span className="font-semibold tabular-nums text-brand-navy-900">
                    {formatHalalas(c.snapshot.total_halalas)}
                  </span>
                )}
              />
              <Row
                label={t("subtotal")}
                cols={visibleColumns}
                muted
                cell={(c) => (
                  <span className="tabular-nums">
                    {formatHalalas(c.snapshot.subtotal_halalas)}
                  </span>
                )}
              />
              <Row
                label={t("setupFee")}
                cols={visibleColumns}
                muted
                cell={(c) => (
                  <span className="tabular-nums">
                    {formatHalalas(c.snapshot.setup_fee_halalas)}
                  </span>
                )}
              />
              <Row
                label={t("travelFee")}
                cols={visibleColumns}
                muted
                cell={(c) => (
                  <span className="tabular-nums">
                    {formatHalalas(c.snapshot.travel_fee_halalas)}
                  </span>
                )}
              />
              <Row
                label={t("teardownFee")}
                cols={visibleColumns}
                muted
                cell={(c) => (
                  <span className="tabular-nums">
                    {formatHalalas(c.snapshot.teardown_fee_halalas)}
                  </span>
                )}
              />
              <Row
                label={t("vatRow")}
                cols={visibleColumns}
                muted
                cell={(c) => (
                  <span className="tabular-nums">
                    {c.snapshot.vat_rate_pct}% — {formatHalalas(c.snapshot.vat_amount_halalas)}
                  </span>
                )}
              />
              <Row
                label={t("deposit")}
                cols={visibleColumns}
                cell={(c) => `${c.snapshot.deposit_pct}%`}
              />
              <Row
                label={t("paymentSchedule")}
                cols={visibleColumns}
                cell={(c) => c.snapshot.payment_schedule || "—"}
              />
              <ExpandableRow
                label={t("inclusions")}
                isExpanded={expanded === "inclusions"}
                onToggle={() => toggleExpand("inclusions")}
                cols={visibleColumns}
                summary={(c) =>
                  c.snapshot.inclusions.length === 0
                    ? "—"
                    : t("itemsCount", { count: c.snapshot.inclusions.length })
                }
                detail={(c) =>
                  c.snapshot.inclusions.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <ul className="list-disc ps-5 text-xs">
                      {c.snapshot.inclusions.map((inc, idx) => (
                        <li key={`inc-${idx}`}>{inc}</li>
                      ))}
                    </ul>
                  )
                }
              />
              <ExpandableRow
                label={t("exclusions")}
                isExpanded={expanded === "exclusions"}
                onToggle={() => toggleExpand("exclusions")}
                cols={visibleColumns}
                summary={(c) =>
                  c.snapshot.exclusions.length === 0
                    ? "—"
                    : t("itemsCount", { count: c.snapshot.exclusions.length })
                }
                detail={(c) =>
                  c.snapshot.exclusions.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <ul className="list-disc ps-5 text-xs">
                      {c.snapshot.exclusions.map((exc, idx) => (
                        <li key={`exc-${idx}`}>{exc}</li>
                      ))}
                    </ul>
                  )
                }
              />
              <ExpandableRow
                label={t("lineItems")}
                isExpanded={expanded === "line_items"}
                onToggle={() => toggleExpand("line_items")}
                cols={visibleColumns}
                summary={(c) =>
                  c.snapshot.line_items.length === 0
                    ? "—"
                    : t("itemsCount", { count: c.snapshot.line_items.length })
                }
                detail={(c) =>
                  c.snapshot.line_items.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <ul className="space-y-1 text-xs">
                      {c.snapshot.line_items.map((li, idx) => (
                        <li
                          key={`li-${idx}`}
                          className="flex flex-col border-b last:border-b-0 pb-1 last:pb-0"
                        >
                          <span className="font-medium">{li.label}</span>
                          <span className="text-muted-foreground">
                            {li.qty} × {formatHalalas(li.unit_price_halalas)} ={" "}
                            {formatHalalas(li.total_halalas)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )
                }
              />
              <Row
                label={t("techProposal")}
                cols={visibleColumns}
                cell={(c) =>
                  c.tech_proposal_url ? (
                    <a
                      href={c.tech_proposal_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-brand-cobalt-500 hover:underline"
                    >
                      <FileText className="size-3.5" aria-hidden />
                      {t("openPdf")}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <Row
                label={t("expires")}
                cols={visibleColumns}
                muted
                cell={(c) =>
                  fmtDateTime(c.snapshot.expires_at, locale) || "—"
                }
              />
              <Row
                label={t("submitted")}
                cols={visibleColumns}
                muted
                cell={(c) => fmtDateTime(c.submitted_at, locale) || "—"}
              />
              <tr>
                <th
                  scope="row"
                  className="sticky start-0 z-10 border-b bg-card px-4 py-3 text-start font-medium text-muted-foreground"
                >
                  {t("actions")}
                </th>
                {visibleColumns.map((col) => (
                  <td
                    key={col.quote_id}
                    className="min-w-[220px] border-s border-b px-4 py-3 align-top"
                  >
                    <div className="flex flex-col gap-2">
                      <Button asChild variant="outline" size="sm" className="w-full">
                        <Link
                          href={`/organizer/rfqs/${data.rfq_id}/quotes/${col.quote_id}`}
                        >
                          <ExternalLink aria-hidden />
                          {t("viewSnapshot")}
                        </Link>
                      </Button>
                      <AcceptForm rfqId={data.rfq_id} quoteId={col.quote_id} />
                      <RfpCell rfqId={data.rfq_id} col={col} />
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ---------- table-row helpers ----------------------------------------------

function Row({
  label,
  cols,
  cell,
  muted = false,
}: {
  label: string;
  cols: QuoteColumn[];
  cell: (c: QuoteColumn) => React.ReactNode;
  muted?: boolean;
}) {
  return (
    <tr>
      <th
        scope="row"
        className={`sticky start-0 z-10 border-b bg-card px-4 py-2.5 text-start font-medium ${
          muted ? "text-muted-foreground" : "text-foreground"
        }`}
      >
        {label}
      </th>
      {cols.map((c) => (
        <td
          key={c.quote_id}
          className="min-w-[220px] border-s border-b px-4 py-2.5 align-top"
        >
          {cell(c)}
        </td>
      ))}
    </tr>
  );
}

function ExpandableRow({
  label,
  cols,
  summary,
  detail,
  isExpanded,
  onToggle,
}: {
  label: string;
  cols: QuoteColumn[];
  summary: (c: QuoteColumn) => React.ReactNode;
  detail: (c: QuoteColumn) => React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("organizer.quote.compare");
  // Stable id per section label so the trigger's aria-controls always matches.
  const detailRowId = `compare-detail-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <>
      <tr>
        <th
          scope="row"
          className="sticky start-0 z-10 border-b bg-card px-4 py-2.5 text-start font-medium text-foreground"
        >
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isExpanded}
            aria-controls={detailRowId}
            className="inline-flex items-center gap-1 hover:underline"
          >
            {label}
            {isExpanded ? (
              <ChevronUp className="size-3" aria-hidden />
            ) : (
              <ChevronDown className="size-3" aria-hidden />
            )}
            <span className="sr-only">
              {isExpanded ? t("collapse") : t("expand")}
            </span>
          </button>
        </th>
        {cols.map((c) => (
          <td
            key={c.quote_id}
            className="min-w-[220px] border-s border-b px-4 py-2.5 align-top text-muted-foreground"
          >
            {summary(c)}
          </td>
        ))}
      </tr>
      {isExpanded ? (
        <tr id={detailRowId}>
          <th
            scope="row"
            // Sticky cell must be opaque (not /30) so non-sticky supplier cells
            // don't bleed through during horizontal scroll.
            className="sticky start-0 z-10 border-b bg-muted px-4 py-3 text-start text-xs font-medium text-muted-foreground"
          >
            {label}
          </th>
          {cols.map((c) => (
            <td
              key={`${c.quote_id}-detail`}
              className="min-w-[220px] border-s border-b bg-muted/30 px-4 py-3 align-top"
            >
              {detail(c)}
            </td>
          ))}
        </tr>
      ) : null}
    </>
  );
}

function FilterCheckbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
      />
      <Label htmlFor={id} className="text-xs font-normal">
        {label}
      </Label>
    </div>
  );
}
