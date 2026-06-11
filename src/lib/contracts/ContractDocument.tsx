/**
 * Contract PDF document component (server-side, @react-pdf/renderer).
 *
 * Renders an immutable booking contract — styled as a formal Saudi service
 * agreement / purchase order — from the accepted quote_revisions snapshot plus
 * live counterparty identity (party names, CR/VAT, addresses). Financial terms
 * come entirely from the snapshot and are pinned by `content_hash`; party/tax
 * fields are resolved at render time (see the hash caveat below).
 *
 * SEPARATE bilingual versions, not a mixed document: the file contains a clean
 * monolingual ENGLISH contract first, then a clean monolingual ARABIC contract
 * (RTL) — each a standalone agreement. Both render in the Almarai family
 * (registered in `fonts.ts`), which covers Latin + Arabic so a single font
 * carries either language plus Western/Arabic-Indic digits without tofu.
 * `@react-pdf` reorders bidi runs automatically; no manual reversal.
 *
 * Hash caveat: re-rendering after a supplier edits their VAT number yields a
 * PDF with the new value but the SAME content_hash. That is correct — the
 * priced quote is unchanged; party identity is not part of the hash.
 *
 * Articles 4–7 carry placeholder legal wording (see `clauses.ts`) under a
 * visible "pending legal review" banner. Final binding text is the
 * responsibility of legal counsel.
 */

import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type { QuoteSnapshot, QuoteUnit } from "@/lib/domain/quote";
import { formatMoney } from "@/lib/domain/money";
import { fmtDateTime } from "@/lib/domain/formatDate";
import { cityNameFor } from "@/lib/domain/cities";
import { segmentNameFor } from "@/lib/domain/segments";
import {
  ARTICLES,
  PLACEHOLDER_NOTICE_AR,
  PLACEHOLDER_NOTICE_EN,
} from "./clauses";
import { CONTRACT_ARABIC_FONT } from "./fonts";
import { getSeventLogoDataUri } from "./assets";

export type ContractLocale = "en" | "ar";
type Locale = ContractLocale;

export type ContractPartyAddress = {
  line1: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
};

