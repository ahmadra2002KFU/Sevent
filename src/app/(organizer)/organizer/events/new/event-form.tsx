"use client";

/**
 * Lane 3 · Sprint 3 — organizer "new event" form.
 *
 * RHF + Zod resolver against `EventFormInput`. The form renders SAR-decimals
 * for budgets (converted to halalas by the server action). Client-side Zod
 * validation is authoritative against the form's own input shape; the server
 * action re-parses through the same schema before touching the DB.
 *
 * VISUAL RESTYLE (Lane 2): moved the raw markup onto shadcn primitives
 * (Card, Input, Label, Select, Textarea, Button). The submission pattern and
 * server action contract (datetime-local strings over FormData) is unchanged.
 */

import { useRef, useTransition } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  EventFormInput,
  type CityOption,
  type EventType,
} from "@/lib/domain/events";
import { MARKET_SEGMENTS } from "@/lib/domain/segments";
import { CityCombobox } from "@/components/supplier/CityCombobox";
import { HelperText } from "@/components/ui-ext/HelperText";
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
  const locale = useLocale();
  const isAr = locale === "ar";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    watch,
  } = useForm<FormValues>({
    mode: "onBlur",
    resolver: async (values) => {
      const candidate = {
        ...values,
        starts_at: toIsoIfPresent(values.starts_at),
        ends_at: toIsoIfPresent(values.ends_at),
        client_name: values.client_name?.trim()
          ? values.client_name.trim()
          : undefined,
        notes: values.notes?.trim() ? values.notes.trim() : undefined,
        guest_count:
          values.guest_count === "" || values.guest_count === undefined
            ? undefined
            : values.guest_count,
        budget_min_sar: values.budget_min_sar?.trim()
          ? values.budget_min_sar.trim()
          : undefined,
        budget_max_sar: values.budget_max_sar?.trim()
          ? values.budget_max_sar.trim()
          : undefined,
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
        // Replace Zod's default messages (which leak raw enum values like
        // "private_occasions"|"business_events"|… into the UI) with stable,
        // localized copy. Path-based mapping with light heuristics for
        // fields that can produce multiple distinct issue shapes.
        const message = friendlyMessage(path, issue, t) ?? issue.message;
        fieldErrors[path] = { type: issue.code, message };
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
        if (err && typeof err === "object" && "digest" in err) {
          throw err;
        }
        alert(err instanceof Error ? err.message : "Failed to create event.");
      }
    });
  };

  const watchedStart = watch("starts_at");
  const watchedEventType = watch("event_type");
  const watchedCity = watch("city");

  // Register hidden controlled fields for Radix Select (doesn't emit form data)
  const eventTypeReg = register("event_type", { required: true });
  const cityReg = register("city", { required: true });

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit(submit)}
      noValidate
      className="flex flex-col gap-6"
    >
      {/* Hidden inputs so FormData picks up the Select values for server action */}
      <input type="hidden" {...eventTypeReg} value={watchedEventType ?? ""} />
      <input type="hidden" {...cityReg} value={watchedCity ?? ""} />

      <Card>
        <CardContent className="flex flex-col gap-5 p-6">
          <FormField
            label={t("eventTypeLabel")}
            htmlFor="event_type_picker"
            error={errors.event_type?.message}
            required
            helper={isAr ? "حدد نوع الفعالية الأقرب لمناسبتك" : null}
          >
            <div
              id="event_type_picker"
              role="radiogroup"
              aria-label={t("eventTypeLabel")}
              aria-invalid={!!errors.event_type}
              className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
            >
              {MARKET_SEGMENTS.map((segment) => {
                const isActive = watchedEventType === segment.slug;
                const label = isAr ? segment.name_ar : segment.name_en;
                return (
                  <button
                    key={segment.slug}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() =>
                      setValue("event_type", segment.slug as EventType, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                    className={cn(
                      "group flex min-h-[56px] items-center gap-3 rounded-lg border px-4 py-3 text-start transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cobalt-500 focus-visible:ring-offset-2",
                      isActive
                        ? "border-brand-cobalt-500 bg-brand-cobalt-100 text-brand-navy-900 shadow-brand-sm"
                        : "border-border bg-card text-foreground hover:border-brand-cobalt-500/30",
                    )}
                  >
                    <span className="text-2xl leading-none" aria-hidden>
                      {segment.icon}
                    </span>
                    <span className="flex-1 text-sm font-semibold">
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </FormField>

          <FormField
            label={t("cityLabel")}
            htmlFor="city_combobox"
            error={errors.city?.message}
            required
            helper={isAr ? "المدينة التي ستُقام فيها الفعالية" : null}
          >
            <CityCombobox
              value={watchedCity || null}
              onChange={(slug) =>
                setValue("city", slug as CityOption, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
              ariaLabel={t("cityLabel")}
            />
          </FormField>

          <FormField
            label={t("clientNameLabel")}
            htmlFor="client_name"
            error={errors.client_name?.message}
          >
            <Input id="client_name" {...register("client_name")} />
          </FormField>

          <FormField
            label={t("venueAddressLabel")}
            htmlFor="venue_address"
            error={errors.venue_address?.message}
            required
          >
            <Textarea
              id="venue_address"
              rows={2}
              {...register("venue_address", { required: true })}
            />
          </FormField>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              label={t("startsAtLabel")}
              htmlFor="starts_at"
              error={errors.starts_at?.message}
              required
            >
              <Input
                id="starts_at"
                type="datetime-local"
                {...register("starts_at", { required: true })}
              />
            </FormField>
            <FormField
              label={t("endsAtLabel")}
              htmlFor="ends_at"
              error={errors.ends_at?.message}
              required
            >
              <Input
                id="ends_at"
                type="datetime-local"
                min={watchedStart || undefined}
                {...register("ends_at", { required: true })}
              />
            </FormField>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <FormField
              label={t("guestCountLabel")}
              htmlFor="guest_count"
              error={errors.guest_count?.message}
            >
              <Input
                id="guest_count"
                type="number"
                min={1}
                {...register("guest_count")}
              />
            </FormField>
            <FormField
              label={t("budgetMinLabel")}
              htmlFor="budget_min_sar"
              error={errors.budget_min_sar?.message}
            >
              <Input
                id="budget_min_sar"
                inputMode="decimal"
                {...register("budget_min_sar")}
              />
            </FormField>
            <FormField
              label={t("budgetMaxLabel")}
              htmlFor="budget_max_sar"
              error={errors.budget_max_sar?.message}
            >
              <Input
                id="budget_max_sar"
                inputMode="decimal"
                {...register("budget_max_sar")}
              />
            </FormField>
          </div>

          <FormField
            label={t("notesLabel")}
            htmlFor="notes"
            error={errors.notes?.message}
          >
            <Textarea id="notes" rows={4} {...register("notes")} />
          </FormField>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3 border-t pt-5">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.push("/organizer/events")}
        >
          {t("cancel")}
        </Button>
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              {t("saving")}
            </>
          ) : (
            t("submit")
          )}
        </Button>
      </div>
    </form>
  );
}

/**
 * Translate a Zod issue into a user-friendly, localized message.
 *
 * Why this exists: Zod's default messages for invalid enum / invalid_value
 * issues include the full set of accepted literal values
 * ("private_occasions"|"business_events"|…). Rendering that in the UI is
 * noisy and untranslated. We map by `path` (fields are unique on this form)
 * with light disambiguation on issue code / existing message for fields
 * that can fail multiple ways (venue_address, ends_at, budget_max_sar).
 *
 * Returns `null` for unmapped paths so the caller falls back to Zod's
 * default message — no silent message-swallowing for fields we forgot.
 */
function friendlyMessage(
  path: string,
  issue: { code: string; message: string },
  t: (key: string) => string,
): string | null {
  switch (path) {
    case "event_type":
      return t("error.eventTypeRequired");
    case "city":
      return t("error.cityRequired");
    case "venue_address":
      return issue.code === "too_big"
        ? t("error.venueAddressTooLong")
        : t("error.venueAddressRequired");
    case "starts_at":
      return t("error.startsAtRequired");
    case "ends_at":
      // superRefine sets a custom message containing the literal "after"
      // for the ends-after-start invariant; everything else on this field
      // is "datetime required" territory.
      return issue.message.includes("after")
        ? t("error.endsAfterStart")
        : t("error.endsAtRequired");
    case "guest_count":
      return t("error.guestCountRange");
    case "budget_min_sar":
      return t("error.budgetNonNegative");
    case "budget_max_sar":
      return issue.message.includes("greater than or equal")
        ? t("error.budgetMaxLessThanMin")
        : t("error.budgetNonNegative");
    case "notes":
      return t("error.notesTooLong");
    default:
      return null;
  }
}

function FormField({
  label,
  htmlFor,
  error,
  required,
  helper,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  helper?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label
        htmlFor={htmlFor}
        className={cn(error && "text-destructive")}
      >
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        ) : null}
      </Label>
      {helper ? <HelperText>{helper}</HelperText> : null}
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
