"use client";

import { useTranslations } from "next-intl";
import type { VenuesExtension } from "@/lib/domain/rfq";

type Props = {
  value: VenuesExtension;
  onChange: (next: VenuesExtension) => void;
  errors?: Record<string, string>;
};

const SEATING_STYLES = [
  "rounds",
  "theatre",
  "classroom",
  "cocktail",
  "majlis",
] as const;
const INDOOR_OUTDOOR = ["indoor", "outdoor", "either"] as const;

export function VenuesExtensionForm({ value, onChange, errors }: Props) {
  const t = useTranslations("organizer.rfqWizard.extensions.venues");

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="text-base font-semibold tracking-tight">
        {t("heading")}
      </legend>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("seatingStyle.label")}</span>
        <select
          className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2"
          value={value.seating_style}
          onChange={(e) =>
            onChange({
              ...value,
              seating_style: e.target
                .value as VenuesExtension["seating_style"],
            })
          }
        >
          {SEATING_STYLES.map((style) => (
            <option key={style} value={style}>
              {t(`seatingStyle.${style}`)}
            </option>
          ))}
        </select>
        {errors?.seating_style ? (
          <span className="text-xs text-red-600">{errors.seating_style}</span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("indoorOutdoor.label")}</span>
        <select
          className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2"
          value={value.indoor_outdoor}
          onChange={(e) =>
            onChange({
              ...value,
              indoor_outdoor: e.target
                .value as VenuesExtension["indoor_outdoor"],
            })
          }
        >
          {INDOOR_OUTDOOR.map((opt) => (
            <option key={opt} value={opt}>
              {t(`indoorOutdoor.${opt}`)}
            </option>
          ))}
        </select>
        {errors?.indoor_outdoor ? (
          <span className="text-xs text-red-600">{errors.indoor_outdoor}</span>
        ) : null}
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.needs_parking}
          onChange={(e) =>
            onChange({ ...value, needs_parking: e.target.checked })
          }
          className="h-4 w-4 rounded border-[var(--color-border)]"
        />
        <span>{t("needsParking")}</span>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.needs_kitchen}
          onChange={(e) =>
            onChange({ ...value, needs_kitchen: e.target.checked })
          }
          className="h-4 w-4 rounded border-[var(--color-border)]"
        />
        <span>{t("needsKitchen")}</span>
      </label>
    </fieldset>
  );
}
