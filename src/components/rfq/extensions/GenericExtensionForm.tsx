"use client";

import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { GenericExtension } from "@/lib/domain/rfq";

type Props = {
  value: GenericExtension;
  onChange: (next: GenericExtension) => void;
  errors?: Record<string, string>;
};

export function GenericExtensionForm({ value, onChange, errors }: Props) {
  const t = useTranslations("organizer.rfqWizard.extensions.generic");

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-base font-semibold tracking-tight text-brand-navy-900">
        {t("heading")}
      </legend>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="g-notes">{t("notesLabel")}</Label>
        <Textarea
          id="g-notes"
          name="notes"
          value={value.notes}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          maxLength={2000}
          rows={6}
          placeholder={t("notesPlaceholder")}
          aria-invalid={!!errors?.notes}
        />
        {errors?.notes ? (
          <p className="text-xs text-destructive">{errors.notes}</p>
        ) : null}
      </div>
    </fieldset>
  );
}
