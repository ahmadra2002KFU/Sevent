/**
 * Print-friendly comparison view. Opened in a new tab from the main grid.
 * `AutoPrint` triggers the browser print dialog on mount; the user can then
 * "Save as PDF" or print directly. No toolbar, no buttons — just the data.
 */

import { getLocale, getTranslations } from "next-intl/server";
import { halalasToSar } from "@/lib/domain/money";
import { fmtDateTime, type SupportedLocale } from "@/lib/domain/formatDate";
import { loadQuotesComparison, type QuoteColumn } from "../loader";
import { AutoPrint } from "./AutoPrint";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

function fmtSar(halalas: number): string {
  return `${halalasToSar(halalas).toFixed(2)} SAR`;
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
      return "—";
  }
}

export default async function PrintComparisonPage({ params }: PageProps) {
  const { id } = await params;
  const data = await loadQuotesComparison(id);
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations("organizer.quote.compare");

  const cols = data.columns;

  return (
    <main className="print-page p-6 text-[11pt]">
      <AutoPrint />
      <style>{`
        @page { size: A4 landscape; margin: 12mm; }
        @media print {
          html, body { background: #fff; }
          .print-page { padding: 0; }
        }
        .pgrid {
          width: 100%; border-collapse: collapse; font-size: 10pt;
          table-layout: fixed; word-break: break-word;
        }
        .pgrid th, .pgrid td {
          border: 1px solid #ddd; padding: 6px 8px; vertical-align: top;
          text-align: start;
        }
        .pgrid thead th { background: #f6f7f8; font-weight: 600; }
        .pgrid tr.muted td, .pgrid tr.muted th { color: #4a4a4a; }
        .pgrid tr.total td, .pgrid tr.total th { font-weight: 700; }
        h1 { font-size: 14pt; margin: 0 0 4px 0; }
        .meta { color: #555; font-size: 10pt; margin-bottom: 12px; }
      `}</style>

      <h1>{t("printTitle")}</h1>
      <p className="meta">
        {t("printMeta", {
          city: data.event.city,
          starts: fmtDateTime(data.event.starts_at, locale) || data.event.starts_at,
          ends: fmtDateTime(data.event.ends_at, locale) || data.event.ends_at,
        })}
      </p>

      {cols.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <table className="pgrid">
          <thead>
            <tr>
              <th style={{ width: `${100 / (cols.length + 1)}%` }}>
                {t("criterion")}
              </th>
              {cols.map((c) => (
                <th
                  key={c.quote_id}
                  style={{ width: `${100 / (cols.length + 1)}%` }}
                >
                  <div>{c.supplier.business_name}</div>
                  {c.supplier.base_city ? (
                    <div style={{ fontWeight: 400, color: "#666" }}>
                      {c.supplier.base_city}
                    </div>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>{t("inviteSource")}</th>
              {cols.map((c) => (
                <td key={c.quote_id}>{inviteSourceLabel(c.invite_source)}</td>
              ))}
            </tr>
            <tr>
              <th>{t("dateConflict")}</th>
              {cols.map((c) => (
                <td key={c.quote_id}>{c.has_conflict ? "⚠ conflict" : "—"}</td>
              ))}
            </tr>
            <tr className="total">
              <th>{t("total")}</th>
              {cols.map((c) => (
                <td key={c.quote_id}>{fmtSar(c.snapshot.total_halalas)}</td>
              ))}
            </tr>
            <tr className="muted">
              <th>{t("subtotal")}</th>
              {cols.map((c) => (
                <td key={c.quote_id}>{fmtSar(c.snapshot.subtotal_halalas)}</td>
              ))}
            </tr>
            <tr className="muted">
              <th>{t("setupFee")}</th>
              {cols.map((c) => (
                <td key={c.quote_id}>{fmtSar(c.snapshot.setup_fee_halalas)}</td>
              ))}
            </tr>
            <tr className="muted">
              <th>{t("travelFee")}</th>
              {cols.map((c) => (
                <td key={c.quote_id}>{fmtSar(c.snapshot.travel_fee_halalas)}</td>
              ))}
            </tr>
            <tr className="muted">
              <th>{t("teardownFee")}</th>
              {cols.map((c) => (
                <td key={c.quote_id}>{fmtSar(c.snapshot.teardown_fee_halalas)}</td>
              ))}
            </tr>
            <tr className="muted">
              <th>{t("vatRow")}</th>
              {cols.map((c) => (
                <td key={c.quote_id}>
                  {c.snapshot.vat_rate_pct}% — {fmtSar(c.snapshot.vat_amount_halalas)}
                </td>
              ))}
            </tr>
            <tr>
              <th>{t("deposit")}</th>
              {cols.map((c) => (
                <td key={c.quote_id}>{c.snapshot.deposit_pct}%</td>
              ))}
            </tr>
            <tr>
              <th>{t("paymentSchedule")}</th>
              {cols.map((c) => (
                <td key={c.quote_id}>{c.snapshot.payment_schedule || "—"}</td>
              ))}
            </tr>
            <tr>
              <th>{t("cancellation")}</th>
              {cols.map((c) => (
                <td key={c.quote_id}>{c.snapshot.cancellation_terms || "—"}</td>
              ))}
            </tr>
            <tr>
              <th>{t("inclusions")}</th>
              {cols.map((c) => (
                <td key={c.quote_id}>
                  {c.snapshot.inclusions.length === 0 ? (
                    "—"
                  ) : (
                    <ul style={{ margin: 0, paddingInlineStart: 16 }}>
                      {c.snapshot.inclusions.map((inc, idx) => (
                        <li key={idx}>{inc}</li>
                      ))}
                    </ul>
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <th>{t("exclusions")}</th>
              {cols.map((c) => (
                <td key={c.quote_id}>
                  {c.snapshot.exclusions.length === 0 ? (
                    "—"
                  ) : (
                    <ul style={{ margin: 0, paddingInlineStart: 16 }}>
                      {c.snapshot.exclusions.map((exc, idx) => (
                        <li key={idx}>{exc}</li>
                      ))}
                    </ul>
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <th>{t("lineItems")}</th>
              {cols.map((c) => (
                <td key={c.quote_id}>
                  {c.snapshot.line_items.length === 0 ? (
                    "—"
                  ) : (
                    <ul style={{ margin: 0, paddingInlineStart: 16 }}>
                      {c.snapshot.line_items.map((li, idx) => (
                        <li key={idx}>
                          {li.label} — {li.qty} × {fmtSar(li.unit_price_halalas)}{" "}
                          = {fmtSar(li.total_halalas)}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              ))}
            </tr>
            <tr className="muted">
              <th>{t("techProposal")}</th>
              {cols.map((c) => (
                <td key={c.quote_id}>
                  {c.tech_proposal_url ? t("attached") : "—"}
                </td>
              ))}
            </tr>
            <tr className="muted">
              <th>{t("rfpStatus")}</th>
              {cols.map((c) => (
                <td key={c.quote_id}>
                  {c.rfp.status === "fulfilled"
                    ? t("rfp.fulfilled")
                    : c.rfp.status === "pending"
                      ? t("rfp.pending")
                      : "—"}
                </td>
              ))}
            </tr>
            <tr className="muted">
              <th>{t("expires")}</th>
              {cols.map((c) => (
                <td key={c.quote_id}>
                  {fmtDateTime(c.snapshot.expires_at, locale) || "—"}
                </td>
              ))}
            </tr>
            <tr className="muted">
              <th>{t("submitted")}</th>
              {cols.map((c) => (
                <td key={c.quote_id}>
                  {fmtDateTime(c.submitted_at, locale) || "—"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      )}
    </main>
  );
}
