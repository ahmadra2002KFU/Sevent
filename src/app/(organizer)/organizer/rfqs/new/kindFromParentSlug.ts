/**
 * Map a real seeded-taxonomy parent slug (see `src/lib/domain/taxonomy.ts`)
 * to the RFQ extension form that should render for it.
 *
 * Pre-Stage-4 this function checked slugs `venues` / `catering` /
 * `photography`, none of which exist in the seeded taxonomy — so every
 * subcategory the organizer picked silently collapsed to the `generic`
 * extension and the wizard never showed the venues / catering /
 * photography specialized forms. The seeded parent slugs are:
 *
 *   sound_lighting · photo_video · catering_hospitality · tents_structures
 *   furniture_equipment · entertainment_arts · transport_logistics
 *   stands_exhibitions · coordination_management · flowers_decor
 *   makeup_beauty · electricity_power
 *
 * Mapping rationale:
 *   - `tents_structures` → `venues` — tents / domes / temporary hangars are
 *     the event-space option in the seeded taxonomy (there is no `venues`
 *     parent), and the `VenuesExtension` schema captures the right
 *     requirements (seating_style, indoor / outdoor, parking, kitchen).
 *   - `catering_hospitality` → `catering` — buffet / kitchens / VIP-services
 *     all want the meal_type / dietary / service_style form.
 *   - `photo_video` → `photography` — photographers / film / live-streaming
 *     all want coverage_hours / deliverables / crew_size.
 *   - everything else → `generic` — sound / lighting / furniture /
 *     entertainment / transport / stands / coordination / flowers / makeup /
 *     electricity all fall back to the `notes` + optional `qty` form.
 *
 * Lifted into its own module so it can be unit-tested without bringing in
 * the wizard's client-side `useReducer` state machine (Next.js page files
 * forbid named exports beyond a tight allow-list).
 */
import type { RfqExtensionKind } from "@/lib/domain/rfq";

export function kindFromParentSlug(
  slug: string | undefined,
): RfqExtensionKind {
  switch (slug) {
    case "tents_structures":
      return "venues";
    case "catering_hospitality":
      return "catering";
    case "photo_video":
      return "photography";
    default:
      return "generic";
  }
}
