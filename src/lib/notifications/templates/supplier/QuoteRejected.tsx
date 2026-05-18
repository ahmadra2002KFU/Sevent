// quote.rejected — supplier's quote was not chosen; organizer accepted a competing quote.
import { Heading, Link, Section, Text } from "@react-email/components";
import { BRAND } from "../_brand";
import { BrandShell } from "../_shared/BrandShell";
import { dirFor, fontFor, textAlignStart, type Locale } from "../_shared/i18n";
import { getSegmentBySlug } from "@/lib/domain/segments";
import { strings } from "./QuoteRejected.strings";

export { strings } from "./QuoteRejected.strings";

export type QuoteRejectedProps = {
  locale?: Locale;
  quote_id?: string;
  rfq_id?: string;
  reason?: string;
  /** Market-segment slug (e.g. `private_occasions`). Resolved to a localized
   * display name inside the template — never pass the rendered English
   * name. */
  event_type?: string;
  rfq_url?: string;
};

export default function QuoteRejected({
  locale = "en",
  reason = "another_quote_accepted",
  event_type = "",
  rfq_url = BRAND.marketingUrl,
}: QuoteRejectedProps) {
  const effectiveLocale: Locale = locale ?? "en";
  const s = strings[effectiveLocale];
  const dir = dirFor(effectiveLocale);
  const align = textAlignStart(effectiveLocale);
  const font = fontFor(effectiveLocale);

  const segment = getSegmentBySlug(event_type);
  const eventTypeDisplay = segment
    ? effectiveLocale === "ar"
      ? segment.name_ar
      : segment.name_en
    : s.genericEventFallback;

  const reasonLine =
    reason === "another_quote_accepted"
      ? s.reason.another_quote_accepted(eventTypeDisplay)
      : s.reason.generic(eventTypeDisplay);

  return (
    <BrandShell
      locale={effectiveLocale}
      preview={s.preheader(eventTypeDisplay)}
      eyebrow={s.eyebrow}
    >
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
        {reasonLine}
      </Text>

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
        {s.thanks}
      </Text>

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
        {s.encouragement}
      </Text>

      <Section style={{ marginTop: 28, textAlign: align, direction: dir }}>
        <Link
          href={rfq_url}
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
