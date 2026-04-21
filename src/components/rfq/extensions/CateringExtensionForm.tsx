"use client";

import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    <fieldset className="flex flex-col gap-5">
      <legend className="text-base font-semibold tracking-tight text-brand-navy-900">
        {t("heading")}
      </legend>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="c-meal">{t("mealType.label")}</Label>
          <Select
            value={value.meal_type}
            onValueChange={(v) =>
              onChange({
                ...value,
                meal_type: v as CateringExtension["meal_type"],
              })
            }
          >
            <SelectTrigger id="c-meal" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEAL_TYPES.map((m) => (
                <SelectItem key={m} value={m}>
                  {t(`mealType.${m}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors?.meal_type ? (
            <p className="text-xs text-destructive">{errors.meal_type}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="c-service">{t("serviceStyle.label")}</Label>
          <Select
            value={value.service_style}
            onValueChange={(v) =>
              onChange({
                ...value,
                service_style: v as CateringExtension["service_style"],
              })
            }
          >
            <SelectTrigger id="c-service" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_STYLES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`serviceStyle.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors?.service_style ? (
            <p className="text-xs text-destructive">{errors.service_style}</p>
          ) : null}
        </div>
      </div>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="text-sm font-medium">{t("dietary.label")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {DIETARY.map((opt) => {
            const checked = value.dietary.includes(opt);
            return (
              <label
                key={opt}
                className="flex items-center gap-3 rounded-lg border bg-card p-2.5 transition-colors hover:border-brand-cobalt-500/40"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleDietary(opt)}
                />
                <span className="text-sm">{t(`dietary.${opt}`)}</span>
              </label>
            );
          })}
        </div>
        {errors?.dietary ? (
          <p className="text-xs text-destructive">{errors.dietary}</p>
        ) : null}
      </fieldset>
    </fieldset>
  );
}
