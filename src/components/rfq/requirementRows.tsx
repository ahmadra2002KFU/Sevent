/**
 * Shared, framework-agnostic row builder for an RFQ's `requirements_jsonb`.
 *
 * Both the server presenter (`RfqRequirementsView`) and the client-side
 * wizard review block need the exact same "parsed extension → localized field
 * rows" mapping. The translation accessors from `next-intl` — `getTranslations`
 * (server) and `useTranslations` (client) — share the same `(key) => string`
 * call shape, so this module takes them as parameters and stays usable from
 * either environment without duplicating the discriminated-union switch.
 */

import type { RfqExtension } from "@/lib/domain/rfq";

/** Minimal translation-function shape shared by server + client next-intl. */
export type Translator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export type RfqRequirementRow = { label: string; value: React.ReactNode };

/**
 * Maps a parsed `RfqExtension` to localized `{ label, value }` rows.
 *
 * @param value   the parsed discriminated-union extension
 * @param t       translator scoped to `rfqRequirements` (field labels + yes/no)
 * @param tValues translator scoped to `requirementValues` (enum values)
 */
export function buildRfqRequirementRows(
  value: RfqExtension,
  t: Translator,
  tValues: Translator,
): RfqRequirementRow[] {
  const yn = (b: boolean): string => (b ? t("yes") : t("no"));
  const rows: RfqRequirementRow[] = [
    { label: t("field.kind"), value: tValues(`kind.${value.kind}`) },
  ];

  switch (value.kind) {
    case "venues":
      rows.push(
        {
          label: t("field.seating_style"),
          value: tValues(`seating_style.${value.seating_style}`),
        },
        {
          label: t("field.indoor_outdoor"),
          value: tValues(`indoor_outdoor.${value.indoor_outdoor}`),
        },
        { label: t("field.needs_parking"), value: yn(value.needs_parking) },
        { label: t("field.needs_kitchen"), value: yn(value.needs_kitchen) },
      );
      break;
    case "catering":
      rows.push(
        {
          label: t("field.meal_type"),
          value: tValues(`meal_type.${value.meal_type}`),
        },
        {
          label: t("field.dietary"),
          value:
            value.dietary.length > 0
              ? value.dietary.map((d) => tValues(`dietary.${d}`)).join(", ")
              : "—",
        },
        {
          label: t("field.service_style"),
          value: tValues(`service_style.${value.service_style}`),
        },
      );
      break;
    case "photography":
      rows.push(
        {
          label: t("field.coverage_hours"),
          value: String(value.coverage_hours),
        },
        {
          label: t("field.deliverables"),
          value:
            value.deliverables.length > 0
              ? value.deliverables
                  .map((d) => tValues(`deliverables.${d}`))
                  .join(", ")
              : "—",
        },
        { label: t("field.crew_size"), value: String(value.crew_size) },
      );
      break;
    case "generic":
      rows.push(
        { label: t("field.qty"), value: value.qty ?? "—" },
        {
          label: t("field.notes"),
          value: value.notes ? (
            <span className="whitespace-pre-wrap">{value.notes}</span>
          ) : (
            "—"
          ),
        },
      );
      break;
  }

  return rows;
}
