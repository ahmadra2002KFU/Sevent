"use client";

import { useTransition } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { useTranslations } from "next-intl";
import { PACKAGE_UNITS } from "@/lib/domain/packages";
import { halalasToSar } from "@/lib/domain/money";
import type { PackageRow } from "@/lib/supabase/types";
import type { CatalogSubcategory } from "./loader";
import {
  upsertPackageAction,
  type CatalogActionResult,
} from "./actions";

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
        max_qty: values.max_qty === null || values.max_qty === undefined || Number.isNaN(Number(values.max_qty))
          ? null
          : Number(values.max_qty),
      });
      onDone(result);
    });
  };

  if (subcategories.length === 0) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        {t("noSubcategories")}
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/40 p-4"
      onSubmit={handleSubmit(submit)}
      noValidate
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("packageForm.nameLabel")} error={errors.name?.message}>
          <input
            {...register("name", { required: true, minLength: 2, maxLength: 120 })}
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field
          label={t("packageForm.subcategoryLabel")}
          error={errors.subcategory_id?.message}
        >
          <select
            {...register("subcategory_id", { required: true })}
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          >
            {subcategories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.parent_name_en ? `${s.parent_name_en} · ` : ""}
                {s.name_en}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label={t("packageForm.descriptionLabel")}
        error={errors.description?.message}
      >
        <textarea
          {...register("description")}
          rows={3}
          className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          label={t("packageForm.basePriceLabel")}
          hint={t("packageForm.basePriceHint")}
          error={errors.base_price_sar?.message}
        >
          <input
            inputMode="decimal"
            {...register("base_price_sar", { required: true })}
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t("packageForm.unitLabel")} error={errors.unit?.message}>
          <select
            {...register("unit")}
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
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
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("from_price_visible")} />
            <span>{t("packageForm.fromVisibleToggle")}</span>
          </label>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("packageForm.minQtyLabel")} error={errors.min_qty?.message}>
          <input
            type="number"
            min={1}
            {...register("min_qty", { valueAsNumber: true })}
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field
          label={t("packageForm.maxQtyLabel")}
          hint={t("packageForm.maxQtyHint")}
          error={errors.max_qty?.message}
        >
          <input
            type="number"
            min={1}
            {...register("max_qty", { valueAsNumber: true })}
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t("activeToggle")}>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("is_active")} />
            <span>{t("packageForm.activeToggle")}</span>
          </label>
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-60"
        >
          {isPending ? t("saving") : t("save")}
        </button>
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
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint ? (
        <span className="text-xs text-[var(--color-muted-foreground)]">
          {hint}
        </span>
      ) : null}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
