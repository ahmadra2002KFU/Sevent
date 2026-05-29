import type { RfqExtensionKind } from "@/lib/domain/rfq";

/**
 * Map active boss-taxonomy parent slugs to the small set of specialized RFQ
 * requirement forms that exist today. Everything else intentionally uses the
 * generic item-category form until new domain-specific forms are designed.
 */
export function kindFromParentSlug(
  slug: string | undefined,
): RfqExtensionKind {
  switch (slug) {
    case "hospitality":
      return "catering";
    case "media_production":
      return "photography";
    default:
      return "generic";
  }
}
