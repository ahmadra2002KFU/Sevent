"use client";

/**
 * Supplier onboarding wizard — 2026-04-21 rebuild.
 *
 * Shape:
 *   Pre-step (inline gate at top of Step 1): Person vs Company soft picker.
 *   Step 1 — business info: business_name, bio, base_city, service_area, languages.
 *   Step 2 — categories + segments.
 *   Step 3 — documents + profile assets (logo, IBAN cert, company profile).
 *
 * Every FormLabel gets a sibling <HelperText> whose key is
 * `helper.<fieldName>`. HelperText auto-hides in English, so the helper
 * strings are only read in Arabic locale (boss's low-literacy note).
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Controller, useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import {
  Building2,
  Check,
  FileText,
  Image as ImageIcon,
  Plus,
  Trash2,
  Upload,
  UploadCloud,
  User,
  X,
} from "lucide-react";
import {
  LANGUAGES,
  LOGO_MAX_BYTES,
  OnboardingStep1 as OnboardingStep1Schema,
  PDF_MAX_BYTES,
} from "@/lib/domain/onboarding";
import type { MarketSegmentSlug } from "@/lib/domain/segments";
import {
  submitOnboardingStep1,
  submitOnboardingStep2,
  submitOnboardingStep3,
  type OnboardingState,
} from "./actions";
import type { OnboardingBootstrap } from "./loader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { HelperText } from "@/components/ui-ext/HelperText";
import { CityCombobox } from "@/components/supplier/CityCombobox";
import { SegmentsPicker } from "@/components/supplier/SegmentsPicker";
import { cityNameFor } from "@/lib/domain/cities";
import { SubcategoryCombobox } from "@/app/(supplier)/supplier/catalog/SubcategoryCombobox";
import type { CatalogSubcategory } from "@/app/(supplier)/supplier/catalog/loader";

type WizardProps = { bootstrap: OnboardingBootstrap };
type Step = 1 | 2 | 3;

export function OnboardingWizard({ bootstrap }: WizardProps) {
  const t = useTranslations("supplier.onboarding");
  const router = useRouter();
  const [step, setStep] = useState<Step>(() => resolveInitialStep(bootstrap));
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(
    bootstrap.supplier?.id ?? null,
  );
  const [isPending, startTransition] = useTransition();

  // Build the CatalogSubcategory shape SubcategoryCombobox expects. The
  // bootstrap loader returns a flat categories list; we denormalise parent
  // names onto each child for the grouped-combobox header.
  const subcategoryOptions: CatalogSubcategory[] = useMemo(() => {
    const parents = new Map<
      string,
      { slug: string; name_en: string; name_ar: string | null }
    >();
    for (const c of bootstrap.categories) {
      if (c.parent_id === null) {
        parents.set(c.id, {
          slug: c.slug,
          name_en: c.name_en,
          name_ar: c.name_ar ?? null,
        });
      }
    }
    return bootstrap.categories
      .filter((c) => c.parent_id !== null)
      .map((c) => {
        const parent = c.parent_id ? parents.get(c.parent_id) ?? null : null;
        return {
          id: c.id,
          slug: c.slug,
          name_en: c.name_en,
          name_ar: c.name_ar,
          parent_id: c.parent_id,
          parent_slug: parent?.slug ?? null,
          parent_name_en: parent?.name_en ?? null,
          parent_name_ar: parent?.name_ar ?? null,
        };
      });
  }, [bootstrap.categories]);

  const handleStepResult = (result: OnboardingState, nextStep?: Step) => {
    if (!result.ok) {
      setServerMessage(result.message ?? t("genericError"));
      return false;
    }
    setServerMessage(null);
    if (result.supplierId) setSupplierId(result.supplierId);
    if (nextStep) setStep(nextStep);
    return true;
  };

  const progressPct = Math.round(((step - 0.5) / 3) * 100);

  return (
    <div className="flex flex-col gap-6">
      <ProgressBar
        percent={progressPct}
        label={t("progressLabel", { percent: progressPct })}
      />

      <Stepper current={step} t={t} />

      <Card>
        <CardContent className="p-6">
          {step === 1 ? (
            <Step1Form
              initial={bootstrap.supplier}
              pending={isPending}
              onSubmit={(values) => {
                const fd = new FormData();
                fd.append("business_name", values.business_name);
                fd.append("legal_type", values.legal_type);
                if (values.cr_number) fd.append("cr_number", values.cr_number);
                if (values.national_id) fd.append("national_id", values.national_id);
                if (values.bio) fd.append("bio", values.bio);
                fd.append("base_city", values.base_city);
                for (const city of values.service_area_cities) {
                  fd.append("service_area_cities", city);
                }
                for (const lang of values.languages) fd.append("languages", lang);
                startTransition(async () => {
                  const result = await submitOnboardingStep1(undefined, fd);
                  handleStepResult(result, 2);
                });
              }}
            />
          ) : null}

          {step === 2 ? (
            <Step2Form
              subcategoryOptions={subcategoryOptions}
              initialSubcategoryIds={bootstrap.subcategoryIds}
              initialSegments={
                (bootstrap.supplier?.works_with_segments ?? []) as MarketSegmentSlug[]
              }
              pending={isPending}
              disabled={!supplierId}
              onBack={() => setStep(1)}
              onSubmit={(fd) => {
                startTransition(async () => {
                  const result = await submitOnboardingStep2(undefined, fd);
                  handleStepResult(result, 3);
                });
              }}
            />
          ) : null}

          {step === 3 ? (
            <Step3Form
              initialLogoPath={bootstrap.supplier?.logo_path ?? null}
              pending={isPending}
              disabled={!supplierId}
              onBack={() => setStep(2)}
              onSubmit={(fd) => {
                startTransition(async () => {
                  const result = await submitOnboardingStep3(undefined, fd);
                  if (result.ok) {
                    setServerMessage(t("submittedForReview"));
                    router.push("/supplier/dashboard?submitted=1");
                    router.refresh();
                  } else {
                    setServerMessage(result.message ?? t("genericError"));
                  }
                });
              }}
            />
          ) : null}

          {serverMessage ? (
            <Alert className="mt-4">
              <AlertDescription>{serverMessage}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function resolveInitialStep(bootstrap: OnboardingBootstrap): Step {
  if (!bootstrap.supplier) return 1;
  if (bootstrap.subcategoryIds.length === 0) return 2;
  const hasIban = bootstrap.docs.some((d) => d.doc_type === "iban_certificate");
  if (!hasIban) return 3;
  return 3;
}

// ---------------------------------------------------------------------------
// Stepper + progress
// ---------------------------------------------------------------------------

function Stepper({
  current,
  t,
}: {
  current: Step;
  t: ReturnType<typeof useTranslations>;
}) {
  const steps: Array<{ id: Step; label: string }> = [
    { id: 1, label: t("step1Heading") },
    { id: 2, label: t("step2Heading") },
    { id: 3, label: t("step3Heading") },
  ];
  return (
    <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {steps.map((s) => {
        const done = current > s.id;
        const active = current === s.id;
        return (
          <li
            key={s.id}
            className={cn(
              "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors",
              active
                ? "border-brand-cobalt-500 bg-brand-cobalt-100/50"
                : done
                  ? "border-semantic-success-100 bg-semantic-success-100/40"
                  : "border-border bg-card",
            )}
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                active
                  ? "bg-brand-cobalt-500 text-white"
                  : done
                    ? "bg-semantic-success-500 text-white"
                    : "bg-neutral-200 text-neutral-600",
              )}
            >
              {done ? <Check className="size-4" aria-hidden /> : s.id}
            </span>
            <span
              className={cn(
                "flex flex-col",
                active
                  ? "text-brand-navy-900 font-medium"
                  : "text-muted-foreground",
              )}
            >
              <span className="text-xs uppercase tracking-wide">
                {t("stepOfTotal", { current: s.id, total: 3 })}
              </span>
              <span>{s.label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ProgressBar({ percent, label }: { percent: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={label}
      className="flex flex-col gap-2"
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums font-medium text-brand-navy-900">{clamped}%</span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
        <div
          className="absolute inset-y-0 start-0 rounded-full bg-gradient-to-r from-brand-cobalt-500 to-brand-navy-900 transition-[width] duration-500 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — person/company pre-step + business info
// ---------------------------------------------------------------------------

type Step1Values = {
  business_name: string;
  legal_type: "company" | "freelancer" | "foreign";
  cr_number?: string;
  national_id?: string;
  bio?: string;
  base_city: string;
  service_area_cities: string[];
  languages: Array<(typeof LANGUAGES)[number]>;
};

function Step1Form({
  initial,
  pending,
  onSubmit,
}: {
  initial: OnboardingBootstrap["supplier"];
  pending: boolean;
  onSubmit: SubmitHandler<Step1Values>;
}) {
  const t = useTranslations("supplier.onboarding");
  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    formState: { errors },
  } = useForm<Step1Values>({
    // Cast: Zod's inferred output marks defaulted fields as optional (`| undefined`),
    // but react-hook-form's Resolver wants them required because our defaults
    // always populate them. Safe because we always pass full defaults below.
    resolver: zodResolver(OnboardingStep1Schema) as unknown as import("react-hook-form").Resolver<Step1Values>,
    defaultValues: {
      business_name: initial?.business_name ?? "",
      legal_type:
        (initial?.legal_type as Step1Values["legal_type"]) ?? "company",
      cr_number: initial?.cr_number ?? "",
      national_id: initial?.national_id ?? "",
      bio: initial?.bio ?? "",
      base_city: initial?.base_city ?? "",
      service_area_cities: (initial?.service_area_cities ?? []) as string[],
      languages: ((initial?.languages as Step1Values["languages"]) ?? ["ar"]).filter(
        (l) => (LANGUAGES as readonly string[]).includes(l),
      ) as Step1Values["languages"],
    },
  });

  const legalType = watch("legal_type");
  const baseCity = watch("base_city");
  const serviceAreas = watch("service_area_cities") ?? [];
  const languagesSelected = watch("languages") ?? [];

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* Person vs Company — soft UI guidance only; flips legal_type. */}
      <PersonCompanyPicker
        value={legalType}
        onChange={(v) => setValue("legal_type", v, { shouldDirty: true })}
      />

      <Field
        label={t("businessNameLabel")}
        helperKey="helper.businessName"
        error={errors.business_name?.message}
      >
        <Input {...register("business_name")} placeholder={t("placeholder.businessName")} />
      </Field>

      {legalType === "company" ? (
        <Field
          label={t("crNumberLabel")}
          helperKey="helper.crNumber"
          error={errors.cr_number?.message}
        >
          <Input {...register("cr_number")} />
        </Field>
      ) : null}
      {legalType === "freelancer" ? (
        <Field
          label={t("nationalIdLabel")}
          helperKey="helper.nationalId"
          error={errors.national_id?.message}
        >
          <Input {...register("national_id")} />
        </Field>
      ) : null}

      <Field
        label={t("bioLabel")}
        helperKey="helper.bio"
        error={errors.bio?.message}
      >
        <Textarea
          {...register("bio")}
          rows={4}
          placeholder={t("placeholder.bio")}
        />
      </Field>

      <Field
        label={t("baseCityLabel")}
        helperKey="helper.baseCity"
        error={errors.base_city?.message}
      >
        <Controller
          control={control}
          name="base_city"
          render={({ field }) => (
            <CityCombobox
              value={field.value}
              onChange={field.onChange}
              placeholder={t("baseCityPlaceholder")}
              ariaLabel={t("baseCityLabel")}
            />
          )}
        />
      </Field>

      <Field label={t("serviceAreaLabel")} helperKey="helper.serviceArea">
        <Controller
          control={control}
          name="service_area_cities"
          render={({ field }) => (
            <ServiceAreaPicker
              excludeSlug={baseCity}
              value={field.value ?? []}
              onChange={field.onChange}
            />
          )}
        />
        {serviceAreas.length > 15 ? (
          <p className="text-xs text-semantic-danger-500">
            {t("serviceAreaTooMany")}
          </p>
        ) : null}
      </Field>

      <Field label={t("languagesLabel")} helperKey="helper.languages">
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((lang) => {
            const active = (languagesSelected as readonly string[]).includes(lang);
            return (
              <label key={lang} className="group relative cursor-pointer select-none">
                <input
                  type="checkbox"
                  value={lang}
                  className="peer sr-only"
                  {...register("languages", { validate: (v) => v.length > 0 })}
                />
                <span
                  className={cn(
                    "inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-all",
                    "border-neutral-200 bg-neutral-50 text-neutral-900",
                    "hover:border-brand-cobalt-500 hover:bg-brand-cobalt-100/40",
                    "peer-checked:border-brand-cobalt-500 peer-checked:bg-brand-cobalt-100 peer-checked:text-brand-cobalt-500 peer-checked:font-medium",
                    "peer-focus-visible:ring-2 peer-focus-visible:ring-brand-cobalt-500 peer-focus-visible:ring-offset-2",
                  )}
                >
                  <Check
                    className={cn(
                      "size-3.5 transition-all",
                      active ? "opacity-100 scale-100" : "opacity-0 scale-75 -ms-1",
                    )}
                    aria-hidden
                  />
                  {t(`language.${lang}`)}
                </span>
              </label>
            );
          })}
        </div>
      </Field>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? t("saving") : t("continue")}
        </Button>
      </div>
    </form>
  );
}

