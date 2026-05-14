// message.received — immediate email when a Sevent admin starts a new
// dedicated thread with a user. Enqueued by the notifications → email_outbox
// bridge (email_outbox_enqueue_from_notification) ONLY when the notification
// payload carries `email_notify: true` — set exclusively by the single-user
// admin compose path. Bulk broadcasts and replies do not reach this template.
import { Heading, Link, Section, Text } from "@react-email/components";
import { BRAND } from "../_brand";
import { BrandShell } from "../_shared/BrandShell";
import { dirFor, fontFor, textAlignStart, type Locale } from "../_shared/i18n";
import { strings } from "./MessageReceived.strings";

export { strings } from "./MessageReceived.strings";

export type MessageReceivedProps = {
  locale?: Locale;
  thread_id?: string;
  role?: string;
  sender_role?: string;
  snippet?: string | null;
  thread_url?: string | null;
};

export default function MessageReceived({
  locale = "en",
  snippet = null,
  thread_url = null,
}: MessageReceivedProps) {
  const effectiveLocale: Locale = locale ?? "en";
  const s = strings[effectiveLocale];
  const dir = dirFor(effectiveLocale);
  const align = textAlignStart(effectiveLocale);
  const font = fontFor(effectiveLocale);

  const hasSnippet =
    typeof snippet === "string" && snippet.trim().length > 0;
  const ctaUrl =
    typeof thread_url === "string" && thread_url.trim().length > 0
      ? thread_url
      : BRAND.marketingUrl;

  return (
    <BrandShell
      locale={effectiveLocale}
      preview={s.preheader}
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
        {s.body}
      </Text>

      <Section
        style={{
          backgroundColor: BRAND.colors.cobaltSoft,
          borderRadius: 8,
          margin: "20px 0",
          padding: "14px 16px",
          textAlign: align,
          direction: dir,
          ...(effectiveLocale === "ar"
            ? { borderRight: `3px solid ${BRAND.colors.cobalt}` }
            : { borderLeft: `3px solid ${BRAND.colors.cobalt}` }),
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
          {s.snippetLabel}
        </Text>
        <Text
          style={{
            color: BRAND.colors.navy,
            fontFamily: font,
            fontSize: 15,
            fontWeight: hasSnippet ? 400 : 700,
            fontStyle: hasSnippet ? "normal" : "italic",
            lineHeight: 1.5,
            margin: 0,
            textAlign: align,
            direction: dir,
          }}
        >
          {hasSnippet ? snippet : s.noSnippet}
        </Text>
      </Section>

      <Section style={{ marginTop: 28, textAlign: align, direction: dir }}>
        <Link
          href={ctaUrl}
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

      <Text
        style={{
          color: BRAND.colors.muted,
          fontFamily: font,
          fontSize: 13,
          lineHeight: 1.6,
          margin: "24px 0 0",
          textAlign: align,
          direction: dir,
        }}
      >
        {s.note}
      </Text>
    </BrandShell>
  );
}
