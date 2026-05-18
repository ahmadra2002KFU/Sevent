// OR8 — organizer email when the supplier confirms the booking.

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
import { strings } from "./BookingConfirmed.strings";

export type BookingConfirmedProps = {
  locale: Locale;
  organizerName?: string | null;
  supplierBusinessName: string;
  eventName: string;
  eventStartsAtIso: string;
  bookingUrl: string;
  appUrl?: string;
};

export default function BookingConfirmed({
  locale,
  organizerName,
  supplierBusinessName,
  eventName,
  eventStartsAtIso,
  bookingUrl,
}: BookingConfirmedProps) {
  const s = strings[locale];
  const dir = dirFor(locale);
  const align = textAlignStart(locale);
  const font = fontFor(locale);

  const formattedStart = formatEmailDateTime(
    eventStartsAtIso,
    locale,
    {
      year: "numeric",
      month: "long",
      day: "numeric",
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

      <Section
        style={{
          backgroundColor: BRAND.colors.successSoft,
          borderRadius: 8,
          margin: "20px 0",
          padding: "14px 16px",
          textAlign: align,
          direction: dir,
          ...(locale === "ar"
            ? { borderRight: `3px solid ${BRAND.colors.success}` }
            : { borderLeft: `3px solid ${BRAND.colors.success}` }),
        }}
      >
        <Text
          style={{
            color: BRAND.colors.fg,
            fontFamily: font,
            fontSize: 14,
            fontWeight: 600,
            lineHeight: 1.4,
            margin: 0,
            textAlign: align,
            direction: dir,
          }}
        >
          {s.confirmedLabel(formattedStart)}
        </Text>
      </Section>

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
        {s.body(eventName, formattedStart)}
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
        {s.secondary}
      </Text>
    </BrandShell>
  );
}
