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

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ar, enUS } from "date-fns/locale";
import {
  CalendarIcon,
  ClipboardList,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  listCategoriesAction,
  type CategoriesBundle,
  type CategoryOption,
} from "../../rfqs/actions";

type BandRow = { subcategory_id: string; notes: string; qty: number };

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

/**
 * Compose a date input ("YYYY-MM-DD") + optional time input ("HH:mm") into an
 * ISO string. When time is missing, the supplied fallback (typically "00:00"
 * for the start, "23:59" for the end) is used so the schema's `.datetime()`
 * check still passes and the underlying timestamp column receives a value.
 */
function ymdFromDate(d: Date | undefined): string {
  if (!d) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dateFromYmd(ymd: string): Date | undefined {
  if (!ymd) return undefined;
  const d = new Date(`${ymd}T00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function composeDateTime(
  date: string,
  time: string,
  fallbackTime: "00:00" | "23:59",
): string {
  if (!date) return "";
  const t = time && /^\d{2}:\d{2}/.test(time) ? time : fallbackTime;
  const d = new Date(`${date}T${t}`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

/**
 * Render a friendly "X days [Y hours]" label. When no times are set we treat
 * the event as whole-day and show days only. When times are set on both sides
 * we show days+hours (or hours alone when the event spans less than a day).
 * Returns null when inputs are incomplete or invalid.
 */
function formatDuration(
  startsDate: string,
  startsTime: string,
  endsDate: string,
  endsTime: string,
  translate: (
    key: "durationDays" | "durationHours" | "durationDaysHours",
    args: { days?: number; hours?: number },
  ) => string,
): string | null {
  if (!startsDate || !endsDate) return null;
  const hasTimes = Boolean(startsTime && endsTime);
  if (hasTimes) {
    const start = new Date(`${startsDate}T${startsTime}`);
    const end = new Date(`${endsDate}T${endsTime}`);
    const diffMs = end.getTime() - start.getTime();
    if (!Number.isFinite(diffMs) || diffMs <= 0) return null;
    const totalHours = Math.round(diffMs / 3_600_000);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    if (days > 0 && hours > 0) {
      return translate("durationDaysHours", { days, hours });
    }
    if (days > 0) return translate("durationDays", { days });
    return translate("durationHours", { hours: Math.max(1, totalHours) });
  }
  const start = new Date(`${startsDate}T00:00`);
  const end = new Date(`${endsDate}T00:00`);
  const diffDays = Math.round(
    (end.getTime() - start.getTime()) / 86_400_000,
  );
  const days = Math.max(1, diffDays + 1);
  return translate("durationDays", { days });
}

export function EventForm() {
  const t = useTranslations("organizer.eventForm");
  const locale = useLocale();
  const isAr = locale === "ar";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement | null>(null);

  // بنود are tracked outside RHF (RHF is awkward with arrays of objects under
  // the existing string-centric FormValues shape). We pipe the array into the
  // Zod resolver candidate manually so EventFormInput's `.min(1)` rule still
  // fires, and serialize as JSON into a hidden input for the server action.
  const [bunood, setBunood] = useState<BandRow[]>([]);
  const [bunoodTouched, setBunoodTouched] = useState(false);
  const [categories, setCategories] = useState<CategoriesBundle | null>(null);
  const [startsDate, setStartsDate] = useState("");
  const [startsTime, setStartsTime] = useState("");
  const [endsDate, setEndsDate] = useState("");
  const [endsTime, setEndsTime] = useState("");

  const startsAtIso = composeDateTime(startsDate, startsTime, "00:00");
  const endsAtIso = composeDateTime(endsDate, endsTime, "23:59");

  useEffect(() => {
    let cancelled = false;
    listCategoriesAction()
      .then((cats) => {
        if (!cancelled) setCategories(cats);
      })
      .catch(() => {
        // listCategoriesAction never rejects today, but guard anyway so a
        // network blip on first render doesn't render an empty placeholder
        // forever.
        if (!cancelled) setCategories({ parents: [], children: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const subcategoryGroups = useMemo(() => {
    if (!categories) return [];
    return categories.parents
      .map((parent) => ({
        parent,
        children: categories.children
          .filter((c) => c.parent_id === parent.id)
          .sort((a, b) => a.sort_order - b.sort_order),
      }))
      .filter((g) => g.children.length > 0);
  }, [categories]);

  const bunoodForServer = useMemo(
    () =>
      bunood.map((b) => ({
        subcategory_id: b.subcategory_id,
        notes: b.notes.trim() ? b.notes.trim() : undefined,
        qty: b.qty,
      })),
    [bunood],
  );
  const bunoodIsValid = bunood.every((b) => b.subcategory_id.length > 0);
  const bunoodEmpty = bunood.length === 0;

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
        // بنود live in component state; thread them through so the schema's
        // `bunood.min(1)` rule contributes to the resolver's error map.
        bunood: bunoodForServer,
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

  const watchedEventType = watch("event_type");
  const watchedCity = watch("city");

  useEffect(() => {
    setValue("starts_at", startsAtIso, { shouldValidate: false });
    setValue("ends_at", endsAtIso, { shouldValidate: false });
  }, [startsAtIso, endsAtIso, setValue]);

  const durationLabel = formatDuration(
    startsDate,
    startsTime,
    endsDate,
    endsTime,
    (key, args) =>
      t(key as "durationDays" | "durationHours" | "durationDaysHours", args),
  );

  // FormValues doesn't list `bunood`, but the resolver's error map can carry
  // a `bunood` key (the schema's `.min(1)` rule). Read it through a cast.
  const bunoodErrorMessage = (
    errors as unknown as Record<string, { message?: string } | undefined>
  ).bunood?.message;

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
      {/* بنود — server action JSON.parses this back into BandInput[]. */}
      <input
        type="hidden"
        name="bunood"
        value={JSON.stringify(bunoodForServer)}
      />

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
            helper={isAr ? "اختياري — يكفي اختيار المدينة أعلاه" : "Optional — choosing the city above is enough"}
          >
            <Textarea
              id="venue_address"
              rows={2}
              {...register("venue_address")}
            />
          </FormField>

          <DateRangeField
            label={t("eventDatesLabel")}
            startsDate={startsDate}
            endsDate={endsDate}
            onChange={(next) => {
              setStartsDate(ymdFromDate(next.from));
              setEndsDate(ymdFromDate(next.to));
            }}
            error={
              errors.starts_at?.message ?? errors.ends_at?.message ?? undefined
            }
            placeholder={t("eventDatesPlaceholder")}
            isAr={isAr}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              label={t("startTimeLabel")}
              htmlFor="starts_time"
            >
              <Input
                id="starts_time"
                type="time"
                value={startsTime}
                onChange={(e) => setStartsTime(e.currentTarget.value)}
              />
            </FormField>
            <FormField
              label={t("endTimeLabel")}
              htmlFor="ends_time"
            >
              <Input
                id="ends_time"
                type="time"
                value={endsTime}
                onChange={(e) => setEndsTime(e.currentTarget.value)}
              />
            </FormField>
          </div>
          <input type="hidden" name="starts_at" value={startsAtIso} />
          <input type="hidden" name="ends_at" value={endsAtIso} />
          {durationLabel ? (
            <div
              className="inline-flex w-fit items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground"
              aria-live="polite"
            >
              <span className="font-medium">{t("durationLabel")}:</span>
              <span>{durationLabel}</span>
            </div>
          ) : null}

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

      <BunoodCard
        bunood={bunood}
        setBunood={(updater) => {
          setBunood(updater);
          setBunoodTouched(true);
        }}
        groups={subcategoryGroups}
        categoriesLoaded={categories !== null}
        locale={isAr ? "ar" : "en"}
        showError={
          (bunoodTouched && bunoodEmpty) || !!bunoodErrorMessage
        }
        errorMessage={bunoodErrorMessage ?? t("bunood.atLeastOneRequired")}
      />

      <div className="flex items-center justify-end gap-3 border-t pt-5">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.push("/organizer/events")}
        >
          {t("cancel")}
        </Button>
        <Button
          type="submit"
          size="lg"
          disabled={isPending || bunoodEmpty || !bunoodIsValid}
        >
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
    case "bunood":
      return t("bunood.atLeastOneRequired");
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

/**
 * Date range trigger — a single field-group control that displays the start
 * and end dates side-by-side and opens a Popover with a `react-day-picker`
 * range calendar on click. Selecting a range writes back to the form's
 * `startsDate` / `endsDate` strings via the `onChange` callback. Time pickers
 * live outside this component so the user can still leave time blank.
 */
function DateRangeField({
  label,
  startsDate,
  endsDate,
  onChange,
  error,
  placeholder,
  isAr,
}: {
  label: string;
  startsDate: string;
  endsDate: string;
  onChange: (range: { from?: Date; to?: Date }) => void;
  error?: string;
  placeholder: string;
  isAr: boolean;
}) {
  const [open, setOpen] = useState(false);
  const range: DateRange = {
    from: dateFromYmd(startsDate),
    to: dateFromYmd(endsDate),
  };
  const localeCode = isAr ? "ar" : "en";
  const fmt = (d: Date | undefined) =>
    d
      ? d.toLocaleDateString(localeCode, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : null;
  const startsLabel = fmt(range.from);
  const endsLabel = fmt(range.to);
  const hasAnyDate = Boolean(startsLabel || endsLabel);

  return (
    <div className="flex flex-col gap-1.5">
      <Label
        htmlFor="event_date_range_trigger"
        className={cn(error && "text-destructive")}
      >
        {label}
        <span className="text-destructive" aria-hidden>
          *
        </span>
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id="event_date_range_trigger"
            type="button"
            aria-label={label}
            aria-invalid={Boolean(error)}
            className={cn(
              "flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cobalt-500 focus-visible:ring-offset-2",
              "hover:border-brand-cobalt-500/40",
              error && "border-destructive ring-1 ring-destructive/30",
            )}
          >
            <CalendarIcon
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span
              className={cn(
                "flex flex-1 items-center gap-2 truncate text-start",
                !hasAnyDate && "text-muted-foreground",
              )}
            >
              {hasAnyDate ? (
                <>
                  <span className="font-medium text-foreground">
                    {startsLabel ?? "—"}
                  </span>
                  <span className="text-muted-foreground" aria-hidden>
                    →
                  </span>
                  <span className="font-medium text-foreground">
                    {endsLabel ?? "—"}
                  </span>
                </>
              ) : (
                <span>{placeholder}</span>
              )}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={range}
            onSelect={(next) => onChange(next ?? {})}
            defaultMonth={range.from ?? new Date()}
            locale={isAr ? ar : enUS}
            disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * بنود table — one row per RFQ to fan out. Subcategory drives the marketplace
 * routing; notes are optional and free-form. Adding a row enables submit; the
 * server action publishes one RFQ per row immediately on save.
 */
function BunoodCard({
  bunood,
  setBunood,
  groups,
  categoriesLoaded,
  locale,
  showError,
  errorMessage,
}: {
  bunood: BandRow[];
  setBunood: (updater: (prev: BandRow[]) => BandRow[]) => void;
  groups: Array<{ parent: CategoryOption; children: CategoryOption[] }>;
  categoriesLoaded: boolean;
  locale: "ar" | "en";
  showError: boolean;
  errorMessage: string;
}) {
  const t = useTranslations("organizer.eventForm.bunood");

  const updateRow = (index: number, patch: Partial<BandRow>) => {
    setBunood((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const removeRow = (index: number) => {
    setBunood((prev) => prev.filter((_, i) => i !== index));
  };

  const addRow = () => {
    setBunood((prev) => [...prev, { subcategory_id: "", notes: "", qty: 1 }]);
  };

  // Single-line row layout: subcategory select | notes input | delete button.
  // Mobile (<sm): stack the three cells vertically. Desktop: 3-column grid
  // with a subcategory column wide enough for KSA category names and a
  // flexible notes column.
  const ROW_GRID =
    "sm:grid sm:grid-cols-[minmax(11rem,15rem)_4.5rem_minmax(0,1fr)_2.5rem] sm:items-center sm:gap-3";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-lg">{t("tableTitle")}</CardTitle>
        <HelperText>{t("tableDescription")}</HelperText>
      </CardHeader>

      {showError ? (
        <div
          role="alert"
          className="border-b bg-destructive/5 px-6 py-2.5 text-sm text-destructive"
        >
          {errorMessage}
        </div>
      ) : null}

      {bunood.length === 0 ? (
        <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-brand-cobalt-100 text-brand-cobalt-500">
            <ClipboardList className="size-6" aria-hidden />
          </span>
          <p className="text-sm font-medium text-foreground">
            {t("emptyHint")}
          </p>
        </CardContent>
      ) : (
        // Scroll container holds BOTH the sticky header and the list, so the
        // header stays pinned while rows scroll. Capped to roughly 3 rows
        // visible — adding a 4th بند triggers the scrollbar.
        <div className="max-h-[220px] overflow-y-auto sm:max-h-[260px]">
          {/* Sticky column header — visible only at sm+, since rows stack on mobile */}
          <div
            className={cn(
              "sticky top-0 z-10 hidden border-b bg-muted/40 px-6 py-2.5 backdrop-blur-sm sm:block",
              ROW_GRID,
            )}
          >
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("subcategoryLabel")}
              <span className="text-destructive" aria-hidden>
                {" "}
                *
              </span>
            </span>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("qtyLabel")}
            </span>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("notesLabel")}
            </span>
            <span className="sr-only">{t("removeBand")}</span>
          </div>

          <ul className="flex flex-col divide-y">
            {bunood.map((row, idx) => (
              <li
                key={idx}
                className={cn(
                  "flex flex-col gap-2 px-6 py-3 transition-colors hover:bg-muted/30",
                  ROW_GRID,
                )}
              >
                <div className="flex flex-col gap-1.5 sm:gap-0">
                  <Label
                    htmlFor={`band_subcategory_${idx}`}
                    className="text-xs text-muted-foreground sm:hidden"
                  >
                    {t("subcategoryLabel")}
                    <span className="text-destructive" aria-hidden>
                      {" "}
                      *
                    </span>
                  </Label>
                  <Select
                    value={row.subcategory_id || undefined}
                    onValueChange={(v) =>
                      updateRow(idx, { subcategory_id: v })
                    }
                    disabled={!categoriesLoaded}
                  >
                    <SelectTrigger
                      id={`band_subcategory_${idx}`}
                      aria-label={t("subcategoryLabel")}
                      className="h-10 w-full"
                    >
                      <SelectValue
                        placeholder={
                          categoriesLoaded
                            ? t("subcategoryPlaceholder")
                            : t("loadingCategories")
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((group) => (
                        <SelectGroup key={group.parent.id}>
                          <SelectLabel className="px-2 py-1.5 text-xs font-semibold text-foreground">
                            {locale === "ar"
                              ? group.parent.name_ar
                              : group.parent.name_en}
                          </SelectLabel>
                          {group.children.map((child) => (
                            <SelectItem key={child.id} value={child.id}>
                              {locale === "ar" ? child.name_ar : child.name_en}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5 sm:gap-0">
                  <Label
                    htmlFor={`band_qty_${idx}`}
                    className="text-xs text-muted-foreground sm:hidden"
                  >
                    {t("qtyLabel")}
                  </Label>
                  <Input
                    id={`band_qty_${idx}`}
                    type="number"
                    min={1}
                    max={999}
                    value={row.qty}
                    onChange={(e) =>
                      updateRow(idx, {
                        qty: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    aria-label={t("qtyLabel")}
                    className="h-10"
                  />
                </div>

                <div className="flex flex-col gap-1.5 sm:gap-0">
                  <Label
                    htmlFor={`band_notes_${idx}`}
                    className="text-xs text-muted-foreground sm:hidden"
                  >
                    {t("notesLabel")}
                  </Label>
                  <Input
                    id={`band_notes_${idx}`}
                    value={row.notes}
                    onChange={(e) =>
                      updateRow(idx, { notes: e.target.value })
                    }
                    placeholder={t("notesPlaceholder")}
                    aria-label={t("notesPlaceholder")}
                    maxLength={2000}
                    className="h-10"
                  />
                </div>

                <div className="flex justify-end sm:justify-center">
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    aria-label={t("removeBand")}
                    title={t("removeBand")}
                    className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
                  >
                    <Trash2 className="size-4" aria-hidden />
                    <span className="sr-only">{t("removeBand")}</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer — always visible, even when the list scrolls. */}
      <div className="flex items-center justify-between gap-3 border-t bg-muted/20 px-6 py-3">
        <span className="text-xs text-muted-foreground">
          {bunood.length === 0 ? t("atLeastOneRequired") : null}
        </span>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={addRow}
          disabled={!categoriesLoaded}
        >
          <Plus className="size-4" aria-hidden />
          {t("addBand")}
        </Button>
      </div>
    </Card>
  );
}