export type ContractDocumentInput = {
  booking: {
    id: string;
    confirmed_at: string | null;
  };
  contractNumber: string;
  projectNumber: string;
  firstParty: {
    kind: "individual" | "company";
    name: string | null;
    name_ar: string | null;
    cr_number: string | null;
    vat_number: string | null;
    address: ContractPartyAddress | null;
    contactName: string | null;
    email: string | null;
    phone: string | null;
  };
  secondParty: {
    business_name: string;
    slug: string;
    representative_name: string | null;
    cr_number: string | null;
    vat_number: string | null;
    address: ContractPartyAddress | null;
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

// ---------------------------------------------------------------------------
// Brand palette — mirrors src/app/globals.css / notifications/_brand.ts.
// ---------------------------------------------------------------------------
const NAVY = "#1a2755";
const COBALT = "#4975dd";
const COBALT_SOFT = "#e4eafa";
const INK = "#1a1a18";
const MUTED = "#6b6b64";
const BORDER = "#e7e6df";
const CARD = "#fafaf7";
const WARN = "#b45309";

const UNIT_LABEL: Record<Locale, Record<QuoteUnit, string>> = {
  en: { event: "event", hour: "hour", day: "day", person: "person", unit: "unit" },
  ar: { event: "فعالية", hour: "ساعة", day: "يوم", person: "شخص", unit: "وحدة" },
};

type Strings = {
  title: string;
  versionTag: string;
  contractNo: string;
  projectNo: string;
  date: string;
  parties: string;
  firstParty: string;
  secondParty: string;
  cr: string;
  vat: string;
  address: string;
  contact: string;
  email: string;
  phone: string;
  representedBy: string;
  eventDetails: string;
  eventType: string;
  city: string;
  venue: string;
  starts: string;
  ends: string;
  guests: string;
  deliverables: string;
  description: string;
  amount: string;
  subtotal: string;
  travel: string;
  setup: string;
  teardown: string;
  vatLine: (pct: number) => string;
  inclusive: string;
  grandTotal: string;
  deposit: string;
  cancellation: string;
  inclusions: string;
  exclusions: string;
  notes: string;
  acceptance: string;
  acceptedOn: (date: string) => string;
  verifyHash: string;
  footer: string;
  page: (n: number, total: number) => string;
};

const STR: Record<Locale, Strings> = {
  en: {
    title: "Service Agreement",
    versionTag: "English",
    contractNo: "Contract No.",
    projectNo: "Project No.",
    date: "Date",
    parties: "Parties",
    firstParty: "First Party (Client)",
    secondParty: "Second Party (Provider)",
    cr: "Commercial Reg.",
    vat: "VAT No.",
    address: "Address",
    contact: "Contact",
    email: "Email",
    phone: "Phone",
    representedBy: "Represented by",
    eventDetails: "Article 1 — Scope of Work",
    eventType: "Event type",
    city: "City",
    venue: "Venue",
    starts: "Starts",
    ends: "Ends",
    guests: "Guests",
    deliverables: "Deliverables",
    description: "Description",
    amount: "Amount",
    subtotal: "Subtotal",
    travel: "Travel fee",
    setup: "Setup fee",
    teardown: "Teardown fee",
    vatLine: (pct) => `VAT (${pct}%)`,
    inclusive: "inclusive",
    grandTotal: "Total",
    deposit: "Deposit",
    cancellation: "Cancellation Terms",
    inclusions: "Inclusions",
    exclusions: "Exclusions",
    notes: "Notes",
    acceptance: "Acceptance Record",
    acceptedOn: (date) =>
      `This agreement was accepted electronically on ${date}. This record is an electronic acceptance, not a wet-ink signature.`,
    verifyHash: "Verification hash",
    footer: "Generated by Sevent · Payments are handled off-platform in v1.",
    page: (n, total) => `Page ${n} / ${total}`,
  },
  ar: {
    title: "اتفاقية تقديم خدمة",
    versionTag: "العربية",
    contractNo: "رقم العقد",
    projectNo: "رقم المشروع",
    date: "التاريخ",
    parties: "الأطراف",
    firstParty: "الطرف الأول (العميل)",
    secondParty: "الطرف الثاني (المزوّد)",
    cr: "السجل التجاري",
    vat: "الرقم الضريبي",
    address: "العنوان",
    contact: "جهة الاتصال",
    email: "البريد الإلكتروني",
    phone: "الهاتف",
    representedBy: "يمثله",
    eventDetails: "المادة الأولى — نطاق العمل",
    eventType: "نوع الفعالية",
    city: "المدينة",
    venue: "المكان",
    starts: "يبدأ",
    ends: "ينتهي",
    guests: "عدد الضيوف",
    deliverables: "المخرجات",
    description: "الوصف",
    amount: "القيمة",
    subtotal: "المجموع الفرعي",
    travel: "رسوم التنقل",
    setup: "رسوم التركيب",
    teardown: "رسوم الفك",
    vatLine: (pct) => `ضريبة القيمة المضافة (${pct}%)`,
    inclusive: "شاملة",
    grandTotal: "الإجمالي",
    deposit: "الدفعة المقدمة",
    cancellation: "شروط الإلغاء",
    inclusions: "يشمل",
    exclusions: "لا يشمل",
    notes: "ملاحظات",
    acceptance: "إقرار القبول",
    acceptedOn: (date) =>
      `تم قبول هذه الاتفاقية إلكترونياً بتاريخ ${date}. ويُعد هذا الإقرار قبولاً إلكترونياً وليس توقيعاً خطياً.`,
    verifyHash: "رمز التحقق",
    footer: "صادر عن منصة سيڤنت · تتم المدفوعات خارج المنصة في النسخة الأولى.",
    page: (n, total) => `صفحة ${n} / ${total}`,
  },
};

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 44,
    paddingTop: 36,
    paddingBottom: 60,
    fontSize: 9.5,
    lineHeight: 1.5,
    fontFamily: CONTRACT_ARABIC_FONT,
    color: INK,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  logo: { width: 128 },
  metaBox: { maxWidth: 220 },
  metaRow: { flexDirection: "row", marginBottom: 1 },
  metaLabel: { fontSize: 8, color: MUTED },
  metaValue: { fontSize: 8, color: INK, fontWeight: 700 },
  versionPill: {
    fontSize: 7,
    color: COBALT,
    fontWeight: 800,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  titleRule: { borderBottomWidth: 2, borderBottomColor: COBALT, marginTop: 6 },
  title: { fontSize: 19, fontWeight: 800, color: NAVY, marginTop: 10, marginBottom: 2 },
  sectionTitle: {
    fontSize: 10.5,
    fontWeight: 800,
    color: NAVY,
    marginTop: 16,
    marginBottom: 6,
    borderBottomWidth: 0.75,
    borderBottomColor: COBALT,
    paddingBottom: 3,
  },
  card: {
    borderWidth: 0.75,
    borderColor: BORDER,
    backgroundColor: CARD,
    borderRadius: 4,
    padding: 9,
    marginBottom: 7,
  },
  cardHeading: {
    fontSize: 7.5,
    fontWeight: 800,
    color: COBALT,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  partyName: { fontSize: 11, fontWeight: 700, color: NAVY, marginBottom: 2 },
  partyLine: { marginBottom: 1 },
  partyLabel: { color: MUTED },
  link: { color: COBALT, fontSize: 8.5, marginTop: 2 },
  kv: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  kvLabel: { color: MUTED, flex: 1 },
  kvValue: { flex: 1.4 },
  tableHead: {
    flexDirection: "row",
    backgroundColor: NAVY,
    paddingVertical: 4,
    paddingHorizontal: 7,
    marginTop: 4,
  },
  tableHeadText: { color: "#FFFFFF", fontSize: 8, fontWeight: 700 },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    paddingVertical: 4,
    paddingHorizontal: 7,
  },
  colDesc: { flex: 3, paddingHorizontal: 4 },
  colAmt: { flex: 1, fontWeight: 700 },
  sub: { color: MUTED, fontSize: 8.5 },
  totalsWrap: { marginTop: 6, flexDirection: "row" },
  totalsBox: {
    width: 250,
    borderWidth: 0.75,
    borderColor: BORDER,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 1.5 },
  totalsLabel: { color: MUTED },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 5,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: NAVY,
  },
  grandText: { fontSize: 12, fontWeight: 800, color: NAVY },
  articleTitle: { fontSize: 10.5, fontWeight: 700, color: NAVY, marginTop: 12, marginBottom: 2 },
  placeholder: { fontSize: 7.5, color: WARN, fontWeight: 700, marginBottom: 3 },
  body: { marginBottom: 4 },
  bullet: { marginBottom: 1.5 },
  acceptanceBox: {
    marginTop: 14,
    borderWidth: 0.75,
    borderColor: COBALT,
    backgroundColor: COBALT_SOFT,
    borderRadius: 4,
    padding: 10,
  },
  acceptanceHeading: { fontSize: 9, fontWeight: 800, color: NAVY, marginBottom: 3 },
  hashText: { fontSize: 7.5, color: MUTED, marginTop: 4 },
  footer: {
    position: "absolute",
    bottom: 26,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingTop: 5,
    fontSize: 7,
    color: MUTED,
  },
});

