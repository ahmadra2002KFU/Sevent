// organizer.invite_sent — sent to an invitee email by the create / resend
// invite action on /organizer/settings/invites. Contains the magic-link
// URL with the plaintext token; the accept page in PR 5 verifies the
// hash against organizer_invites.token_hash.

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
import { strings } from "./OrganizerInviteSent.strings";

export { strings } from "./OrganizerInviteSent.strings";

export type OrganizerInviteSentProps = {
  locale?: Locale;
  /** Company name as it should appear in the email body + subject. */
  company_name?: string;
  /** Inviter's display name (full_name from profiles). Optional — when null
   *  the template falls back to "An admin invited you...". */
  inviter_name?: string | null;
  role?: "admin" | "member";
  invite_url?: string;
  expires_at?: string;
  company_id?: string;
};

export default function OrganizerInviteSent({
  locale = "en",
  company_name = "",
  inviter_name = null,
  role = "member",
  invite_url = BRAND.marketingUrl,
  expires_at = "",
}: OrganizerInviteSentProps) {
  const effectiveLocale: Locale = locale ?? "en";
  const s = strings[effectiveLocale];
  const dir = dirFor(effectiveLocale);
  const align = textAlignStart(effectiveLocale);
  const font = fontFor(effectiveLocale);

  const roleLabel = s.role[role];
  const hasExpires = typeof expires_at === "string" && expires_at.length > 0;
  const formattedExpires = hasExpires
    ? formatEmailDateTime(expires_at, effectiveLocale, {
        dateStyle: "full",
        timeStyle: "short",
      })
    : "";

  return (
    <BrandShell
      locale={effectiveLocale}
      preview={s.preheader(company_name, roleLabel)}
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
        {s.heading(company_name)}
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
        {s.body(company_name, roleLabel, inviter_name)}
      </Text>

      {hasExpires ? (
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
            {s.expiresLabel}
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
            {formattedExpires}
          </Text>
        </Section>
      ) : null}

      <Section style={{ marginTop: 24, textAlign: align, direction: dir }}>
        <Link
          href={invite_url}
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
          fontSize: 12,
          lineHeight: 1.6,
          margin: "24px 0 0",
          textAlign: align,
          direction: dir,
          wordBreak: "break-all",
        }}
      >
        {s.fallback}
        <br />
        {invite_url}
      </Text>
    </BrandShell>
  );
}
