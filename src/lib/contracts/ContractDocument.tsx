/**
 * Contract PDF document component (server-side, @react-pdf/renderer).
 *
 * Renders an immutable booking contract from the accepted quote_revisions
 * snapshot. The PDF is intentionally text-only — no images, no embedded
 * styles — so it renders identically across the Node 20 server runtime
 * and any PDF viewer. The content_hash from the source revision is
 * stamped in the footer so anyone verifying the contract can match it
 * against the canonical snapshot stored in Postgres.
 *
 * Locale: the contract renders in English for the pilot. A bilingual
 * Arabic version is a follow-up sprint — embedding the Almarai font and
 * verifying RTL behaviour in @react-pdf is non-trivial and out of scope
 * for this slice. Localised legal text remains the supplier's
 * responsibility in v1 (cancellation_terms / payment_schedule strings
 * stored in the snapshot already carry the supplier's chosen language).
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { QuoteSnapshot } from "@/lib/domain/quote";
// Contract PDFs are intentionally English-only per legal-document policy
// (see file-level docblock). Wrap `formatHalalas` once here under a
// distinct name so the `no-restricted-syntax` deprecation fence (which
// steers RFQ-surface code to `formatMoney(halalas, locale)`) doesn't have
// to be disabled at every call site below. Migrate to a locale-aware
// variant the day the contract template goes bilingual.
import { formatHalalas } from "@/lib/domain/money";

// eslint-disable-next-line no-restricted-syntax -- out of RFQ scope (contracts PDF; English-only by design until the bilingual contract sprint)
const formatHalalasEn = (halalas: number): string => formatHalalas(halalas);

export type ContractDocumentInput = {
  booking: {
    id: string;
    confirmed_at: string | null;
  };
  organizer: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  };
  supplier: {
    business_name: string;
    slug: string;
    representative_name: string | null;
  };
  event: {
    event_type: string;
    city: string;
    starts_at: string;
    ends_at: string;
    venue_address: string | null;
    guest_count: number | null;
  };
  snapshot: QuoteSnapshot;
  content_hash: string;
};

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 56,
    paddingVertical: 64,
    fontSize: 10.5,
    lineHeight: 1.5,
    fontFamily: "Helvetica",
    color: "#0B1E12",
  },
  brand: {
    fontSize: 9,
    color: "#006C35",
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: "#5B6770",
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#5B6770",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  rowLabel: {
    color: "#5B6770",
  },
  partyBlock: {
    marginBottom: 10,
  },
  partyName: {
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  table: {
    marginTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: "#D7DBE0",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#D7DBE0",
    paddingVertical: 5,
  },
  tableCol1: {
    flex: 3,
    paddingRight: 8,
  },
  tableCol2: {
    flex: 1,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalsRowGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    marginTop: 6,
    borderTopWidth: 0.75,
    borderTopColor: "#0B1E12",
    fontFamily: "Helvetica-Bold",
  },
  paragraph: {
    marginBottom: 6,
  },
  bullet: {
    marginLeft: 12,
    marginBottom: 2,
  },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 56,
    right: 56,
    fontSize: 7.5,
    color: "#8A929C",
    borderTopWidth: 0.5,
    borderTopColor: "#D7DBE0",
    paddingTop: 6,
  },
});

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    // eslint-disable-next-line no-restricted-syntax -- out of RFQ scope (contracts PDF rendered server-side; PDF is always English per legal-document policy); not part of the RFQ localization sweep
    return d.toLocaleString("en-GB", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ContractDocument(input: ContractDocumentInput) {
  const { booking, organizer, supplier, event, snapshot, content_hash } = input;
  const confirmedDisplay = booking.confirmed_at
    ? formatDateTime(booking.confirmed_at)
    : "—";

  return (
    <Document
      title={`Sevent contract · ${booking.id}`}
      author="Sevent"
      subject="Booking contract"
      creator="Sevent"
      producer="Sevent"
    >
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.brand}>SEVENT</Text>
        <Text style={styles.title}>Booking contract</Text>
        <Text style={styles.subtitle}>
          Booking {booking.id} · Confirmed {confirmedDisplay}
        </Text>

        <Text style={styles.sectionHeader}>Parties</Text>
        <View style={styles.partyBlock}>
          <Text style={styles.partyName}>Organizer</Text>
          <Text>{organizer.full_name ?? "—"}</Text>
          {organizer.email ? <Text>{organizer.email}</Text> : null}
          {organizer.phone ? <Text>{organizer.phone}</Text> : null}
        </View>
        <View style={styles.partyBlock}>
          <Text style={styles.partyName}>Supplier</Text>
          <Text>{supplier.business_name}</Text>
          {supplier.representative_name ? (
            <Text>Represented by {supplier.representative_name}</Text>
          ) : null}
          <Text>sevent.sa/s/{supplier.slug}</Text>
        </View>

        <Text style={styles.sectionHeader}>Event</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Type</Text>
          <Text>{event.event_type}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>City</Text>
          <Text>{event.city}</Text>
        </View>
        {event.venue_address ? (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Venue</Text>
            <Text>{event.venue_address}</Text>
          </View>
        ) : null}
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Starts</Text>
          <Text>{formatDateTime(event.starts_at)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Ends</Text>
          <Text>{formatDateTime(event.ends_at)}</Text>
        </View>
        {event.guest_count !== null ? (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Guests</Text>
            <Text>{event.guest_count}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionHeader}>Line items</Text>
        <View style={styles.table}>
          {snapshot.line_items.map((item, idx) => (
            <View key={`${item.label}-${idx}`} style={styles.tableRow}>
              <View style={styles.tableCol1}>
                <Text>{item.label}</Text>
                <Text style={{ color: "#5B6770", fontSize: 9 }}>
                  {item.qty} × {formatHalalasEn(item.unit_price_halalas)}{" "}
                  ({item.unit})
                </Text>
              </View>
              <Text style={styles.tableCol2}>
                {formatHalalasEn(item.total_halalas)}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionHeader}>Totals</Text>
        <View style={styles.totalsRow}>
          <Text style={styles.rowLabel}>Subtotal</Text>
          <Text>{formatHalalasEn(snapshot.subtotal_halalas)}</Text>
        </View>
        {snapshot.travel_fee_halalas > 0 ? (
          <View style={styles.totalsRow}>
            <Text style={styles.rowLabel}>Travel fee</Text>
            <Text>{formatHalalasEn(snapshot.travel_fee_halalas)}</Text>
          </View>
        ) : null}
        {snapshot.setup_fee_halalas > 0 ? (
          <View style={styles.totalsRow}>
            <Text style={styles.rowLabel}>Setup fee</Text>
            <Text>{formatHalalasEn(snapshot.setup_fee_halalas)}</Text>
          </View>
        ) : null}
        {snapshot.teardown_fee_halalas > 0 ? (
          <View style={styles.totalsRow}>
            <Text style={styles.rowLabel}>Teardown fee</Text>
            <Text>{formatHalalasEn(snapshot.teardown_fee_halalas)}</Text>
          </View>
        ) : null}
        {snapshot.vat_amount_halalas > 0 ? (
          <View style={styles.totalsRow}>
            <Text style={styles.rowLabel}>
              VAT ({snapshot.vat_rate_pct}%)
              {snapshot.prices_include_vat ? " (inclusive)" : ""}
            </Text>
            <Text>{formatHalalasEn(snapshot.vat_amount_halalas)}</Text>
          </View>
        ) : null}
        <View style={styles.totalsRowGrand}>
          <Text>Total ({snapshot.currency})</Text>
          <Text>{formatHalalasEn(snapshot.total_halalas)}</Text>
        </View>

        <Text style={styles.sectionHeader}>Payment</Text>
        <Text style={styles.paragraph}>
          Deposit: {snapshot.deposit_pct}% of total.
        </Text>
        {snapshot.payment_schedule ? (
          <Text style={styles.paragraph}>{snapshot.payment_schedule}</Text>
        ) : null}

        <Text style={styles.sectionHeader}>Cancellation terms</Text>
        <Text style={styles.paragraph}>
          {snapshot.cancellation_terms || "—"}
        </Text>

        {snapshot.inclusions.length > 0 ? (
          <>
            <Text style={styles.sectionHeader}>Inclusions</Text>
            {snapshot.inclusions.map((line, idx) => (
              <Text key={`inc-${idx}`} style={styles.bullet}>
                • {line}
              </Text>
            ))}
          </>
        ) : null}

        {snapshot.exclusions.length > 0 ? (
          <>
            <Text style={styles.sectionHeader}>Exclusions</Text>
            {snapshot.exclusions.map((line, idx) => (
              <Text key={`exc-${idx}`} style={styles.bullet}>
                • {line}
              </Text>
            ))}
          </>
        ) : null}

        {snapshot.notes ? (
          <>
            <Text style={styles.sectionHeader}>Notes</Text>
            <Text style={styles.paragraph}>{snapshot.notes}</Text>
          </>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>
            This document is generated from quote revision content_hash{" "}
            {content_hash}. Verify against Sevent records by matching this
            hash to the booking&apos;s accepted_quote_revision_id snapshot.
            Payments are handled off-platform in v1.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export default ContractDocument;
