// OR9 — organizer email when the supplier cancels before confirming.

import { Heading, Link, Section, Text } from "@react-email/components";
import { BRAND } from "../_brand";
import { BrandShell } from "../_shared/BrandShell";
import { dirFor, fontFor, textAlignStart, type Locale } from "../_shared/i18n";
import { strings } from "./BookingCancelledBySupplier.strings";

export type BookingCancelledBySupplierProps = {
  locale: Locale;
  organizerName?: string | null;
  supplierBusinessName: string;
  eventName: string;
  rfqUrl: string;
  reason?: string | null;
  appUrl?: string;
};

export default function BookingCancelledBySupplier({
  locale,
  organizerName,
  supplierBusinessName,
  eventName,
  rfqUrl,
  reason,
}: BookingCancelledBySupplierProps) {
  const s = strings[locale];
  const dir = dirFor(locale);
  const align = textAlignStart(locale);
  const font = fontFor(locale);

  return (
    <BrandShell
      locale={locale}
      preview={s.preview(supplierBusinessName, eventName)}
      eyebrow={s.eyebrow}
    >
      <Heading
        as="h1"
        style={{
          color: BRAND.colors.danger,
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
        {s.body(supplierBusinessName, eventName)}
      </Text>

      {reason && reason.trim() ? (
        <Section
          style={{
            backgroundColor: BRAND.colors.dangerSoft,
            borderRadius: 8,
            margin: "16px 0 0",
            padding: "14px 16px",
            textAlign: align,
            direction: dir,
            ...(locale === "ar"
              ? { borderRight: `3px solid ${BRAND.colors.danger}` }
              : { borderLeft: `3px solid ${BRAND.colors.danger}` }),
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
            {s.reasonLabel}
          </Text>
          <Text
            style={{
              color: BRAND.colors.fg,
              fontFamily: font,
              fontSize: 14,
              lineHeight: 1.55,
              margin: 0,
              textAlign: align,
              direction: dir,
              whiteSpace: "pre-wrap",
            }}
          >
            {reason}
          </Text>
        </Section>
      ) : null}

      <Section style={{ marginTop: 28, textAlign: align, direction: dir }}>
        <Link
          href={rfqUrl}
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
