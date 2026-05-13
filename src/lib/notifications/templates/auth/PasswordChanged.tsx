// A4 — informational notice sent after a successful password change.
import { Heading, Link, Section, Text } from "@react-email/components";
import { BRAND } from "../_brand";
import { BrandShell } from "../_shared/BrandShell";
import { dirFor, fontFor, textAlignStart, type Locale } from "../_shared/i18n";
import { strings } from "./PasswordChanged.strings";

export type PasswordChangedProps = {
  locale: Locale;
  recipientName?: string | null;
  changedAtIso: string;
  appUrl?: string;
};

function formatChangedAt(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const tag = locale === "ar" ? "ar-SA" : "en-GB";
  try {
    return new Intl.DateTimeFormat(tag, {
      timeZone: "Asia/Riyadh",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export default function PasswordChanged({
  locale,
  recipientName,
  changedAtIso,
}: PasswordChangedProps) {
  const s = strings[locale];
  const dir = dirFor(locale);
  const align = textAlignStart(locale);
  const font = fontFor(locale);
  const fallback = locale === "ar" ? "بك" : "there";
  const name = recipientName?.trim() || fallback;
  const when = formatChangedAt(changedAtIso, locale);

  return (
    <BrandShell locale={locale} preview={s.preview} eyebrow={s.eyebrow}>
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
        {s.greeting(name)}
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
        {s.body(when)}
      </Text>

      <Section
        style={{
          backgroundColor: BRAND.colors.dangerSoft,
          borderRadius: 8,
          margin: "20px 0 0",
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
            color: BRAND.colors.fg,
            fontFamily: font,
            fontSize: 14,
            lineHeight: 1.55,
            margin: "0 0 8px",
            textAlign: align,
            direction: dir,
          }}
        >
          {s.warning(BRAND.supportEmail)}
        </Text>
        <Link
          href={`mailto:${BRAND.supportEmail}`}
          style={{
            color: BRAND.colors.cobalt,
            fontFamily: font,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {BRAND.supportEmail}
        </Link>
      </Section>
    </BrandShell>
  );
}
