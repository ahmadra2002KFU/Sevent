/**
 * CSV export of the quote-comparison grid.
 *
 * Same loader, same ownership gate as the page. Returns one column per
 * supplier with criteria as rows. UTF-8 BOM-prefixed so Excel/Numbers parse
 * Arabic and the SAR formatting cleanly.
 */

import { halalasToSar } from "@/lib/domain/money";
import { loadQuotesComparison, type QuoteColumn } from "../loader";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const ENCODING_BOM = "﻿";

const CELL_CAP = 30000;

function capCell(s: string, items: number): string {
  if (s.length <= CELL_CAP) return s;
  const suffixTemplate = (n: number) =>
    `… (${n} items truncated; open in app for full)`;
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

function inviteSourceLabel(s: QuoteColumn["invite_source"]): string {
  switch (s) {
    case "self_applied":
      return "self-applied";
    case "auto_match":
      return "auto-matched";
    case "organizer_picked":
      return "organizer-picked";
    default:
      return "";
  }
}

function rfpStatusLabel(s: QuoteColumn["rfp"]["status"]): string {
  switch (s) {
    case "pending":
      return "requested";
    case "fulfilled":
      return "fulfilled";
    case "cancelled":
      return "cancelled";
    default:
      return "";
  }
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
    // Instead, surface a plain 401 so the download fails cleanly.
    const digest = (error as { digest?: unknown } | null)?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { "Content-Type": "text/plain" },
      });
    }
    throw error;
  }

  const cols = data.columns;
  const headers = ["Criterion", ...cols.map((c) => c.supplier.business_name)];

  const lines: string[] = [];
  lines.push(row(headers));

  // City + verification + source + conflict combined into a header-context row
  lines.push(
    row([
      "Location",
      ...cols.map((c) =>
        [
          c.supplier.base_city ?? "",
          c.supplier.verification_status === "approved" ? "(verified)" : "",
        ]
          .filter(Boolean)
          .join(" "),
      ),
    ]),
  );
  lines.push(
    row([
      "Invite source",
      ...cols.map((c) => inviteSourceLabel(c.invite_source)),
    ]),
  );
  lines.push(
    row([
      "Date conflict",
      ...cols.map((c) => (c.has_conflict ? "yes" : "no")),
    ]),
  );

  // Money rows in SAR (numeric, no currency symbol — easier in spreadsheets).
  lines.push(
    row(["Total (SAR)", ...cols.map((c) => fmtSar(c.snapshot.total_halalas))]),
  );
  lines.push(
    row([
      "Subtotal (SAR)",
      ...cols.map((c) => fmtSar(c.snapshot.subtotal_halalas)),
    ]),
  );
  lines.push(
    row([
      "Setup fee (SAR)",
      ...cols.map((c) => fmtSar(c.snapshot.setup_fee_halalas)),
    ]),
  );
  lines.push(
    row([
      "Travel fee (SAR)",
      ...cols.map((c) => fmtSar(c.snapshot.travel_fee_halalas)),
    ]),
  );
  lines.push(
    row([
      "Teardown fee (SAR)",
      ...cols.map((c) => fmtSar(c.snapshot.teardown_fee_halalas)),
    ]),
  );
  lines.push(
    row([
      "VAT %",
      ...cols.map((c) => c.snapshot.vat_rate_pct),
    ]),
  );
  lines.push(
    row([
      "VAT amount (SAR)",
      ...cols.map((c) => fmtSar(c.snapshot.vat_amount_halalas)),
    ]),
  );
  lines.push(
    row(["Deposit %", ...cols.map((c) => c.snapshot.deposit_pct)]),
  );
  lines.push(
    row([
      "Payment schedule",
      ...cols.map((c) => c.snapshot.payment_schedule || ""),
    ]),
  );
  lines.push(
    row([
      "Cancellation",
      ...cols.map((c) => c.snapshot.cancellation_terms || ""),
    ]),
  );
  lines.push(
    row([
      "Inclusions",
      ...cols.map((c) =>
        capCell(c.snapshot.inclusions.join(" | "), c.snapshot.inclusions.length),
      ),
    ]),
  );
  lines.push(
    row([
      "Exclusions",
      ...cols.map((c) =>
        capCell(c.snapshot.exclusions.join(" | "), c.snapshot.exclusions.length),
      ),
    ]),
  );
  lines.push(
    row([
      "Line items",
      ...cols.map((c) =>
        capCell(
          c.snapshot.line_items
            .map(
              (li) =>
                `${li.label} (qty ${li.qty}, ${fmtSar(li.unit_price_halalas)}/u, total ${fmtSar(li.total_halalas)})`,
            )
            .join(" | "),
          c.snapshot.line_items.length,
        ),
      ),
    ]),
  );
  lines.push(
    row([
      "Notes",
      ...cols.map((c) => c.snapshot.notes ?? ""),
    ]),
  );
  lines.push(
    row(["Expires", ...cols.map((c) => c.snapshot.expires_at ?? "")]),
  );
  lines.push(
    row(["Submitted", ...cols.map((c) => c.submitted_at ?? "")]),
  );
  lines.push(
    row([
      "Technical proposal",
      ...cols.map((c) => (c.tech_proposal_url ? "attached" : "")),
    ]),
  );
  lines.push(
    row([
      "RFP status",
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
