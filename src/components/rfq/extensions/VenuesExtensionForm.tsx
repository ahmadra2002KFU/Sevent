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
    <fieldset className="flex flex-col gap-5">
      <legend className="text-base font-semibold tracking-tight text-brand-navy-900">
        {t("heading")}
      </legend>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="v-seating">{t("seatingStyle.label")}</Label>
          <Select
            value={value.seating_style}
            onValueChange={(v) =>
              onChange({
                ...value,
                seating_style: v as VenuesExtension["seating_style"],
              })
            }
          >
            <SelectTrigger id="v-seating" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEATING_STYLES.map((style) => (
                <SelectItem key={style} value={style}>
                  {t(`seatingStyle.${style}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors?.seating_style ? (
            <p className="text-xs text-destructive">{errors.seating_style}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="v-indoor">{t("indoorOutdoor.label")}</Label>
          <Select
            value={value.indoor_outdoor}
            onValueChange={(v) =>
              onChange({
                ...value,
                indoor_outdoor: v as VenuesExtension["indoor_outdoor"],
              })
            }
          >
            <SelectTrigger id="v-indoor" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INDOOR_OUTDOOR.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {t(`indoorOutdoor.${opt}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors?.indoor_outdoor ? (
            <p className="text-xs text-destructive">{errors.indoor_outdoor}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-brand-cobalt-500/40">
          <Checkbox
            checked={value.needs_parking}
            onCheckedChange={(checked) =>
              onChange({ ...value, needs_parking: checked === true })
            }
          />
          <span className="text-sm font-medium">{t("needsParking")}</span>
        </label>
        <label className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-brand-cobalt-500/40">
          <Checkbox
            checked={value.needs_kitchen}
            onCheckedChange={(checked) =>
              onChange({ ...value, needs_kitchen: checked === true })
            }
          />
          <span className="text-sm font-medium">{t("needsKitchen")}</span>
        </label>
      </div>
    </fieldset>
  );
}
