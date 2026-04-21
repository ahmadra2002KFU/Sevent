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
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              label={t("eventTypeLabel")}
              htmlFor="event_type_select"
              error={errors.event_type?.message}
              required
            >
              <Select
                value={watchedEventType ?? ""}
                onValueChange={(v) =>
                  setValue("event_type", v as EventType, {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger
                  id="event_type_select"
                  className="w-full"
                  aria-invalid={!!errors.event_type}
                >
                  <SelectValue placeholder={t("eventTypeLabel")} />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((et) => (
                    <SelectItem key={et} value={et}>
                      {t(`eventType.${et}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              label={t("cityLabel")}
              htmlFor="city_select"
              error={errors.city?.message}
              required
            >
              <Select
                value={watchedCity ?? ""}
                onValueChange={(v) =>
                  setValue("city", v as CityOption, { shouldValidate: true })
                }
              >
                <SelectTrigger
                  id="city_select"
                  className="w-full"
                  aria-invalid={!!errors.city}
                >
                  <SelectValue placeholder={t("cityLabel")} />
                </SelectTrigger>
                <SelectContent>
                  {CITY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`city.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

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

function FormField({
  label,
  htmlFor,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
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
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