// Locale-aware date/time via the shared helper (Arabic-Indic digits on `ar`),
// falling back to an em-dash when absent.
function formatDateTime(iso: string | null, locale: Locale): string {
  return fmtDateTime(iso, locale) || "—";
}

function formatAddress(addr: ContractPartyAddress | null): string | null {
  if (!addr) return null;
  const parts = [addr.line1, addr.city, addr.region, addr.postal_code].filter(
    (p): p is string => Boolean(p && p.trim()),
  );
  return parts.length > 0 ? parts.join(", ") : null;
}

/** Direction-aware text alignment for the active locale. */
function align(rtl: boolean): { textAlign: "left" | "right" } {
  return { textAlign: rtl ? "right" : "left" };
}
/** Mirror a row for RTL (label on the right, value on the left). */
function rowDir(rtl: boolean): { flexDirection: "row" | "row-reverse" } {
  return { flexDirection: rtl ? "row-reverse" : "row" };
}

function PartyLine({
  label,
  value,
  rtl,
}: {
  label: string;
  value: string | null;
  rtl: boolean;
}) {
  if (!value) return null;
  return (
    <Text style={[styles.partyLine, align(rtl)]}>
      <Text style={styles.partyLabel}>{label}: </Text>
      {value}
    </Text>
  );
}

