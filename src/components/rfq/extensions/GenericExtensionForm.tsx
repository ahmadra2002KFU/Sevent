"use client";

import { useTranslations } from "next-intl";
import type { GenericExtension } from "@/lib/domain/rfq";

type Props = {
  value: GenericExtension;
  onChange: (next: GenericExtension) => void;
  errors?: Record<string, string>;
};

export function GenericExtensionForm({ value, onChange, errors }: Props) {
  const t = useTranslations("organizer.rfqWizard.extensions.generic");

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-base font-semibold tracking-tight">
        {t("heading")}
      </legend>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("notesLabel")}</span>
        <textarea
          name="notes"
          value={value.notes}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          maxLength={2000}
          rows={6}
          placeholder={t("notesPlaceholder")}
          className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 leading-relaxed"
        />
        {errors?.notes ? (
          <span className="text-xs text-red-600">{errors.notes}</span>
        ) : null}
      </label>
    </fieldset>
  );
}
