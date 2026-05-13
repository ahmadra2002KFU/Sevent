/**
 * Outer shell every Sevent email renders inside.
 *
 *  <Html dir / lang> → <Head> → <Body bg> → <Container card> → header + slot + Footer
 *
 * Inline-style heavy because email clients (Gmail, Outlook) strip <style>
 * and don't honour CSS variables. Direction must be set on <Html> AND on
 * every text container — Outlook drops top-level dir for bidi runs.
 */

import type { ReactNode } from "react";
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { BRAND } from "../_brand";
import {
  brandName,
  dirFor,
  fontFor,
  textAlignStart,
  type Locale,
} from "./i18n";
import { Footer } from "./Footer";

export type BrandShellProps = {
  locale: Locale;
  /** Plain-text preview shown in inbox list (the "preheader"). Keep <90 chars. */
  preview: string;
  /** Short category label rendered above the heading (e.g. "Account · Verification"). */
  eyebrow?: string;
  children: ReactNode;
};

export function BrandShell({ locale, preview, eyebrow, children }: BrandShellProps) {
  const dir = dirFor(locale);
  const font = fontFor(locale);
  const align = textAlignStart(locale);

  return (
    <Html dir={dir} lang={locale}>
      <Head>
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: BRAND.colors.bg,
          color: BRAND.colors.fg,
          fontFamily: font,
          margin: 0,
          padding: `${BRAND.layout.bodyPaddingY}px 16px`,
          direction: dir,
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <Container
          style={{
            backgroundColor: BRAND.colors.card,
            borderRadius: BRAND.layout.cardRadius,
            border: `1px solid ${BRAND.colors.border}`,
            boxShadow: "0 1px 3px rgba(15,46,92,0.06), 0 1px 2px rgba(15,46,92,0.04)",
            margin: "0 auto",
            maxWidth: BRAND.layout.cardMaxWidth,
            padding: `${BRAND.layout.cardPadding}px`,
          }}
        >
          {/* Header — actual logo (PNG; email clients don't reliably render
             SVG). The `alt` is the localized brand name so screen readers
             and image-blocked clients still get the wordmark. */}
          <Section style={{ textAlign: align, direction: dir, paddingBottom: 0 }}>
            <Img
              src={BRAND.logoUrl}
              alt={brandName(locale)}
              width={140}
              height={33}
              style={{
                display: "block",
                height: "auto",
                marginInlineStart: 0,
                outline: "none",
                textDecoration: "none",
                border: 0,
              }}
            />
            {eyebrow ? (
              <Text
                style={{
                  color: BRAND.colors.muted,
                  fontFamily: font,
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: locale === "ar" ? 0 : 0.2,
                  lineHeight: 1.4,
                  margin: "12px 0 0",
                  textAlign: align,
                  direction: dir,
                }}
              >
                {eyebrow}
              </Text>
            ) : null}
          </Section>

          <Hr
            style={{
              borderColor: BRAND.colors.borderSoft,
              borderTopWidth: 1,
              borderTopStyle: "solid",
              margin: "24px 0 28px",
              width: "100%",
            }}
          />

          {/* Caller content. Each child <Section>/<Text>/<Heading> must set
             `textAlign` + `direction` explicitly — helpers in i18n.ts. */}
          {children}

          <Hr
            style={{
              borderColor: BRAND.colors.borderSoft,
              borderTopWidth: 1,
              borderTopStyle: "solid",
              margin: "32px 0 20px",
              width: "100%",
            }}
          />

          <Footer locale={locale} />
        </Container>
      </Body>
    </Html>
  );
}
