// quote.proposal_requested — organizer requested a technical/detailed proposal for the quote.
import { Heading, Link, Section, Text } from "@react-email/components";
import { BRAND } from "../_brand";
import { BrandShell } from "../_shared/BrandShell";
import { dirFor, fontFor, textAlignStart, type Locale } from "../_shared/i18n";
import { getSegmentBySlug } from "@/lib/domain/segments";
import { strings } from "./QuoteProposalRequested.strings";

export { strings } from "./QuoteProposalRequested.strings";

export type QuoteProposalRequestedProps = {
  locale?: Locale;
  quote_id?: string;
  rfq_id?: string;
  message?: string | null;
  invite_id?: string;
  /** Market-segment slug — resolved to a localized display name in-template. */
  event_type?: string;
  quote_url?: string;
};

export default function QuoteProposalRequested({
  locale = "en",
  message = null,
  event_type = "",
  quote_url = BRAND.marketingUrl,
}: QuoteProposalRequestedProps) {
  const effectiveLocale: Locale = locale ?? "en";
  const s = strings[effectiveLocale];
  const dir = dirFor(effectiveLocale);
  const align = textAlignStart(effectiveLocale);
  const font = fontFor(effectiveLocale);

  const trimmedMessage = typeof message === "string" ? message.trim() : "";
  const hasMessage = trimmedMessage.length > 0;

  const segment = getSegmentBySlug(event_type);
  const eventTypeDisplay = segment
    ? effectiveLocale === "ar"
      ? segment.name_ar
      : segment.name_en
    : s.genericEventFallback;

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
        {s.body(eventTypeDisplay)}
      </Text>

      {hasMessage ? (
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
            {s.messageLabel}
          </Text>
          <Text
            style={{
              color: BRAND.colors.navy,
              fontFamily: font,
              fontSize: 15,
              fontWeight: 500,
              lineHeight: 1.5,
              margin: 0,
              textAlign: align,
              direction: dir,
            }}
          >
            {trimmedMessage}
          </Text>
        </Section>
      ) : null}

      <Section style={{ marginTop: 28, textAlign: align, direction: dir }}>
        <Link
          href={quote_url}
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
