// OR7 — organizer email when their accept creates a soft-hold booking.

import { Heading, Link, Section, Text } from "@react-email/components";
import { BRAND } from "../_brand";
import { BrandShell } from "../_shared/BrandShell";
import {
  dirFor,
  fontFor,
  formatEmailDateTime,
  textAlignStart,
  type Locale,
} from "../_shared/i18n";
import { strings } from "./BookingCreated.strings";

export type BookingCreatedProps = {
  locale: Locale;
  organizerName?: string | null;
  supplierBusinessName: string;
  eventName: string;
  supplierConfirmDeadlineIso: string;
  bookingUrl: string;
  appUrl?: string;
};

export default function BookingCreated({
  locale,
  organizerName,
  supplierBusinessName,
  eventName,
  supplierConfirmDeadlineIso,
  bookingUrl,
}: BookingCreatedProps) {
  const s = strings[locale];
  const dir = dirFor(locale);
  const align = textAlignStart(locale);
  const font = fontFor(locale);

  const formattedDeadline = formatEmailDateTime(
    supplierConfirmDeadlineIso,
    locale,
    {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );

  return (
    <BrandShell
      locale={locale}
      preview={s.preview(supplierBusinessName, eventName)}
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
        {s.body(supplierBusinessName, eventName, formattedDeadline)}
      </Text>

      <Section
        style={{
          backgroundColor: BRAND.colors.goldSoft,
          borderRadius: 8,
          margin: "20px 0",
          padding: "14px 16px",
          textAlign: align,
          direction: dir,
          ...(locale === "ar"
            ? { borderRight: `3px solid ${BRAND.colors.gold}` }
            : { borderLeft: `3px solid ${BRAND.colors.gold}` }),
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
          {s.deadlineLabel}
        </Text>
        <Text
          style={{
            color: BRAND.colors.navy,
            fontFamily: font,
            fontSize: 16,
            fontWeight: 700,
            lineHeight: 1.3,
            margin: 0,
            textAlign: align,
            direction: dir,
          }}
        >
          {formattedDeadline}
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
          href={bookingUrl}
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
