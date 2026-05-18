// SU5 — organizer accepted your quote, soft-hold timer started.
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
import { strings } from "./QuoteAccepted.strings";

/**
 * Bilingual event-name shape. Callers should ideally pass `{ en, ar }` so the
 * template can pick the recipient-locale version; legacy callers passing a
 * single string still work — the template uses it for both locales.
 */
export type BilingualText = string | { en: string; ar: string };

function pickBilingual(value: BilingualText, locale: Locale): string {
  return typeof value === "string" ? value : value[locale];
}

export type QuoteAcceptedProps = {
  locale?: Locale;
  supplierBusinessName: string;
  eventName: BilingualText;
  organizerName: string;
  bookingUrl: string;
  expiresAtIso: string;
  appUrl?: string;
};

function formatDeadline(iso: string, locale: Locale): string {
  return formatEmailDateTime(iso, locale, {
    dateStyle: "full",
    timeStyle: "short",
  });
}

export default function QuoteAccepted({
  locale = "en",
  eventName,
  organizerName,
  bookingUrl,
  expiresAtIso,
}: QuoteAcceptedProps) {
  const effectiveLocale: Locale = locale ?? "en";
  const s = strings[effectiveLocale];
  const dir = dirFor(effectiveLocale);
  const align = textAlignStart(effectiveLocale);
  const font = fontFor(effectiveLocale);
  const formattedDeadline = formatDeadline(expiresAtIso, effectiveLocale);
  const localizedEventName = pickBilingual(eventName, effectiveLocale);

  return (
    <BrandShell locale={effectiveLocale} preview={s.preview(localizedEventName)} eyebrow={s.eyebrow}>
      <Heading
        as="h1"
        style={{
          color: BRAND.colors.navy,
          fontFamily: font,
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: effectiveLocale === "ar" ? 0 : -0.3,
          lineHeight: 1.25,
          margin: "0 0 12px",
          textAlign: align,
          direction: dir,
        }}
      >
        {s.heading}
      </Heading>

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
        {s.body(organizerName, localizedEventName)}
      </Text>

      <Section
        style={{
          backgroundColor: BRAND.colors.goldSoft,
          borderRadius: 8,
          margin: "20px 0",
          padding: "14px 16px",
          textAlign: align,
          direction: dir,
          ...(effectiveLocale === "ar"
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
            textTransform: effectiveLocale === "ar" ? "none" : "uppercase",
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
          lineHeight: 1.6,
          margin: "0 0 12px",
          textAlign: align,
          direction: dir,
        }}
      >
        {s.timeoutNote}
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
            letterSpacing: effectiveLocale === "ar" ? 0 : 0.1,
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
