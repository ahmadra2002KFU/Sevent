"use client";

import { useTransition } from "react";
import { Controller, useForm, type SubmitHandler } from "react-hook-form";
import { useTranslations } from "next-intl";
import { PACKAGE_UNITS } from "@/lib/domain/packages";
import { halalasToSar } from "@/lib/domain/money";
import type { PackageRow } from "@/lib/supabase/types";
import type { CatalogSubcategory } from "./loader";
import {
  upsertPackageAction,
  type CatalogActionResult,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubcategoryCombobox } from "./SubcategoryCombobox";

type FormValues = {
  id?: string;
  subcategory_id: string;
  name: string;
  description?: string;
  base_price_sar: string;
  unit: (typeof PACKAGE_UNITS)[number];
  min_qty: number;
  max_qty?: number | null;
  from_price_visible: boolean;
  is_active: boolean;
};

type Props = {
  subcategories: CatalogSubcategory[];
  initial?: PackageRow | null;
  onDone: (result: CatalogActionResult) => void;
  onCancel: () => void;
};

export function PackageForm({ subcategories, initial, onDone, onCancel }: Props) {
  const t = useTranslations("supplier.catalog");
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    // The server action re-parses with PackageFormInput (Zod) before writing;
    // client-side validation is kept intentionally light so the single source
    // of truth for money + qty coercion stays on the server.
    defaultValues: initial
      ? {
          id: initial.id,
          subcategory_id: initial.subcategory_id,
          name: initial.name,
          description: initial.description ?? "",
          base_price_sar: halalasToSar(initial.base_price_halalas).toFixed(2),
          unit: initial.unit,
          min_qty: initial.min_qty,
          max_qty: initial.max_qty ?? null,
          from_price_visible: initial.from_price_visible,
          is_active: initial.is_active,
        }
      : {
          subcategory_id: subcategories[0]?.id ?? "",
          name: "",
          description: "",
          base_price_sar: "",
          unit: "event",
          min_qty: 1,
          max_qty: null,
          from_price_visible: true,
          is_active: true,
        },
  });

  const submit: SubmitHandler<FormValues> = (values) => {
    startTransition(async () => {
      const result = await upsertPackageAction({
        ...values,
        max_qty:
          values.max_qty === null ||
          values.max_qty === undefined ||
          Number.isNaN(Number(values.max_qty))
            ? null
            : Number(values.max_qty),
      });
      onDone(result);
    });
  };

  if (subcategories.length === 0) {
    return (
      <Alert>
        <AlertDescription>{t("noSubcategories")}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={handleSubmit(submit)}
      noValidate
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("packageForm.nameLabel")} error={errors.name?.message}>
          <Input
            {...register("name", { required: true, minLength: 2, maxLength: 120 })}
          />
        </Field>
        <Field
          label={t("packageForm.subcategoryLabel")}
          error={errors.subcategory_id?.message}
        >
          <Controller
            control={control}
            name="subcategory_id"
            rules={{ required: true }}
            render={({ field }) => (
              <SubcategoryCombobox
                subcategories={subcategories}
                value={field.value}
                onChange={field.onChange}
                ariaLabel={t("packageForm.subcategoryLabel")}
              />
            )}
          />
        </Field>
      </div>

      <Field
        label={t("packageForm.descriptionLabel")}
        error={errors.description?.message}
      >
        <Textarea {...register("description")} rows={3} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          label={t("packageForm.basePriceLabel")}
          hint={t("packageForm.basePriceHint")}
          error={errors.base_price_sar?.message}
        >
          <Input
            inputMode="decimal"
            {...register("base_price_sar", { required: true })}
          />
        </Field>
        <Field label={t("packageForm.unitLabel")} error={errors.unit?.message}>
          <select
            {...register("unit")}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-3 focus:ring-ring/50"
          >
            {PACKAGE_UNITS.map((u) => (
              <option key={u} value={u}>
                {t(`packageForm.unit.${u}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={t("packageForm.fromVisibleLabel")}
          hint={t("packageForm.fromVisibleHint")}
        >
          <label className="flex items-center gap-2 pt-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border-border accent-brand-cobalt-500"
              {...register("from_price_visible")}
            />
            <span>{t("packageForm.fromVisibleToggle")}</span>
          </label>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("packageForm.minQtyLabel")} error={errors.min_qty?.message}>
          <Input
            type="number"
            min={1}
            {...register("min_qty", { valueAsNumber: true })}
          />
        </Field>
        <Field
          label={t("packageForm.maxQtyLabel")}
          hint={t("packageForm.maxQtyHint")}
          error={errors.max_qty?.message}
        >
          <Input
            type="number"
            min={1}
            {...register("max_qty", { valueAsNumber: true })}
          />
        </Field>
        <Field label={t("activeToggle")}>
          <label className="flex items-center gap-2 pt-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border-border accent-brand-cobalt-500"
              {...register("is_active")}
            />
            <span>{t("packageForm.activeToggle")}</span>
          </label>
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <Label className="flex flex-col items-start gap-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      {children}
      {hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
      {error ? (
        <span className="text-xs text-semantic-danger-500">{error}</span>
      ) : null}
    </Label>
  );
}
