"use client";

/**
 * Lane 3 · Sprint 3 — organizer "new event" form.
 *
 * RHF + Zod resolver against `EventFormInput`. The form renders SAR-decimals
 * for budgets (converted to halalas by the server action). Client-side Zod
 * validation is authoritative against the form's own input shape; the server
 * action re-parses through the same schema before touching the DB.
 */

import { useRef, useTransition } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CITY_OPTIONS,
  EVENT_TYPES,
  EventFormInput,
  type CityOption,
  type EventType,
} from "@/lib/domain/events";
import { createEventAction } from "../actions";

type FormValues = {
  event_type: EventType | "";
  city: CityOption | "";
  client_name?: string;
  venue_address: string;
  starts_at: string;
  ends_at: string;
  guest_count?: number | string;
  budget_min_sar?: string;
  budget_max_sar?: string;
  notes?: string;
};

function toIsoIfPresent(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

export function EventForm() {
  const t = useTranslations("organizer.eventForm");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<FormValues>({
    mode: "onBlur",
    // We resolve with a **transformed** schema: the form's datetime-local
    // inputs are converted to ISO strings before Zod sees them. This keeps
    // the `EventFormInput` Zod rules (including the ends-after-start refine)
    // working against the serialized wire-shape.
    resolver: async (values) => {
      const candidate = {
        ...values,
        starts_at: toIsoIfPresent(values.starts_at),
        ends_at: toIsoIfPresent(values.ends_at),
        client_name: values.client_name?.trim() ? values.client_name.trim() : undefined,
        notes: values.notes?.trim() ? values.notes.trim() : undefined,
        guest_count:
          values.guest_count === "" || values.guest_count === undefined
            ? undefined
            : values.guest_count,
        budget_min_sar:
          values.budget_min_sar?.trim() ? values.budget_min_sar.trim() : undefined,
        budget_max_sar:
          values.budget_max_sar?.trim() ? values.budget_max_sar.trim() : undefined,
      };
      const parsed = EventFormInput.safeParse(candidate);
      if (parsed.success) {
        return { values, errors: {} };
      }
      const fieldErrors: Record<string, { type: string; message: string }> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (!path) continue;
        if (fieldErrors[path]) continue;
        fieldErrors[path] = { type: issue.code, message: issue.message };
      }
      return { values: {}, errors: fieldErrors };
    },
    defaultValues: {
      event_type: "",
      city: "",
      client_name: "",
      venue_address: "",
      starts_at: "",
      ends_at: "",
      guest_count: "",
      budget_min_sar: "",
      budget_max_sar: "",
      notes: "",
    },
  });

  const submit: SubmitHandler<FormValues> = () => {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    startTransition(async () => {
      try {
        await createEventAction(fd);
      } catch (err) {
        // Next re-throws NEXT_REDIRECT on success — only surface genuine errors.
        if (err && typeof err === "object" && "digest" in err) {
          throw err;
        }
        alert(err instanceof Error ? err.message : "Failed to create event.");
      }
    });
  };

  const watchedStart = watch("starts_at");

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit(submit)}
      className="flex flex-col gap-5 rounded-lg border border-[var(--color-border)] bg-white p-5 shadow-sm"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("eventTypeLabel")} error={errors.event_type?.message}>
          <select
            {...register("event_type")}
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {EVENT_TYPES.map((et) => (
              <option key={et} value={et}>
                {t(`eventType.${et}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("cityLabel")} error={errors.city?.message}>
          <select
            {...register("city")}
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {CITY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {t(`city.${c}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label={t("clientNameLabel")} error={errors.client_name?.message}>
        <input
          {...register("client_name")}
          className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        />
      </Field>

      <Field label={t("venueAddressLabel")} error={errors.venue_address?.message}>
        <textarea
          {...register("venue_address", { required: true })}
          rows={2}
          className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("startsAtLabel")} error={errors.starts_at?.message}>
          <input
            type="datetime-local"
            {...register("starts_at", { required: true })}
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t("endsAtLabel")} error={errors.ends_at?.message}>
          <input
            type="datetime-local"
            min={watchedStart || undefined}
            {...register("ends_at", { required: true })}
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("guestCountLabel")} error={errors.guest_count?.message}>
          <input
            type="number"
            min={1}
            {...register("guest_count")}
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t("budgetMinLabel")} error={errors.budget_min_sar?.message}>
          <input
            inputMode="decimal"
            {...register("budget_min_sar")}
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t("budgetMaxLabel")} error={errors.budget_max_sar?.message}>
          <input
            inputMode="decimal"
            {...register("budget_max_sar")}
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <Field label={t("notesLabel")} error={errors.notes?.message}>
        <textarea
          {...register("notes")}
          rows={3}
          className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        />
      </Field>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={() => router.push("/organizer/events")}
          className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm hover:bg-[var(--color-muted)]"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-[var(--color-primary,#111)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {isPending ? t("saving") : t("submit")}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