function KV({
  label,
  value,
  rtl,
}: {
  label: string;
  value: string | null;
  rtl: boolean;
}) {
  if (!value) return null;
  return (
    <View style={[styles.kv, rowDir(rtl)]}>
      <Text style={[styles.kvLabel, align(rtl)]}>{label}</Text>
      <Text style={[styles.kvValue, { textAlign: rtl ? "left" : "right" }]}>
        {value}
      </Text>
    </View>
  );
}

function PartyCard({
  heading,
  name,
  rtl,
  children,
}: {
  heading: string;
  name: string;
  rtl: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Text style={[styles.cardHeading, align(rtl)]}>{heading}</Text>
      <Text style={[styles.partyName, align(rtl)]}>{name}</Text>
      {children}
    </View>
  );
}

/** The full contract in one language. Rendered once per locale. */
function ContractBody({
  input,
  locale,
}: {
  input: ContractDocumentInput;
  locale: Locale;
}) {
  const t = STR[locale];
  const rtl = locale === "ar";
  const { firstParty, secondParty, event, snapshot, content_hash, booking } =
    input;
  const logo = getSeventLogoDataUri();

  const firstName =
    firstParty.kind === "company"
      ? [firstParty.name, firstParty.name_ar].filter(Boolean).join(" — ")
      : firstParty.name ?? "—";

  return (
    <>
      {/* Header: logo + document metadata */}
      <View style={[styles.header, rowDir(rtl)]}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf <Image> has no alt prop */}
        <Image src={logo} style={styles.logo} />
        <View style={styles.metaBox}>
          <Text style={[styles.versionPill, { textAlign: rtl ? "left" : "right" }]}>
            {t.versionTag}
          </Text>
          <View style={[styles.metaRow, rowDir(rtl)]}>
            <Text style={styles.metaLabel}>{t.contractNo}: </Text>
            <Text style={styles.metaValue}>{input.contractNumber}</Text>
          </View>
          <View style={[styles.metaRow, rowDir(rtl)]}>
            <Text style={styles.metaLabel}>{t.projectNo}: </Text>
            <Text style={styles.metaValue}>{input.projectNumber}</Text>
          </View>
          <View style={[styles.metaRow, rowDir(rtl)]}>
            <Text style={styles.metaLabel}>{t.date}: </Text>
            <Text style={styles.metaValue}>
              {formatDateTime(booking.confirmed_at, locale)}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.titleRule} />
      <Text style={[styles.title, align(rtl)]}>{t.title}</Text>

      {/* Parties */}
      <Text style={[styles.sectionTitle, align(rtl)]}>{t.parties}</Text>
      <PartyCard heading={t.firstParty} name={firstName} rtl={rtl}>
        <PartyLine label={t.cr} value={firstParty.cr_number} rtl={rtl} />
        <PartyLine label={t.vat} value={firstParty.vat_number} rtl={rtl} />
        <PartyLine
          label={t.address}
          value={formatAddress(firstParty.address)}
          rtl={rtl}
        />
        <PartyLine label={t.contact} value={firstParty.contactName} rtl={rtl} />
        <PartyLine label={t.email} value={firstParty.email} rtl={rtl} />
        <PartyLine label={t.phone} value={firstParty.phone} rtl={rtl} />
      </PartyCard>
      <PartyCard
        heading={t.secondParty}
        name={secondParty.business_name}
        rtl={rtl}
      >
        <PartyLine
          label={t.representedBy}
          value={secondParty.representative_name}
          rtl={rtl}
        />
        <PartyLine label={t.cr} value={secondParty.cr_number} rtl={rtl} />
        <PartyLine label={t.vat} value={secondParty.vat_number} rtl={rtl} />
        <PartyLine
          label={t.address}
          value={formatAddress(secondParty.address)}
          rtl={rtl}
        />
        <Text style={[styles.link, align(rtl)]}>
          sevent.sa/s/{secondParty.slug}
        </Text>
      </PartyCard>

      {/* Article 1 — Scope of Work */}
      <Text style={[styles.sectionTitle, align(rtl)]}>{t.eventDetails}</Text>
      <Text style={[styles.body, align(rtl)]}>
        {locale === "ar" ? ARTICLES[0]!.body_ar : ARTICLES[0]!.body_en}
      </Text>
      <KV label={t.eventType} value={segmentNameFor(event.event_type, locale)} rtl={rtl} />
      <KV label={t.city} value={cityNameFor(event.city, locale)} rtl={rtl} />
      <KV label={t.venue} value={event.venue_address} rtl={rtl} />
      <KV label={t.starts} value={formatDateTime(event.starts_at, locale)} rtl={rtl} />
      <KV label={t.ends} value={formatDateTime(event.ends_at, locale)} rtl={rtl} />
      <KV
        label={t.guests}
        value={event.guest_count !== null ? String(event.guest_count) : null}
        rtl={rtl}
      />

      <View style={[styles.tableHead, rowDir(rtl)]}>
        <Text style={[styles.colDesc, styles.tableHeadText, align(rtl)]}>
          {t.deliverables}
        </Text>
        <Text
          style={[
            styles.colAmt,
            styles.tableHeadText,
            { textAlign: rtl ? "left" : "right" },
          ]}
        >
          {t.amount}
        </Text>
      </View>
      {snapshot.line_items.map((item, idx) => (
        <View key={`${item.label}-${idx}`} style={[styles.tableRow, rowDir(rtl)]}>
          <View style={styles.colDesc}>
            <Text style={align(rtl)}>{item.label}</Text>
            <Text style={[styles.sub, align(rtl)]}>
              {item.qty} × {formatMoney(item.unit_price_halalas, locale)} (
              {UNIT_LABEL[locale][item.unit]})
            </Text>
          </View>
          <Text
            style={[styles.colAmt, { textAlign: rtl ? "left" : "right" }]}
          >
            {formatMoney(item.total_halalas, locale)}
          </Text>
        </View>
      ))}

      {/* Article 2 — Price */}
      <Text style={[styles.articleTitle, align(rtl)]}>
        {locale === "ar" ? ARTICLES[1]!.title_ar : ARTICLES[1]!.title_en}
      </Text>
      <Text style={[styles.body, align(rtl)]}>
        {locale === "ar" ? ARTICLES[1]!.body_ar : ARTICLES[1]!.body_en}
      </Text>
      <View
        style={[styles.totalsWrap, { justifyContent: rtl ? "flex-start" : "flex-end" }]}
        wrap={false}
      >
        <View style={styles.totalsBox}>
          <View style={[styles.totalsRow, rowDir(rtl)]}>
            <Text style={styles.totalsLabel}>{t.subtotal}</Text>
            <Text>{formatMoney(snapshot.subtotal_halalas, locale)}</Text>
          </View>
          {snapshot.travel_fee_halalas > 0 ? (
            <View style={[styles.totalsRow, rowDir(rtl)]}>
              <Text style={styles.totalsLabel}>{t.travel}</Text>
              <Text>{formatMoney(snapshot.travel_fee_halalas, locale)}</Text>
            </View>
          ) : null}
          {snapshot.setup_fee_halalas > 0 ? (
            <View style={[styles.totalsRow, rowDir(rtl)]}>
              <Text style={styles.totalsLabel}>{t.setup}</Text>
              <Text>{formatMoney(snapshot.setup_fee_halalas, locale)}</Text>
            </View>
          ) : null}
          {snapshot.teardown_fee_halalas > 0 ? (
            <View style={[styles.totalsRow, rowDir(rtl)]}>
              <Text style={styles.totalsLabel}>{t.teardown}</Text>
              <Text>{formatMoney(snapshot.teardown_fee_halalas, locale)}</Text>
            </View>
          ) : null}
          {snapshot.vat_amount_halalas > 0 ? (
            <View style={[styles.totalsRow, rowDir(rtl)]}>
              <Text style={styles.totalsLabel}>
                {t.vatLine(snapshot.vat_rate_pct)}
                {snapshot.prices_include_vat ? ` (${t.inclusive})` : ""}
              </Text>
              <Text>{formatMoney(snapshot.vat_amount_halalas, locale)}</Text>
            </View>
          ) : null}
          <View style={[styles.grandRow, rowDir(rtl)]}>
            <Text style={styles.grandText}>
              {t.grandTotal} ({snapshot.currency})
            </Text>
            <Text style={styles.grandText}>
              {formatMoney(snapshot.total_halalas, locale)}
            </Text>
          </View>
        </View>
      </View>

      {/* Article 3 — Payment Terms */}
      <Text style={[styles.articleTitle, align(rtl)]}>
        {locale === "ar" ? ARTICLES[2]!.title_ar : ARTICLES[2]!.title_en}
      </Text>
      <Text style={[styles.body, align(rtl)]}>
        {locale === "ar" ? ARTICLES[2]!.body_ar : ARTICLES[2]!.body_en}
      </Text>
      <KV label={t.deposit} value={`${snapshot.deposit_pct}%`} rtl={rtl} />
      {snapshot.payment_schedule ? (
        <Text style={[styles.body, align(rtl)]}>{snapshot.payment_schedule}</Text>
      ) : null}

      {/* Articles 4–7 — placeholder legal text */}
      {ARTICLES.filter((a) => a.id >= 4).map((a) => (
        <View key={a.id} wrap={false}>
          <Text style={[styles.articleTitle, align(rtl)]}>
            {locale === "ar" ? a.title_ar : a.title_en}
          </Text>
          {a.isPlaceholder ? (
            <Text style={[styles.placeholder, align(rtl)]}>
              {locale === "ar" ? PLACEHOLDER_NOTICE_AR : PLACEHOLDER_NOTICE_EN}
            </Text>
          ) : null}
          <Text style={[styles.body, align(rtl)]}>
            {locale === "ar" ? a.body_ar : a.body_en}
          </Text>
        </View>
      ))}

      {/* Cancellation / Inclusions / Exclusions / Notes */}
      {snapshot.cancellation_terms ? (
        <>
          <Text style={[styles.sectionTitle, align(rtl)]}>{t.cancellation}</Text>
          <Text style={[styles.body, align(rtl)]}>
            {snapshot.cancellation_terms}
          </Text>
        </>
      ) : null}
      {snapshot.inclusions.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, align(rtl)]}>{t.inclusions}</Text>
          {snapshot.inclusions.map((line, idx) => (
            <Text key={`inc-${idx}`} style={[styles.bullet, align(rtl)]}>
              • {line}
            </Text>
          ))}
        </>
      ) : null}
      {snapshot.exclusions.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, align(rtl)]}>{t.exclusions}</Text>
          {snapshot.exclusions.map((line, idx) => (
            <Text key={`exc-${idx}`} style={[styles.bullet, align(rtl)]}>
              • {line}
            </Text>
          ))}
        </>
      ) : null}
      {snapshot.notes ? (
        <>
          <Text style={[styles.sectionTitle, align(rtl)]}>{t.notes}</Text>
          <Text style={[styles.body, align(rtl)]}>{snapshot.notes}</Text>
        </>
      ) : null}

      {/* Acceptance record (NOT an e-signature) */}
      <View style={styles.acceptanceBox} wrap={false}>
        <Text style={[styles.acceptanceHeading, align(rtl)]}>{t.acceptance}</Text>
        <Text style={align(rtl)}>{t.acceptedOn(formatDateTime(booking.confirmed_at, locale))}</Text>
        <PartyLine label={t.firstParty} value={firstName} rtl={rtl} />
        <PartyLine
          label={t.secondParty}
          value={
            secondParty.representative_name
              ? `${secondParty.business_name} (${secondParty.representative_name})`
              : secondParty.business_name
          }
          rtl={rtl}
        />
        <Text style={[styles.hashText, align(rtl)]}>
          {t.verifyHash}: {content_hash}
        </Text>
      </View>

      {/* Footer (repeats on every page of this language section) */}
      <View style={[styles.footer, rowDir(rtl)]} fixed>
        <Text>{t.footer}</Text>
        <Text
          render={({ pageNumber, totalPages }) =>
            t.page(pageNumber, totalPages)
          }
        />
      </View>
    </>
  );
}

export type ContractDocumentProps = ContractDocumentInput & {
  /** Which monolingual contract to render — English and Arabic are separate files. */
  locale: ContractLocale;
};

export function ContractDocument({ locale, ...input }: ContractDocumentProps) {
  return (
    <Document
      title={`Sevent ${locale === "ar" ? "عقد" : "contract"} · ${input.contractNumber}`}
      author="Sevent"
      subject={locale === "ar" ? "اتفاقية تقديم خدمة" : "Service agreement"}
      creator="Sevent"
      producer="Sevent"
    >
      <Page size="A4" style={styles.page} wrap>
        <ContractBody input={input} locale={locale} />
      </Page>
    </Document>
  );
}

export default ContractDocument;
