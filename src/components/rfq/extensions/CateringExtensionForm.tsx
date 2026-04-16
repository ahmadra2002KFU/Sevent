"use client";

import { useTranslations } from "next-intl";
import type { CateringExtension } from "@/lib/domain/rfq";

type Props = {
  value: CateringExtension;
  onChange: (next: CateringExtension) => void;
  errors?: Record<string, string>;
};

const MEAL_TYPES = ["buffet", "plated", "coffee_break", "cocktail"] as const;
const DIETARY = [
  "halal_only",
  "vegetarian",
  "vegan",
  "gluten_free",
  "nut_free",
] as const;
const SERVICE_STYLES = ["self_serve", "served", "mixed"] as const;

type DietaryOpt = (typeof DIETARY)[number];

export function CateringExtensionForm({ value, onChange, errors }: Props) {
  const t = useTranslations("organizer.rfqWizard.extensions.catering");

  const toggleDietary = (opt: DietaryOpt) => {
    const has = value.dietary.includes(opt);
    const next = has
      ? value.dietary.filter((d) => d !== opt)
      : [...value.dietary, opt];
    onChange({ ...value, dietary: next });
  };

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="text-base font-semibold tracking-tight">
        {t("heading")}
      </legend>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("mealType.label")}</span>
        <select
          className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2"
          value={value.meal_type}
          onChange={(e) =>
            onChange({
              ...value,
              meal_type: e.target.value as CateringExtension["meal_type"],
            })
          }
        >
          {MEAL_TYPES.map((m) => (
            <option key={m} value={m}>
              {t(`mealType.${m}`)}
            </option>
          ))}
        </select>
        {errors?.meal_type ? (
          <span className="text-xs text-red-600">{errors.meal_type}</span>
        ) : null}
      </label>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="font-medium">{t("dietary.label")}</legend>
        <div className="flex flex-wrap gap-3">
          {DIETARY.map((opt) => (
            <label key={opt} className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={value.dietary.includes(opt)}
                onChange={() => toggleDietary(opt)}
                className="h-4 w-4 rounded border-[var(--color-border)]"
              />
              <span>{t(`dietary.${opt}`)}</span>
            </label>
          ))}
        </div>
        {errors?.dietary ? (
          <span className="text-xs text-red-600">{errors.dietary}</span>
        ) : null}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("serviceStyle.label")}</span>
        <select
          className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2"
          value={value.service_style}
          onChange={(e) =>
            onChange({
              ...value,
              service_style: e.target
                .value as CateringExtension["service_style"],
            })
          }
        >
          {SERVICE_STYLES.map((s) => (
            <option key={s} value={s}>
              {t(`serviceStyle.${s}`)}
            </option>
          ))}
        </select>
        {errors?.service_style ? (
          <span className="text-xs text-red-600">{errors.service_style}</span>
        ) : null}
      </label>
    </fieldset>
  );
}
