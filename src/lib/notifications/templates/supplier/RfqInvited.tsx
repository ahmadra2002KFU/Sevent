// rfq.invited — organizer invited the supplier to quote on a new RFQ (a new opportunity).
import { Heading, Link, Section, Text } from "@react-email/components";
import { BRAND } from "../_brand";
import { BrandShell } from "../_shared/BrandShell";
import { dirFor, fontFor, textAlignStart, type Locale } from "../_shared/i18n";
import { strings } from "./RfqInvited.strings";

export { strings } from "./RfqInvited.strings";

export type RfqInvitedProps = {
  locale?: Locale;
  rfq_id?: string;
  invite_id?: string;
  event_type?: string;
  category_name_en?: string;
  category_name_ar?: string;
  response_due_at?: string;
  opportunity_url?: string;
};

function formatDeadline(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const tag = locale === "ar" ? "ar-SA" : "en-GB";
  try {
    return new Intl.DateTimeFormat(tag, {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Asia/Riyadh",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export default function RfqInvited({
  locale = "en",
  event_type = "your event",
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

  const category =
    effectiveLocale === "ar"
      ? category_name_ar || category_name_en || ""
      : category_name_en || category_name_ar || "";

  const hasDeadline = typeof response_due_at === "string" && response_due_at.trim().length > 0;
  const formattedDeadline = hasDeadline
    ? formatDeadline(response_due_at, effectiveLocale)
    : "";

  return (
    <BrandShell
      locale={effectiveLocale}
      preview={s.preheader(event_type)}
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
        {s.body(event_type, category)}
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
