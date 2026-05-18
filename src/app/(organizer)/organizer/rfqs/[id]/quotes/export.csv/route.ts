/**
 * CSV export of the quote-comparison grid.
 *
 * Same loader, same ownership gate as the page. Returns one column per
 * supplier with criteria as rows. UTF-8 BOM-prefixed so Excel/Numbers parse
 * Arabic and the SAR formatting cleanly.
 *
 * Headers and enum/status labels are localized via next-intl
 * (`organizer.quote.csv.*`). Money values are kept as plain Latin-digit
 * decimals on purpose — Arabic-Indic digits would break `=SUM()` in
 * spreadsheets — so only the column labels switch language, not the numbers.
 */

import { getLocale, getTranslations } from "next-intl/server";
import { halalasToSar } from "@/lib/domain/money";
import { cityNameFor } from "@/lib/domain/cities";
import type { SupportedLocale } from "@/lib/domain/formatDate";
import { loadQuotesComparison, type QuoteColumn } from "../loader";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const ENCODING_BOM = "﻿";

const CELL_CAP = 30000;

function capCell(
  s: string,
  items: number,
  suffixTemplate: (n: number) => string,
): string {
  if (s.length <= CELL_CAP) return s;
  // Trim by item boundary (" | ") so we never cut mid-token.
  const parts = s.split(" | ");
  let kept = 0;
  let acc = "";
  for (let i = 0; i < parts.length; i++) {
    const next = acc.length === 0 ? parts[i] : acc + " | " + parts[i];
    const truncatedCount = items - (i + 1);
    const projected =
      next.length +
      (truncatedCount > 0 ? " ".length + suffixTemplate(truncatedCount).length : 0);
    if (projected > CELL_CAP) break;
    acc = next;
    kept = i + 1;
  }
  const remaining = items - kept;
  if (remaining <= 0) return acc.slice(0, CELL_CAP);
  return `${acc} ${suffixTemplate(remaining)}`;
}

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // Always quote — defends against embedded commas, quotes, newlines.
  return `"${s.replace(/"/g, '""')}"`;
}

function row(values: Array<string | number | null | undefined>): string {
  return values.map(csvEscape).join(",");
}

function fmtSar(halalas: number): string {
  return halalasToSar(halalas).toFixed(2);
}

