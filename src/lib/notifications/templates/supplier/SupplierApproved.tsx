// SU — supplier verification approved.
import { Heading, Link, Section, Text } from "@react-email/components";
import { BRAND } from "../_brand";
import { BrandShell } from "../_shared/BrandShell";
import { dirFor, fontFor, textAlignStart, type Locale } from "../_shared/i18n";
import { strings } from "./SupplierApproved.strings";

export type SupplierApprovedProps = {
  locale?: Locale;
  businessName: string;
  appUrl?: string;
};

export default function SupplierApproved({
  locale,
  businessName,
  appUrl = "http://localhost:3000",
}: SupplierApprovedProps) {
  const effectiveLocale: Locale = locale ?? "en";
  const s = strings[effectiveLocale];
  const dir = dirFor(effectiveLocale);
  const align = textAlignStart(effectiveLocale);
  const font = fontFor(effectiveLocale);
  const profileUrl = `${appUrl}/supplier/dashboard`;

  return (
    <BrandShell locale={effectiveLocale} preview={s.preview(businessName)} eyebrow={s.eyebrow}>
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
        {s.heading(businessName)}
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

      <Heading
        as="h2"
        style={{
          color: BRAND.colors.navy,
          fontFamily: font,
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: 0,
          lineHeight: 1.3,
          margin: "20px 0 8px",
          textAlign: align,
          direction: dir,
        }}
      >
        {s.nextStepsHeading}
      </Heading>

      <Section style={{ marginTop: 8, textAlign: align, direction: dir }}>
        {s.steps.map((step, i) => (
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
          href={profileUrl}
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
