// Shared "which workspace is this about" line for organizer-facing emails.

import { Text } from "@react-email/components";
import { BRAND } from "../_brand";
import { dirFor, fontFor, textAlignStart, type Locale } from "./i18n";

/**
 * Renders a muted `Workspace · Acme Events` line under an organizer-facing
 * email's heading. Returns nothing when there is no company — individual
 * organizers keep the exact copy they had before (review finding F2).
 *
 * Why organizer-facing emails need this at all: once a company has more than
 * one member, "a quote arrived" is ambiguous — the recipient may belong to
 * several companies, and (with the notification fan-out) may not be the person
 * who raised the RFQ. Naming the workspace is what makes a fanned-out email
 * actionable.
 *
 * Supplier-facing emails use `formatOrganizerIdentity()` instead: there the
 * company is the *primary* identity ("Acme Events — via Sara"), not context.
 */
export function CompanyContextLine({
  locale,
  companyName,
}: {
  locale: Locale;
  companyName?: string | null;
}) {
  const name = companyName?.trim();
  if (!name) return null;

  const label = locale === "ar" ? "مساحة العمل" : "Workspace";

  return (
    <Text
      style={{
        color: BRAND.colors.muted,
        fontFamily: fontFor(locale),
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1.4,
        margin: "0 0 12px",
        textAlign: textAlignStart(locale),
        direction: dirFor(locale),
      }}
    >
      {`${label} · ${name}`}
    </Text>
  );
}
