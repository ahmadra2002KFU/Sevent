// OR4 — organizer email when the first quote arrives on an RFQ.

import { Heading, Link, Section, Text } from "@react-email/components";
import { BRAND } from "../_brand";
import { BrandShell } from "../_shared/BrandShell";
import { dirFor, fontFor, textAlignStart, type Locale } from "../_shared/i18n";
import { strings } from "./QuoteReceived.strings";

export type QuoteReceivedProps = {
  locale: Locale;
  organizerName?: string | null;
  supplierBusinessName: string;
  rfqTitle: string;
  quoteAmountSar: number;
  quoteUrl: string;
  appUrl?: string;
};

export default function QuoteReceived({
  locale,
  organizerName,
  supplierBusinessName,
  rfqTitle,
  quoteAmountSar,
  quoteUrl,
}: QuoteReceivedProps) {
  const s = strings[locale];
  const dir = dirFor(locale);
  const align = textAlignStart(locale);
  const font = fontFor(locale);

  const formattedAmount = new Intl.NumberFormat(
    locale === "ar" ? "ar-SA" : "en-US",
    { style: "currency", currency: "SAR", maximumFractionDigits: 2 },
  ).format(quoteAmountSar);

  return (
    <BrandShell
      locale={locale}
      preview={s.preview(supplierBusinessName, rfqTitle)}
      eyebrow={s.eyebrow}
    >
      <Heading
        as="h1"
        style={{
          color: BRAND.colors.navy,
          fontFamily: font,
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: locale === "ar" ? 0 : -0.3,
          lineHeight: 1.25,
          margin: "0 0 12px",
          textAlign: align,
          direction: dir,
        }}
      >
        {s.heading(supplierBusinessName)}
      </Heading>

      {organizerName ? (
        <Text
          style={{
            color: BRAND.colors.fg,
            fontFamily: font,
            fontSize: 15,
            lineHeight: 1.6,
            margin: "0 0 12px",
            textAlign: align,
            direction: dir,
          }}
        >
          {s.greeting(organizerName)}
        </Text>
      ) : null}

      <Text
        style={{
          color: BRAND.colors.fg,
          fontFamily: font,
          fontSize: 15,
          lineHeight: 1.6,
          margin: "0 0 12px",
          textAlign: align,
          direction: dir,
        }}
      >
        {s.body(rfqTitle, formattedAmount)}
      </Text>

      <Section
        style={{
          backgroundColor: BRAND.colors.cobaltSoft,
          borderRadius: 8,
          margin: "20px 0",
          padding: "16px 18px",
          textAlign: align,
          direction: dir,
        }}
      >
        <Text
          style={{
            color: BRAND.colors.muted,
            fontFamily: font,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.3,
            lineHeight: 1.3,
            margin: "0 0 4px",
            textTransform: locale === "ar" ? "none" : "uppercase",
            textAlign: align,
            direction: dir,
          }}
        >
          {s.amountLabel}
        </Text>
        <Text
          style={{
            color: BRAND.colors.navy,
            fontFamily: font,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: locale === "ar" ? 0 : -0.3,
            lineHeight: 1.2,
            margin: 0,
            textAlign: align,
            direction: dir,
          }}
        >
          {formattedAmount}
        </Text>
      </Section>

      <Text
        style={{
          color: BRAND.colors.muted,
          fontFamily: font,
          fontSize: 13,
          lineHeight: 1.55,
          margin: "16px 0 0",
          textAlign: align,
          direction: dir,
        }}
      >
        {s.note}
      </Text>

      <Section style={{ marginTop: 28, textAlign: align, direction: dir }}>
        <Link
          href={quoteUrl}
          style={{
            backgroundColor: BRAND.colors.cobalt,
            borderRadius: BRAND.layout.buttonRadius,
            color: "#ffffff",
            display: "inline-block",
            fontFamily: font,
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: locale === "ar" ? 0 : 0.1,
            lineHeight: 1.2,
            padding: "12px 22px",
            textDecoration: "none",
          }}
        >
          {s.cta}
        </Link>
      </Section>
    </BrandShell>
  );
}
