// A2 — welcome email for newly verified supplier accounts.
import { Heading, Link, Section, Text } from "@react-email/components";
import { BRAND } from "../_brand";
import { BrandShell } from "../_shared/BrandShell";
import { dirFor, fontFor, textAlignStart, type Locale } from "../_shared/i18n";
import { strings } from "./WelcomeSupplier.strings";

export type WelcomeSupplierProps = {
  locale: Locale;
  recipientName?: string | null;
  appUrl?: string;
};

export default function WelcomeSupplier({
  locale,
  recipientName,
  appUrl = "http://localhost:3000",
}: WelcomeSupplierProps) {
  const s = strings[locale];
  const dir = dirFor(locale);
  const align = textAlignStart(locale);
  const font = fontFor(locale);
  const fallback = locale === "ar" ? "بك" : "there";
  const name = recipientName?.trim() || fallback;
  const ctaUrl = `${appUrl}/supplier/onboarding`;
  const steps = [s.bullet1, s.bullet2, s.bullet3];

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
        {s.body}
      </Text>

      <Section style={{ marginTop: 16, textAlign: align, direction: dir }}>
        {steps.map((step, i) => (
          <Text
            key={i}
            style={{
              color: BRAND.colors.fg,
              fontFamily: font,
              fontSize: 15,
              lineHeight: 1.6,
              margin: "0 0 10px",
              textAlign: align,
              direction: dir,
            }}
          >
            <span
              style={{
                color: BRAND.colors.cobalt,
                fontWeight: 700,
                marginInlineEnd: 8,
              }}
            >
              {i + 1}.
            </span>
            {step}
          </Text>
        ))}
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
