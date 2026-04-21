"use client";

import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PhotographyExtension } from "@/lib/domain/rfq";

type Props = {
  value: PhotographyExtension;
  onChange: (next: PhotographyExtension) => void;
  errors?: Record<string, string>;
};

const DELIVERABLES = [
  "photos",
  "video",
  "drone",
  "same_day_edit",
  "printed_album",
] as const;

type DeliverableOpt = (typeof DELIVERABLES)[number];

export function PhotographyExtensionForm({
  value,
  onChange,
  errors,
}: Props) {
  const t = useTranslations("organizer.rfqWizard.extensions.photography");

  const toggleDeliverable = (opt: DeliverableOpt) => {
    const has = value.deliverables.includes(opt);
    const next = has
      ? value.deliverables.filter((d) => d !== opt)
      : [...value.deliverables, opt];
    onChange({ ...value, deliverables: next });
  };

  return (
    <fieldset className="flex flex-col gap-5">
      <legend className="text-base font-semibold tracking-tight text-brand-navy-900">
        {t("heading")}
      </legend>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="p-hours">{t("coverageHours")}</Label>
          <Input
            id="p-hours"
            type="number"
            inputMode="numeric"
            min={1}
            max={24}
            value={value.coverage_hours}
            onChange={(e) =>
              onChange({
                ...value,
                coverage_hours: Number.isFinite(e.target.valueAsNumber)
                  ? e.target.valueAsNumber
                  : value.coverage_hours,
              })
            }
            aria-invalid={!!errors?.coverage_hours}
          />
          {errors?.coverage_hours ? (
            <p className="text-xs text-destructive">
              {errors.coverage_hours}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="p-crew">{t("crewSize")}</Label>
          <Input
            id="p-crew"
            type="number"
            inputMode="numeric"
            min={1}
            max={10}
            value={value.crew_size}
            onChange={(e) =>
              onChange({
                ...value,
                crew_size: Number.isFinite(e.target.valueAsNumber)
                  ? e.target.valueAsNumber
                  : value.crew_size,
              })
            }
            aria-invalid={!!errors?.crew_size}
          />
          {errors?.crew_size ? (
            <p className="text-xs text-destructive">{errors.crew_size}</p>
          ) : null}
        </div>
      </div>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="text-sm font-medium">
          {t("deliverables.label")}
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {DELIVERABLES.map((opt) => {
            const checked = value.deliverables.includes(opt);
            return (
              <label
                key={opt}
                className="flex items-center gap-3 rounded-lg border bg-card p-2.5 transition-colors hover:border-brand-cobalt-500/40"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleDeliverable(opt)}
                />
                <span className="text-sm">{t(`deliverables.${opt}`)}</span>
              </label>
            );
          })}
        </div>
        {errors?.deliverables ? (
          <p className="text-xs text-destructive">{errors.deliverables}</p>
        ) : null}
      </fieldset>
    </fieldset>
  );
}