function PersonCompanyPicker({
  value,
  onChange,
}: {
  value: "company" | "freelancer" | "foreign";
  onChange: (v: "company" | "freelancer") => void;
}) {
  const t = useTranslations("supplier.onboarding");
  const tiles: Array<{
    value: "company" | "freelancer";
    Icon: typeof User;
    title: string;
    subtitle: string;
  }> = [
    {
      value: "freelancer",
      Icon: User,
      title: t("personCompany.person.title"),
      subtitle: t("personCompany.person.subtitle"),
    },
    {
      value: "company",
      Icon: Building2,
      title: t("personCompany.company.title"),
      subtitle: t("personCompany.company.subtitle"),
    },
  ];
  // Soft guidance copy shown above the tiles (Arabic-only via HelperText).
  return (
    <div className="flex flex-col gap-2">
      <Label className="flex flex-col items-start gap-1.5 text-sm">
        <span className="font-medium text-foreground">
          {t("personCompany.label")}
        </span>
        <HelperText>{t("helper.personCompany")}</HelperText>
      </Label>
      <div className="grid gap-3 sm:grid-cols-2">
        {tiles.map((tile) => {
          const active = value === tile.value;
          return (
            <button
              key={tile.value}
              type="button"
              onClick={() => onChange(tile.value)}
              aria-pressed={active}
              className={cn(
                "group flex min-h-[120px] items-start gap-4 rounded-2xl border p-5 text-start transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cobalt-500 focus-visible:ring-offset-2",
                active
                  ? "border-brand-cobalt-500 bg-brand-cobalt-100 shadow-brand-sm"
                  : "border-border bg-card hover:border-brand-cobalt-500/40",
              )}
            >
              <span
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-xl",
                  active
                    ? "bg-brand-cobalt-500 text-white"
                    : "bg-brand-cobalt-100 text-brand-cobalt-500",
                )}
              >
                <tile.Icon className="size-6" aria-hidden />
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-base font-semibold text-brand-navy-900">
                  {tile.title}
                </span>
                <span className="text-xs leading-relaxed text-muted-foreground">
                  {tile.subtitle}
                </span>
              </span>
              <span
                className={cn(
                  "ms-auto inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                  active
                    ? "border-brand-cobalt-500 bg-brand-cobalt-500 text-white"
                    : "border-border text-transparent",
                )}
                aria-hidden
              >
                ✓
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ServiceAreaPicker({
  value,
  excludeSlug,
  onChange,
}: {
  value: string[];
  excludeSlug: string;
  onChange: (next: string[]) => void;
}) {
  const t = useTranslations("supplier.onboarding");
  const locale = useLocale() as "en" | "ar";
  // A CityCombobox keyed on a per-pick nonce so it resets after each selection.
  // Users see: chips of picked cities + an "Add city" combobox underneath.
  const [nonce, setNonce] = useState(0);
  const [pending, setPending] = useState<string>("");

  function appendCity(slug: string) {
    if (!slug) return;
    if (slug === excludeSlug) return; // base city should not double up
    if (value.includes(slug)) return;
    if (value.length >= 15) return;
    onChange([...value, slug]);
    setPending("");
    setNonce((n) => n + 1);
  }

  function removeCity(slug: string) {
    onChange(value.filter((s) => s !== slug));
  }

  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((slug) => (
            <li key={slug}>
              <button
                type="button"
                onClick={() => removeCity(slug)}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-brand-cobalt-500/40 bg-brand-cobalt-100 px-3 py-1 text-sm text-brand-navy-900 transition-colors hover:bg-brand-cobalt-100/80"
                aria-label={t("serviceAreaRemove", {
                  city: cityNameFor(slug, locale),
                })}
              >
                <span>{cityNameFor(slug, locale)}</span>
                <X className="size-3.5 opacity-70" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs italic text-muted-foreground">
          {t("serviceAreaEmpty")}
        </p>
      )}
      {value.length < 15 ? (
        <CityCombobox
          key={nonce}
          value={pending}
          onChange={(slug) => appendCity(slug)}
          placeholder={t("serviceAreaAdd")}
          ariaLabel={t("serviceAreaAdd")}
        />
      ) : (
        <p className="text-xs text-muted-foreground">{t("serviceAreaMaxReached")}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — categories + segments
// ---------------------------------------------------------------------------

function Step2Form({
  subcategoryOptions,
  initialSubcategoryIds,
  initialSegments,
  pending,
  disabled,
  onBack,
  onSubmit,
}: {
  subcategoryOptions: CatalogSubcategory[];
  initialSubcategoryIds: string[];
  initialSegments: MarketSegmentSlug[];
  pending: boolean;
  disabled: boolean;
  onBack: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  const t = useTranslations("supplier.onboarding");
  const locale = useLocale();
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSubcategoryIds);
  const [segments, setSegments] =
    useState<MarketSegmentSlug[]>(initialSegments);
  const [pendingPick, setPendingPick] = useState("");
  const [pickerNonce, setPickerNonce] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const selectedEntries = useMemo(
    () =>
      selectedIds
        .map((id) => subcategoryOptions.find((s) => s.id === id))
        .filter((x): x is CatalogSubcategory => !!x),
    [selectedIds, subcategoryOptions],
  );

  function addSub(id: string) {
    if (!id || selectedIds.includes(id)) return;
    setSelectedIds((prev) => [...prev, id]);
    setPendingPick("");
    setPickerNonce((n) => n + 1);
  }
  function removeSub(id: string) {
    setSelectedIds((prev) => prev.filter((v) => v !== id));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (selectedIds.length === 0) {
      setError(t("step2RequireCategory"));
      return;
    }
    if (segments.length === 0) {
      setError(t("step2RequireSegment"));
      return;
    }
    setError(null);
    const fd = new FormData();
    for (const id of selectedIds) fd.append("subcategory_ids", id);
    for (const s of segments) fd.append("works_with_segments", s);
    onSubmit(fd);
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
      <Field label={t("categoriesLabel")} helperKey="helper.categories">
        {selectedEntries.length > 0 ? (
          <ul className="mb-2 flex flex-col gap-1.5">
            {selectedEntries.map((entry) => {
              const parent =
                locale === "ar" && entry.parent_name_ar
                  ? entry.parent_name_ar
                  : entry.parent_name_en;
              const child =
                locale === "ar" && entry.name_ar ? entry.name_ar : entry.name_en;
              return (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-brand-cobalt-500/30 bg-brand-cobalt-100/40 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">
                    {parent ? (
                      <span className="text-muted-foreground">{parent} · </span>
                    ) : null}
                    <span className="font-medium text-brand-navy-900">{child}</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => removeSub(entry.id)}
                    aria-label={t("categoryRemove", { name: child })}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : null}
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <SubcategoryCombobox
              key={pickerNonce}
              subcategories={subcategoryOptions.filter(
                (s) => !selectedIds.includes(s.id),
              )}
              value={pendingPick}
              onChange={addSub}
              placeholder={t("categoryPickerPlaceholder")}
              ariaLabel={t("categoryPickerPlaceholder")}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPickerNonce((n) => n + 1)}
            aria-hidden
            className="pointer-events-none opacity-60"
          >
            <Plus className="size-4" aria-hidden />
          </Button>
        </div>
      </Field>

      <Field label={t("segmentsLabel")} helperKey="helper.segments">
        <SegmentsPicker
          value={segments}
          onChange={setSegments}
          ariaLabel={t("segmentsLabel")}
        />
      </Field>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onBack}>
          {t("back")}
        </Button>
        <Button type="submit" size="lg" disabled={pending || disabled}>
          {pending ? t("saving") : t("continue")}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — documents + profile assets
// ---------------------------------------------------------------------------

type Step3Values = {
  logo?: File;
  iban?: File;
  companyProfile?: File;
};

function Step3Form({
  initialLogoPath,
  pending,
  disabled,
  onBack,
  onSubmit,
}: {
  initialLogoPath: string | null;
  pending: boolean;
  disabled: boolean;
  onBack: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  const t = useTranslations("supplier.onboarding");
  const [values, setValues] = useState<Step3Values>({});
  const [error, setError] = useState<string | null>(null);

  // Live preview of chosen logo via blob URL, revoked on change/unmount.
  const logoPreview = useLogoPreview(values.logo);

  function pickFile<K extends keyof Step3Values>(
    key: K,
    file: File | undefined,
    validation: (f: File) => string | null,
  ) {
    if (!file) {
      setValues((prev) => ({ ...prev, [key]: undefined }));
      return;
    }
    const message = validation(file);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setValues((prev) => ({ ...prev, [key]: file }));
  }

  function validateLogo(file: File): string | null {
    if (!/^image\//.test(file.type)) return t("logo.errorType");
    if (file.size > LOGO_MAX_BYTES) return t("logo.errorSize");
    return null;
  }
  function validatePdf(file: File, errorType: string, errorSize: string): string | null {
    if (file.type && file.type !== "application/pdf") return errorType;
    if (file.size > PDF_MAX_BYTES) return errorSize;
    return null;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!values.iban) {
      setError(t("iban.required"));
      return;
    }
    setError(null);
    const fd = new FormData();
    if (values.logo) fd.append("logo_file", values.logo);
    fd.append("iban_file", values.iban);
    if (values.companyProfile) fd.append("company_profile_file", values.companyProfile);
    onSubmit(fd);
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
      <Field label={t("logo.label")} helperKey="helper.logo">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/40",
              logoPreview && "border-solid",
            )}
            aria-hidden
          >
            {logoPreview ? (
              // Using <Image> with unoptimized blob URL; logo stays in local memory only.
              <Image
                src={logoPreview}
                alt=""
                width={80}
                height={80}
                unoptimized
                className="size-full object-cover"
              />
            ) : initialLogoPath ? (
              <ImageIcon className="size-7 text-muted-foreground" aria-hidden />
            ) : (
              <ImageIcon className="size-7 text-muted-foreground" aria-hidden />
            )}
          </div>
          <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm transition-colors hover:border-brand-cobalt-500 hover:bg-brand-cobalt-100/30">
            <UploadCloud className="size-4 shrink-0 text-brand-cobalt-500" aria-hidden />
            <span className="flex-1 truncate text-muted-foreground">
              {values.logo
                ? `${values.logo.name} (${Math.round(values.logo.size / 1024)} KB)`
                : t("logo.cta")}
            </span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) =>
                pickFile("logo", e.target.files?.[0] ?? undefined, validateLogo)
              }
            />
          </label>
        </div>
      </Field>

      <Field label={t("iban.label")} helperKey="helper.iban">
        <FileDropzone
          label={t("iban.cta")}
          file={values.iban}
          accept="application/pdf"
          onSelect={(f) =>
            pickFile("iban", f, (file) =>
              validatePdf(file, t("iban.errorType"), t("iban.errorSize")),
            )
          }
        />
      </Field>

      <Field label={t("companyProfile.label")} helperKey="helper.companyProfile">
        <FileDropzone
          label={t("companyProfile.cta")}
          file={values.companyProfile}
          accept="application/pdf"
          onSelect={(f) =>
            pickFile("companyProfile", f, (file) =>
              validatePdf(
                file,
                t("companyProfile.errorType"),
                t("companyProfile.errorSize"),
              ),
            )
          }
        />
      </Field>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onBack}>
          {t("back")}
        </Button>
        <Button type="submit" size="lg" disabled={pending || disabled}>
          {pending ? t("uploading") : t("submit")}
        </Button>
      </div>
    </form>
  );
}

function useLogoPreview(file: File | undefined): string | null {
  // Compute the object URL synchronously off the file identity. The effect
  // below is pure cleanup — it only revokes the URL when the file changes,
  // never calls setState, so we avoid the cascading-render lint rule.
  const url = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);
  return url;
}

function FileDropzone({
  label,
  file,
  accept,
  onSelect,
}: {
  label: string;
  file: File | undefined;
  accept: string;
  onSelect: (file: File | undefined) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm transition-colors hover:border-brand-cobalt-500 hover:bg-brand-cobalt-100/30">
      {file ? (
        <FileText className="size-4 shrink-0 text-brand-cobalt-500" aria-hidden />
      ) : (
        <Upload className="size-4 shrink-0 text-brand-cobalt-500" aria-hidden />
      )}
      <span className="flex-1 truncate text-muted-foreground">
        {file
          ? `${file.name} (${Math.round(file.size / 1024)} KB)`
          : label}
      </span>
      <input
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => onSelect(e.target.files?.[0] ?? undefined)}
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Shared Field primitive — FormLabel + HelperText + error slot.
// ---------------------------------------------------------------------------

function Field({
  label,
  helperKey,
  error,
  children,
}: {
  label: string;
  helperKey?: string;
  error?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("supplier.onboarding");
  return (
    <Label className="flex flex-col items-start gap-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      {helperKey ? <HelperText>{t(helperKey)}</HelperText> : null}
      {children}
      {error ? (
        <span className="text-xs text-semantic-danger-500">{error}</span>
      ) : null}
    </Label>
  );
}
