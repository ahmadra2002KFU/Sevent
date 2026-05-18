// rfq.invited — organizer invited the supplier to quote on a new RFQ (a new opportunity).
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
import { getSegmentBySlug } from "@/lib/domain/segments";
import { strings } from "./RfqInvited.strings";

export { strings } from "./RfqInvited.strings";

export type RfqInvitedProps = {
  locale?: Locale;
  rfq_id?: string;
  invite_id?: string;
  /** Market-segment slug (e.g. `private_occasions`). Resolved to a localized
   * display name inside the template via `segmentNameFor`. Pass the slug, not
   * the rendered English name — otherwise the English name leaks into the
   * Arabic email. */
  event_type?: string;
  category_name_en?: string;
  category_name_ar?: string;
  response_due_at?: string;
  opportunity_url?: string;
};

function formatDeadline(iso: string, locale: Locale): string {
  return formatEmailDateTime(iso, locale, {
    dateStyle: "full",
    timeStyle: "short",
  });
}

export default function RfqInvited({
  locale = "en",
  event_type = "",
  category_name_en = "",
  category_name_ar = "",
  response_due_at = "",
  opportunity_url = BRAND.marketingUrl,
}: RfqInvitedProps) {
  const effectiveLocale: Locale = locale ?? "en";
  const s = strings[effectiveLocale];
  const dir = dirFor(effectiveLocale);
  const align = textAlignStart(effectiveLocale);
  const font = fontFor(effectiveLocale);

  // Resolve the event_type SLUG to a locale-specific display name. If the
  // value isn't a known segment slug (empty, legacy English literal like
  // "your event", etc.) fall back to the localized fallback so the email
  // never leaks the opposite-locale phrase.
  const segment = getSegmentBySlug(event_type);
  const eventTypeDisplay = segment
    ? effectiveLocale === "ar"
      ? segment.name_ar
      : segment.name_en
    : s.genericEventFallback;

  // Locale-pure category: never fall back across locales. If the field for
  // the active locale is empty, show nothing rather than the wrong-language
  // category name.
  const category =
    effectiveLocale === "ar" ? category_name_ar : category_name_en;

  const hasDeadline = typeof response_due_at === "string" && response_due_at.trim().length > 0;
  const formattedDeadline = hasDeadline
    ? formatDeadline(response_due_at, effectiveLocale)
    : "";

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
        {s.body(eventTypeDisplay, category)}
      </Text>

      {hasDeadline ? (
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
      ) : null}

      <Section style={{ marginTop: 28, textAlign: align, direction: dir }}>
        <Link
          href={opportunity_url}
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