export async function GET(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  let data: Awaited<ReturnType<typeof loadQuotesComparison>>;
  try {
    data = await loadQuotesComparison(id);
  } catch (error) {
    // `requireAccess` (called inside the loader) uses Next's `redirect()`,
    // which throws a `NEXT_REDIRECT`-tagged error. If we let that bubble up
    // here, the framework would respond with a 307 to /sign-in mid-download
    // and the browser would save the sign-in HTML as the user's CSV file.
    // Instead, surface a plain locale-neutral 401 so the download fails
    // cleanly without leaking an English error body into an Arabic session.
    const digest = (error as { digest?: unknown } | null)?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
      return new Response(null, { status: 401 });
    }
    throw error;
  }

  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations("organizer.quote.csv");

  const inviteSourceLabel = (s: QuoteColumn["invite_source"]): string =>
    t.has(`source.${s}`) ? t(`source.${s}`) : "";
  const rfpStatusLabel = (s: QuoteColumn["rfp"]["status"]): string => {
    if (s === "pending") return t("rfp.requested");
    if (s === "fulfilled") return t("rfp.fulfilled");
    if (s === "cancelled") return t("rfp.cancelled");
    return "";
  };
  const truncatedSuffix = (n: number) => t("truncatedSuffix", { count: n });

  const cols = data.columns;
  const headers = [t("criterion"), ...cols.map((c) => c.supplier.business_name)];

  const lines: string[] = [];
  lines.push(row(headers));

  // City + verification combined into a header-context row.
  lines.push(
    row([
      t("location"),
      ...cols.map((c) =>
        [
          c.supplier.base_city
            ? cityNameFor(c.supplier.base_city, locale)
            : "",
          c.supplier.verification_status === "approved" ? t("verified") : "",
        ]
          .filter(Boolean)
          .join(" "),
      ),
    ]),
  );
  lines.push(
    row([
      t("inviteSource"),
      ...cols.map((c) => inviteSourceLabel(c.invite_source)),
    ]),
  );
  lines.push(
    row([
      t("dateConflict"),
      ...cols.map((c) => (c.has_conflict ? t("yes") : t("no"))),
    ]),
  );

  // Money rows in SAR (numeric, no currency symbol — easier in spreadsheets).
  lines.push(
    row([t("total"), ...cols.map((c) => fmtSar(c.snapshot.total_halalas))]),
  );
  lines.push(
    row([
      t("subtotal"),
      ...cols.map((c) => fmtSar(c.snapshot.subtotal_halalas)),
    ]),
  );
  lines.push(
    row([
      t("setupFee"),
      ...cols.map((c) => fmtSar(c.snapshot.setup_fee_halalas)),
    ]),
  );
  lines.push(
    row([
      t("travelFee"),
      ...cols.map((c) => fmtSar(c.snapshot.travel_fee_halalas)),
    ]),
  );
  lines.push(
    row([
      t("teardownFee"),
      ...cols.map((c) => fmtSar(c.snapshot.teardown_fee_halalas)),
    ]),
  );
  lines.push(
    row([t("vatPct"), ...cols.map((c) => c.snapshot.vat_rate_pct)]),
  );
  lines.push(
    row([
      t("vatAmount"),
      ...cols.map((c) => fmtSar(c.snapshot.vat_amount_halalas)),
    ]),
  );
  lines.push(
    row([t("depositPct"), ...cols.map((c) => c.snapshot.deposit_pct)]),
  );
  lines.push(
    row([
      t("paymentSchedule"),
      ...cols.map((c) => c.snapshot.payment_schedule || ""),
    ]),
  );
  lines.push(
    row([
      t("cancellation"),
      ...cols.map((c) => c.snapshot.cancellation_terms || ""),
    ]),
  );
  lines.push(
    row([
      t("inclusions"),
      ...cols.map((c) =>
        capCell(
          c.snapshot.inclusions.join(" | "),
          c.snapshot.inclusions.length,
          truncatedSuffix,
        ),
      ),
    ]),
  );
  lines.push(
    row([
      t("exclusions"),
      ...cols.map((c) =>
        capCell(
          c.snapshot.exclusions.join(" | "),
          c.snapshot.exclusions.length,
          truncatedSuffix,
        ),
      ),
    ]),
  );
  lines.push(
    row([
      t("lineItems"),
      ...cols.map((c) =>
        capCell(
          c.snapshot.line_items
            .map((li) =>
              t("lineItem", {
                label: li.label,
                qty: li.qty,
                unitPrice: fmtSar(li.unit_price_halalas),
                total: fmtSar(li.total_halalas),
              }),
            )
            .join(" | "),
          c.snapshot.line_items.length,
          truncatedSuffix,
        ),
      ),
    ]),
  );
  lines.push(
    row([t("notes"), ...cols.map((c) => c.snapshot.notes ?? "")]),
  );
  lines.push(
    row([t("expires"), ...cols.map((c) => c.snapshot.expires_at ?? "")]),
  );
  lines.push(
    row([t("submitted"), ...cols.map((c) => c.submitted_at ?? "")]),
  );
  lines.push(
    row([
      t("techProposal"),
      ...cols.map((c) => (c.tech_proposal_url ? t("attached") : "")),
    ]),
  );
  lines.push(
    row([
      t("rfpStatus"),
      ...cols.map((c) => rfpStatusLabel(c.rfp.status)),
    ]),
  );

  const body = ENCODING_BOM + lines.join("\r\n") + "\r\n";
  const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const shortId = id.slice(0, 8);
  const filename = `quotes-${shortId}-${yyyymmdd}.csv`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
