"use client";

import { useTranslations } from "next-intl";
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

export function PhotographyExtensionForm({ value, onChange, errors }: Props) {
  const t = useTranslations("organizer.rfqWizard.extensions.photography");

  const toggleDeliverable = (opt: DeliverableOpt) => {
    const has = value.deliverables.includes(opt);
    const next = has
      ? value.deliverables.filter((d) => d !== opt)
      : [...value.deliverables, opt];
    onChange({ ...value, deliverables: next });
  };

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="text-base font-semibold tracking-tight">
        {t("heading")}
      </legend>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("coverageHours")}</span>
        <input
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
          className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2"
        />
        {errors?.coverage_hours ? (
          <span className="text-xs text-red-600">{errors.coverage_hours}</span>
        ) : null}
      </label>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="font-medium">{t("deliverables.label")}</legend>
        <div className="flex flex-wrap gap-3">
          {DELIVERABLES.map((opt) => (
            <label key={opt} className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={value.deliverables.includes(opt)}
                onChange={() => toggleDeliverable(opt)}
                className="h-4 w-4 rounded border-[var(--color-border)]"
              />
              <span>{t(`deliverables.${opt}`)}</span>
            </label>
          ))}
        </div>
        {errors?.deliverables ? (
          <span className="text-xs text-red-600">{errors.deliverables}</span>
        ) : null}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("crewSize")}</span>
        <input
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
          className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2"
        />
        {errors?.crew_size ? (
          <span className="text-xs text-red-600">{errors.crew_size}</span>
        ) : null}
      </label>
    </fieldset>
  );
}
