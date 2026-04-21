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
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
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
  const locale = useLocale();
  const rtl = locale === "ar";
  const router = useRouter();
  const [step, setStep] = useState<Step>(() => resolveInitialStep(bootstrap));
  const [direction, setDirection] = useState<1 | -1>(1);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(
    bootstrap.supplier?.id ?? null,
  );
  const [isPending, startTransition] = useTransition();

  const goToStep = (next: Step) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

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
    if (nextStep) goToStep(nextStep);
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

      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <AnimatePresence mode="wait" custom={rtl ? -direction : direction}>
            <motion.div
              key={step}
              custom={rtl ? -direction : direction}
              variants={{
                enter: (dir: number) => ({
                  x: dir * 48,
                  opacity: 0,
                  filter: "blur(6px)",
                }),
                center: {
                  x: 0,
                  opacity: 1,
                  filter: "blur(0px)",
                },
                exit: (dir: number) => ({
                  x: dir * -48,
                  opacity: 0,
                  filter: "blur(6px)",
                }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 260, damping: 28, mass: 0.8 },
                opacity: { duration: 0.22, ease: [0.32, 0.72, 0, 1] },
                filter: { duration: 0.22, ease: [0.32, 0.72, 0, 1] },
              }}
            >
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
                  onBack={() => goToStep(1)}
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
                  onBack={() => goToStep(2)}
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
            </motion.div>
          </AnimatePresence>

          <AnimatePresence>
            {serverMessage ? (
              <motion.div
                key="server-message"
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                className="overflow-hidden"
              >
                <Alert className="mt-4">
                  <AlertDescription>{serverMessage}</AlertDescription>
                </Alert>
              </motion.div>
            ) : null}
          </AnimatePresence>
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
    <LayoutGroup id="stepper">
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {steps.map((s) => {
          const done = current > s.id;
          const active = current === s.id;
          return (
            <motion.li
              key={s.id}
              layout
              animate={{
                borderColor: active
                  ? "rgb(30 123 216)"
                  : done
                    ? "rgb(216 241 227)"
                    : "rgb(231 230 223)",
                backgroundColor: active
                  ? "rgba(220 235 251 / 0.5)"
                  : done
                    ? "rgba(216 241 227 / 0.4)"
                    : "rgb(255 255 255)",
              }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              className="relative flex items-center gap-3 overflow-hidden rounded-lg border px-4 py-3 text-sm"
            >
              {active ? (
                <motion.span
                  layoutId="stepper-active-glow"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-cobalt-100/60 via-transparent to-transparent"
                  aria-hidden
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              ) : null}
              <motion.span
                animate={{
                  scale: active ? 1.1 : 1,
                  backgroundColor: active
                    ? "rgb(30 123 216)"
                    : done
                      ? "rgb(30 154 91)"
                      : "rgb(231 230 223)",
                  color: active || done ? "rgb(255 255 255)" : "rgb(107 107 100)",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className="relative flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {done ? (
                    <motion.span
                      key="check"
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0, rotate: 90 }}
                      transition={{ type: "spring", stiffness: 500, damping: 24 }}
                      className="inline-flex"
                    >
                      <Check className="size-4" aria-hidden />
                    </motion.span>
                  ) : (
                    <motion.span
                      key={`n-${s.id}`}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 24 }}
                    >
                      {s.id}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.span>
              <span
                className={cn(
                  "relative flex flex-col",
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
            </motion.li>
          );
        })}
      </ol>
    </LayoutGroup>
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
        <motion.div
          className="absolute inset-y-0 start-0 rounded-full bg-gradient-to-r from-brand-cobalt-500 to-brand-navy-900"
          initial={false}
          animate={{ width: `${clamped}%` }}
          transition={{ type: "spring", stiffness: 140, damping: 22, mass: 0.8 }}
        />
        <motion.div
          className="pointer-events-none absolute inset-y-0 start-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-white/40 to-transparent"
          animate={{ x: ["-100%", "400%"] }}
          transition={{
            duration: 2.4,
            ease: "easeInOut",
            repeat: Infinity,
            repeatDelay: 1.2,
          }}
          aria-hidden
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
              <motion.label
                key={lang}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.94 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className="group relative cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  value={lang}
                  className="peer sr-only"
                  {...register("languages", { validate: (v) => v.length > 0 })}
                />
                <span
                  className={cn(
                    "inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-colors",
                    "border-neutral-200 bg-neutral-50 text-neutral-900",
                    "hover:border-brand-cobalt-500 hover:bg-brand-cobalt-100/40",
                    "peer-checked:border-brand-cobalt-500 peer-checked:bg-brand-cobalt-100 peer-checked:text-brand-cobalt-500 peer-checked:font-medium",
                    "peer-focus-visible:ring-2 peer-focus-visible:ring-brand-cobalt-500 peer-focus-visible:ring-offset-2",
                  )}
                >
                  <motion.span
                    animate={{
                      width: active ? 14 : 0,
                      opacity: active ? 1 : 0,
                      marginInlineEnd: active ? 0 : -4,
                    }}
                    transition={{ type: "spring", stiffness: 420, damping: 26 }}
                    className="inline-flex items-center overflow-hidden"
                  >
                    <Check className="size-3.5" aria-hidden />
                  </motion.span>
                  {t(`language.${lang}`)}
                </span>
              </motion.label>
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
      <LayoutGroup id="person-company">
        <div className="grid gap-3 sm:grid-cols-2">
          {tiles.map((tile) => {
            const active = value === tile.value;
            return (
              <motion.button
                key={tile.value}
                type="button"
                onClick={() => onChange(tile.value)}
                aria-pressed={active}
                whileHover={{ y: -3, scale: 1.01 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className={cn(
                  "group relative flex min-h-[120px] items-start gap-4 overflow-hidden rounded-2xl border p-5 text-start",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cobalt-500 focus-visible:ring-offset-2",
                  active
                    ? "border-brand-cobalt-500 shadow-brand-md"
                    : "border-border bg-card hover:border-brand-cobalt-500/40",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="person-company-bg"
                    className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-cobalt-100 via-brand-cobalt-100/80 to-brand-cobalt-100/40"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    aria-hidden
                  />
                ) : null}
                <motion.span
                  animate={{
                    backgroundColor: active ? "rgb(30 123 216)" : "rgb(220 235 251)",
                    color: active ? "rgb(255 255 255)" : "rgb(30 123 216)",
                    rotate: active ? [0, -6, 6, 0] : 0,
                  }}
                  transition={{
                    backgroundColor: { duration: 0.3 },
                    color: { duration: 0.3 },
                    rotate: { duration: 0.5, ease: "easeInOut" },
                  }}
                  className="relative flex size-12 shrink-0 items-center justify-center rounded-xl"
                >
                  <tile.Icon className="size-6" aria-hidden />
                </motion.span>
                <span className="relative flex flex-col gap-1">
                  <span className="text-base font-semibold text-brand-navy-900">
                    {tile.title}
                  </span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    {tile.subtitle}
                  </span>
                </span>
                <motion.span
                  animate={{
                    backgroundColor: active ? "rgb(30 123 216)" : "transparent",
                    borderColor: active ? "rgb(30 123 216)" : "rgb(231 230 223)",
                    scale: active ? 1 : 0.85,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                  className="relative ms-auto inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold text-white"
                  aria-hidden
                >
                  <AnimatePresence>
                    {active ? (
                      <motion.span
                        initial={{ scale: 0, rotate: -45 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: 45 }}
                        transition={{ type: "spring", stiffness: 500, damping: 24 }}
                      >
                        ✓
                      </motion.span>
                    ) : null}
                  </AnimatePresence>
                </motion.span>
              </motion.button>
            );
          })}
        </div>
      </LayoutGroup>
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
      <AnimatePresence mode="popLayout" initial={false}>
        {value.length > 0 ? (
          <motion.ul
            key="chips"
            layout
            className="flex flex-wrap gap-1.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {value.map((slug) => (
                <motion.li
                  key={slug}
                  layout
                  initial={{ opacity: 0, scale: 0.6, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.6, y: -4 }}
                  transition={{ type: "spring", stiffness: 420, damping: 26 }}
                >
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => removeCity(slug)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-brand-cobalt-500/40 bg-brand-cobalt-100 px-3 py-1 text-sm text-brand-navy-900 transition-colors hover:bg-brand-cobalt-100/80"
                    aria-label={t("serviceAreaRemove", {
                      city: cityNameFor(slug, locale),
                    })}
                  >
                    <span>{cityNameFor(slug, locale)}</span>
                    <X className="size-3.5 opacity-70" aria-hidden />
                  </motion.button>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        ) : (
          <motion.p
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-xs italic text-muted-foreground"
          >
            {t("serviceAreaEmpty")}
          </motion.p>
        )}
      </AnimatePresence>
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
        <motion.ul layout className="mb-2 flex flex-col gap-1.5">
          <AnimatePresence mode="popLayout" initial={false}>
            {selectedEntries.map((entry) => {
              const parent =
                locale === "ar" && entry.parent_name_ar
                  ? entry.parent_name_ar
                  : entry.parent_name_en;
              const child =
                locale === "ar" && entry.name_ar ? entry.name_ar : entry.name_en;
              return (
                <motion.li
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, height: 0, x: -16, scale: 0.96 }}
                  animate={{ opacity: 1, height: "auto", x: 0, scale: 1 }}
                  exit={{ opacity: 0, height: 0, x: 16, scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 420, damping: 28 }}
                  className="flex items-center justify-between gap-2 overflow-hidden rounded-lg border border-brand-cobalt-500/30 bg-brand-cobalt-100/40 px-3 py-2 text-sm"
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
                </motion.li>
              );
            })}
          </AnimatePresence>
        </motion.ul>
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
      </Field>

      <Field label={t("segmentsLabel")} helperKey="helper.segments">
        <SegmentsPicker
          value={segments}
          onChange={setSegments}
          ariaLabel={t("segmentsLabel")}
        />
      </Field>

      <AnimatePresence>
        {error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </motion.div>
        ) : null}
      </AnimatePresence>

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
          <motion.div
            layout
            animate={{
              borderRadius: logoPreview ? 16 : 12,
              borderStyle: logoPreview ? "solid" : "dashed",
              borderColor: logoPreview ? "rgb(30 123 216)" : "rgb(231 230 223)",
            }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="flex size-20 shrink-0 items-center justify-center overflow-hidden border bg-muted/40"
            aria-hidden
          >
            <AnimatePresence mode="wait">
              {logoPreview ? (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, scale: 0.6, filter: "blur(8px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
                  transition={{ type: "spring", stiffness: 260, damping: 24 }}
                  className="size-full"
                >
                  <Image
                    src={logoPreview}
                    alt=""
                    width={80}
                    height={80}
                    unoptimized
                    className="size-full object-cover"
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  <ImageIcon className="size-7 text-muted-foreground" aria-hidden />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          <motion.label
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            className="flex flex-1 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm transition-colors hover:border-brand-cobalt-500 hover:bg-brand-cobalt-100/30"
          >
            <motion.span
              animate={{ y: values.logo ? 0 : [0, -3, 0] }}
              transition={
                values.logo
                  ? {}
                  : { duration: 1.6, ease: "easeInOut", repeat: Infinity, repeatDelay: 2 }
              }
              className="inline-flex"
            >
              <UploadCloud className="size-4 shrink-0 text-brand-cobalt-500" aria-hidden />
            </motion.span>
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
          </motion.label>
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

      <AnimatePresence>
        {error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </motion.div>
        ) : null}
      </AnimatePresence>

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
    <motion.label
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      animate={{
        borderColor: file ? "rgb(30 123 216)" : "rgb(231 230 223)",
        borderStyle: file ? "solid" : "dashed",
        backgroundColor: file
          ? "rgba(220 235 251 / 0.45)"
          : "rgba(244 244 239 / 0.3)",
      }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm hover:border-brand-cobalt-500 hover:bg-brand-cobalt-100/30"
    >
      <AnimatePresence mode="wait" initial={false}>
        {file ? (
          <motion.span
            key="file"
            initial={{ scale: 0, rotate: -90, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0, rotate: 90, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 22 }}
            className="inline-flex"
          >
            <FileText className="size-4 shrink-0 text-brand-cobalt-500" aria-hidden />
          </motion.span>
        ) : (
          <motion.span
            key="upload"
            initial={{ scale: 0, rotate: 90, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0, rotate: -90, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 22 }}
            className="inline-flex"
          >
            <Upload className="size-4 shrink-0 text-brand-cobalt-500" aria-hidden />
          </motion.span>
        )}
      </AnimatePresence>
      <motion.span
        key={file ? file.name : "empty"}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex-1 truncate text-muted-foreground"
      >
        {file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : label}
      </motion.span>
      <input
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => onSelect(e.target.files?.[0] ?? undefined)}
      />
    </motion.label>
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
