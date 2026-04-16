"use client";

/**
 * RFQ extension form dispatcher — shared component for the Lane 3 RFQ wizard.
 *
 * Lane 3's RFQ wizard imports `{ RfqExtensionForm, defaultExtensionFor }` from
 * this module. Each subform is a **controlled component**: the parent owns the
 * state and passes `value` + `onChange`; we call `onChange(newValue)` on every
 * interaction and never mutate the incoming `value`.
 *
 * `errors` is an optional flat record of validation messages. The key format is
 * `<field>` for scalar fields (e.g. `"seating_style"`, `"coverage_hours"`) or
 * `<field>.<subfield>` if a subform introduces nested errors in the future.
 * Unknown keys are ignored by the subforms — safe to pass a wider errors map
 * from the parent.
 *
 * `defaultExtensionFor(kind)` returns parse-clean defaults: feeding the result
 * to the matching Zod schema (`VenuesExtension`, `CateringExtension`, etc.)
 * will succeed without refinements. Use these whenever the user first selects
 * a subcategory kind so the wizard always has a valid controlled value.
 */

import type { RfqExtension, RfqExtensionKind } from "@/lib/domain/rfq";
import { VenuesExtensionForm } from "./VenuesExtensionForm";
import { CateringExtensionForm } from "./CateringExtensionForm";
import { PhotographyExtensionForm } from "./PhotographyExtensionForm";
import { GenericExtensionForm } from "./GenericExtensionForm";

type RfqExtensionFormProps = {
  kind: RfqExtensionKind;
  value: RfqExtension;
  onChange: (next: RfqExtension) => void;
  errors?: Record<string, string>;
};

export function RfqExtensionForm({
  kind,
  value,
  onChange,
  errors,
}: RfqExtensionFormProps) {
  // Defensive: if the caller swaps `kind` without updating `value`, fall back
  // to a clean default so the subform never renders with a mismatched shape.
  const safeValue: RfqExtension =
    value.kind === kind ? value : defaultExtensionFor(kind);

  switch (kind) {
    case "venues":
      return (
        <VenuesExtensionForm
          value={safeValue as Extract<RfqExtension, { kind: "venues" }>}
          onChange={onChange}
          errors={errors}
        />
      );
    case "catering":
      return (
        <CateringExtensionForm
          value={safeValue as Extract<RfqExtension, { kind: "catering" }>}
          onChange={onChange}
          errors={errors}
        />
      );
    case "photography":
      return (
        <PhotographyExtensionForm
          value={safeValue as Extract<RfqExtension, { kind: "photography" }>}
          onChange={onChange}
          errors={errors}
        />
      );
    case "generic":
      return (
        <GenericExtensionForm
          value={safeValue as Extract<RfqExtension, { kind: "generic" }>}
          onChange={onChange}
          errors={errors}
        />
      );
    default: {
      // Exhaustiveness guard: if a new kind is added to RfqExtensionKind, TS
      // will flag this assignment and force the dispatcher to be updated.
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/**
 * Returns parse-clean defaults for the given extension kind. The returned
 * value will pass `SCHEMA_BY_KIND[kind].parse(...)` from `@/lib/domain/rfq`.
 */
export function defaultExtensionFor(kind: RfqExtensionKind): RfqExtension {
  switch (kind) {
    case "venues":
      return {
        kind: "venues",
        seating_style: "rounds",
        indoor_outdoor: "either",
        needs_parking: false,
        needs_kitchen: false,
      };
    case "catering":
      return {
        kind: "catering",
        meal_type: "buffet",
        dietary: ["halal_only"],
        service_style: "served",
      };
    case "photography":
      return {
        kind: "photography",
        coverage_hours: 4,
        deliverables: ["photos"],
        crew_size: 1,
      };
    case "generic":
      return {
        kind: "generic",
        notes: "",
      };
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export {
  VenuesExtensionForm,
  CateringExtensionForm,
  PhotographyExtensionForm,
  GenericExtensionForm,
};
