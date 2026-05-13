/**
 * Shared footer rendered by every transactional template.
 *
 * Contains:
 *  - Postal address (required for Saudi anti-spam + most legal regimes)
 *  - Support contact
 *  - Privacy / Terms links
 *  - "Why you got this" transactional disclosure (locale-aware)
 */

import { Link, Section, Text } from "@react-email/components";
import { BRAND } from "../_brand";
import {
  brandName,
  dirFor,
  fontFor,
  postalAddress,
  textAlignStart,
  type Locale,
} from "./i18n";

const FOOTER_STRINGS = {
  en: {
    transactional:
      "You received this transactional email because you have a Sevent account. This is not a marketing message.",
    helpPrefix: "Need help? Email ",
    privacy: "Privacy",
    terms: "Terms",
    dot: " · ",
  },
  ar: {
    transactional:
      "تلقّيت هذه الرسالة لأنّ لديك حسابًا على سيڤنت. هذه رسالة تشغيلية وليست رسالة تسويقية.",
    helpPrefix: "هل تحتاج للمساعدة؟ راسلنا على ",
    privacy: "سياسة الخصوصية",
    terms: "الشروط",
    dot: " · ",
  },
} as const;

type FooterProps = {
  locale: Locale;
};

export function Footer({ locale }: FooterProps) {
  const s = FOOTER_STRINGS[locale];
  const dir = dirFor(locale);
  const align = textAlignStart(locale);
  const font = fontFor(locale);

  const baseStyle = {
    color: BRAND.colors.muted,
    fontFamily: font,
    fontSize: 12,
    lineHeight: 1.55,
    margin: 0,
    textAlign: align as "left" | "right",
    direction: dir,
  };

  return (
    <Section style={{ textAlign: align, direction: dir }}>
      <Text style={baseStyle}>{s.transactional}</Text>

      <Text style={{ ...baseStyle, marginTop: 8 }}>
        {s.helpPrefix}
        <Link
          href={`mailto:${BRAND.supportEmail}`}
          style={{ color: BRAND.colors.cobalt, textDecoration: "none" }}
        >
          {BRAND.supportEmail}
        </Link>
      </Text>

      <Text style={{ ...baseStyle, marginTop: 8 }}>
        <Link
          href={BRAND.privacyUrl}
          style={{ color: BRAND.colors.muted, textDecoration: "underline" }}
        >
          {s.privacy}
        </Link>
        <span style={{ color: BRAND.colors.mutedSoft }}>{s.dot}</span>
        <Link
          href={BRAND.termsUrl}
          style={{ color: BRAND.colors.muted, textDecoration: "underline" }}
        >
          {s.terms}
        </Link>
      </Text>

      <Text style={{ ...baseStyle, color: BRAND.colors.mutedSoft, marginTop: 12 }}>
        © {new Date().getFullYear()} {brandName(locale)} · {postalAddress(locale)}
      </Text>
    </Section>
  );
}
