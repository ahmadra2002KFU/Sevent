"use client";

/**
 * Supplier onboarding wizard — 2026-04-22 rebuild (3-step + path-route split).
 *
 * Shape (step 0 now lives at its own route /supplier/onboarding/path):
 *   Step 1 — business info: representative_name, business_name, bio (char counter +
 *            focus ring + autosave), base_city, service_area, languages.
 *           Top banners: ImportWebsiteCard (always).
 *   Step 2 — CategoryPillCloud (uncapped) + segments.
 *   Step 3 — UploadChip per document (logo / IBAN / company profile).
 *
 * Every FormLabel gets a sibling <HelperText> whose key is
 * `helper.<fieldName>`. HelperText auto-hides in English, so the helper
 * strings are only read in Arabic locale.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { Check, Sparkles, X } from "lucide-react";
import {
  LANGUAGES,
  LOGO_MAX_BYTES,
  OnboardingStep1 as OnboardingStep1Schema,
  PDF_MAX_BYTES,
  SUPPLIER_BIO_MAX_LENGTH,
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
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { HelperText } from "@/components/ui-ext/HelperText";
import { CityCombobox } from "@/components/supplier/CityCombobox";
import { SegmentsPicker } from "@/components/supplier/SegmentsPicker";
import { cityNameFor } from "@/lib/domain/cities";
import { WizardStepper } from "@/components/supplier/onboarding/WizardStepper";
import { ProfilePreview } from "@/components/supplier/onboarding/ProfilePreview";
import { ImportWebsiteCard } from "@/components/supplier/onboarding/ImportWebsiteCard";
import { AutoSaveIndicator } from "@/components/supplier/onboarding/AutoSaveIndicator";
import { CategoryPillCloud } from "@/components/supplier/onboarding/CategoryPillCloud";
import { UploadChip } from "@/components/supplier/onboarding/UploadChip";
import { BioField } from "@/components/supplier/onboarding/BioField";

type WizardProps = { bootstrap: OnboardingBootstrap };
type Step = 1 | 2 | 3;
type PathValue = "freelancer" | "company";

type SubcategoryOption = {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string | null;
  parent_id: string | null;
  parent_slug: string | null;
  parent_name_en: string | null;
  parent_name_ar: string | null;
};

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

  // Legal type is now chosen on `/supplier/onboarding/path` before this wizard
  // ever renders — we just read it for the CR-vs-NationalID branch below.
  const pathValue: PathValue = (() => {
    const lt = bootstrap.supplier?.legal_type;
    if (lt === "freelancer" || lt === "company") return lt;
    return "company";
  })();

  // Live preview state lifted from Step 1/2/3 so the preview rail can read it.
  const [livePreview, setLivePreview] = useState<{
    business_name: string;
    bio: string;
    base_city: string;
  }>({
    business_name: bootstrap.supplier?.business_name ?? "",
    bio: bootstrap.supplier?.bio ?? "",
    base_city: bootstrap.supplier?.base_city ?? "",
  });
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    bootstrap.subcategoryIds,
  );
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);

  // Stable identity: the child's live-preview effect has this in its dep
  // array, so an inline arrow would trigger an infinite render loop because
  // setLivePreview always yields a fresh object and re-renders the parent.
  const handleLiveChange = useCallback(
    (partial: { business_name?: string; bio?: string; base_city?: string }) => {
      setLivePreview((prev) => {
        const next = { ...prev, ...partial };
        if (
          next.business_name === prev.business_name &&
          next.bio === prev.bio &&
          next.base_city === prev.base_city
        ) {
          return prev;
        }
        return next;
      });
    },
    [],
  );

  const goToStep = (next: Step) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  // Build the denormalised subcategory list (each child carries parent names)
  // so both the pill-cloud and the preview rail can look up names by id.
  const subcategoryOptions: SubcategoryOption[] = useMemo(() => {
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

  // Preview hint copy per step.
  const hintCopy =
    step === 2
      ? t("previewRail.hintStep2")
      : step === 3
        ? t("previewRail.hintStep3")
        : t("previewRail.hintStep1");

  const previewCategoryNames = useMemo(() => {
    return selectedCategoryIds
      .map((id) => {
        const sub = subcategoryOptions.find((s) => s.id === id);
        if (!sub) return null;
        return locale === "ar" && sub.name_ar ? sub.name_ar : sub.name_en;
      })
      .filter((s): s is string => Boolean(s));
  }, [selectedCategoryIds, subcategoryOptions, locale]);

  const previewPlaceholders = {
    name: t("previewRail.placeholderName"),
    bio: t("previewRail.placeholderBio"),
    city: t("previewRail.placeholderCity"),
    noCategories: t("previewRail.noCategoriesHint"),
    responseLabel: t("previewRail.responseLabel"),
    bookingsLabel: t("previewRail.bookingsLabel"),
    ratingLabel: t("previewRail.ratingLabel"),
  };

  // Per-step heading + subtitle, rendered inside the wizard (client) so the
  // copy flips as the user advances. The outer onboarding layout only owns
  // the chrome; the page-level heading belongs here, not in `page.tsx`.
  const stepHeading =
    step === 1
      ? t("stepper.step1")
      : step === 2
        ? t("stepper.step2")
        : t("stepper.step3");
  const stepSubtitle =
    step === 1
      ? t("step1Subtitle")
      : step === 2
        ? t("step2Subtitle")
        : t("step3Subtitle");

  return (
    <div className="grid gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-brand-navy-900">
            {stepHeading}
          </h1>
          <p className="text-[13.5px] leading-relaxed text-muted-foreground">
            {stepSubtitle}
          </p>
        </header>

        <WizardStepper
          current={step}
          labels={[t("stepper.step1"), t("stepper.step2"), t("stepper.step3")]}
        />

        <Card className="overflow-hidden">
          <CardContent className="p-4 sm:p-6">
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
                    initialRepresentativeName={bootstrap.profileFullName ?? ""}
                    initialLegalType={
                      (bootstrap.supplier?.legal_type as PathValue | null) ??
                      pathValue
                    }
                    pending={isPending}
                    onLiveChange={handleLiveChange}
                    onSubmit={(values) => {
                      const fd = new FormData();
                      fd.append("representative_name", values.representative_name);
                      fd.append("business_name", values.business_name);
                      fd.append("legal_type", values.legal_type);
                      if (values.cr_number) fd.append("cr_number", values.cr_number);
                      if (values.national_id)
                        fd.append("national_id", values.national_id);
                      if (values.bio) fd.append("bio", values.bio);
                      fd.append("base_city", values.base_city);
                      fd.append(
                        "serves_all_ksa",
                        values.serves_all_ksa ? "true" : "false",
                      );
                      if (!values.serves_all_ksa) {
                        for (const city of values.service_area_cities) {
                          fd.append("service_area_cities", city);
                        }
                      }
                      for (const lang of values.languages)
                        fd.append("languages", lang);
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
                    selectedIds={selectedCategoryIds}
                    onSelectedIdsChange={setSelectedCategoryIds}
                    initialSegments={
                      (bootstrap.supplier?.works_with_segments ??
                        []) as MarketSegmentSlug[]
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
                    pending={isPending}
                    disabled={!supplierId}
                    legalType={pathValue}
                    onLogoPreviewChange={setLogoPreviewUrl}
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

      {/* Preview rail — hidden below lg. Sticky top. */}
      <aside className="hidden lg:block">
        <div className="sticky top-6 flex flex-col gap-4">
          <ProfilePreview
            name={livePreview.business_name}
            bio={livePreview.bio}
            cityLabel={cityNameFor(
              livePreview.base_city,
              locale === "ar" ? "ar" : "en",
            )}
            categories={previewCategoryNames}
            logoUrl={logoPreviewUrl}
            placeholders={previewPlaceholders}
          />
          <div className="flex items-start gap-2.5 rounded-xl border border-brand-cobalt-500/25 bg-brand-cobalt-100/40 p-3.5 text-[12.5px] leading-relaxed text-brand-navy-900">
            <Sparkles
              className="mt-0.5 size-4 shrink-0 text-brand-cobalt-500"
              strokeWidth={1.8}
              aria-hidden
            />
            <span>{hintCopy}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

function resolveInitialStep(bootstrap: OnboardingBootstrap): Step {
  // Path-picker route already gatekept `legal_type` — by the time this wizard
  // mounts we're always at step 1 or later. If business_name is still empty
  // (freshly minted shell row from the path picker), start at step 1.
  if (!bootstrap.supplier?.business_name) return 1;
  if (bootstrap.subcategoryIds.length === 0) return 2;
  const hasIban = bootstrap.docs.some((d) => d.doc_type === "iban_certificate");
  if (!hasIban) return 3;
  return 3;
}

// ---------------------------------------------------------------------------
// Step 1 — business info (person/company picked in step 0).
// ---------------------------------------------------------------------------

type Step1Values = {
  representative_name: string;
  business_name: string;
  legal_type: "company" | "freelancer" | "foreign";
  cr_number?: string;
  national_id?: string;
  bio?: string;
  base_city: string;
  serves_all_ksa: boolean;
  service_area_cities: string[];
  languages: Array<(typeof LANGUAGES)[number]>;
};

function Step1Form({
  initial,
  initialRepresentativeName,
  initialLegalType,
  pending,
  onSubmit,
  onLiveChange,
}: {
  initial: OnboardingBootstrap["supplier"];
  initialRepresentativeName: string;
  initialLegalType: PathValue;
  pending: boolean;
  onSubmit: SubmitHandler<Step1Values>;
  onLiveChange: (partial: {
    business_name?: string;
    bio?: string;
    base_city?: string;
  }) => void;
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
      representative_name: initialRepresentativeName,
      business_name: initial?.business_name ?? "",
      legal_type:
        (initial?.legal_type as Step1Values["legal_type"]) ?? initialLegalType,
      cr_number: initial?.cr_number ?? "",
      national_id: initial?.national_id ?? "",
      bio: initial?.bio ?? "",
      base_city: initial?.base_city ?? "",
      serves_all_ksa: Boolean(initial?.serves_all_ksa ?? false),
      service_area_cities: (initial?.service_area_cities ?? []) as string[],
      languages: ((initial?.languages as Step1Values["languages"]) ?? ["ar"]).filter(
        (l) => (LANGUAGES as readonly string[]).includes(l),
      ) as Step1Values["languages"],
    },
  });

  const legalType = watch("legal_type");
  const baseCity = watch("base_city");
  const businessName = watch("business_name") ?? "";
  const bio = watch("bio") ?? "";
  const serviceAreas = watch("service_area_cities") ?? [];
  const servesAllKsa = watch("serves_all_ksa") ?? false;
  const languagesSelected = watch("languages") ?? [];

  // Lift watched values to the parent so the preview rail sees them live.
  useEffect(() => {
    onLiveChange({
      business_name: businessName,
      bio,
      base_city: baseCity,
    });
  }, [businessName, bio, baseCity, onLiveChange]);

  // Autosave indicator UX (no real autosave call — just the indicator).
  // On any keystroke → debounce 600ms → show "saved" for 2s.
  const [autoSaveVisible, setAutoSaveVisible] = useState(false);
  const autoSaveTimers = useRef<{
    debounce: ReturnType<typeof setTimeout> | null;
    hide: ReturnType<typeof setTimeout> | null;
  }>({ debounce: null, hide: null });

  useEffect(() => {
    const timers = autoSaveTimers.current;
    if (timers.debounce) clearTimeout(timers.debounce);
    timers.debounce = setTimeout(() => {
      setAutoSaveVisible(true);
      if (timers.hide) clearTimeout(timers.hide);
      timers.hide = setTimeout(() => setAutoSaveVisible(false), 2000);
    }, 600);
    return () => {
      if (timers.debounce) clearTimeout(timers.debounce);
    };
  }, [businessName, bio, baseCity, legalType]);

  useEffect(() => {
    // Snapshot the ref's container object (stable for the component's lifetime)
    // so the unmount cleanup reads the same `timers` instance the effect saw.
    const timers = autoSaveTimers.current;
    return () => {
      if (timers.debounce) clearTimeout(timers.debounce);
      if (timers.hide) clearTimeout(timers.hide);
    };
  }, []);

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <ImportWebsiteCard
        labels={{
          title: t("importWebsite.title"),
          subtitle: t("importWebsite.subtitle"),
          placeholder: t("importWebsite.placeholder"),
          cta: t("importWebsite.cta"),
          comingSoon: t("importWebsite.comingSoon"),
        }}
      />

      <Field
        label={t("wizard.representativeNameLabel")}
        helperKey="wizard.representativeNameHelp"
        error={errors.representative_name?.message}
      >
        <Input
          {...register("representative_name")}
          placeholder={t("wizard.representativeNamePlaceholder")}
          autoComplete="name"
        />
      </Field>

      <Field
        label={t("businessNameLabel")}
        helperKey="helper.businessName"
        error={errors.business_name?.message}
      >
        <Input
          {...register("business_name")}
          placeholder={t("placeholder.businessName")}
        />
      </Field>

      <Controller
        control={control}
        name="bio"
        render={({ field }) => (
          <BioField
            value={field.value ?? ""}
            onChange={(v) => {
              field.onChange(v);
              setValue("bio", v, { shouldDirty: true });
            }}
            onBlur={field.onBlur}
            name={field.name}
            error={errors.bio?.message}
            maxLength={SUPPLIER_BIO_MAX_LENGTH}
            labels={{
              label: t("bioLabel"),
              placeholder: t("placeholder.bio"),
              hint: t("bioHint"),
              counter: (count, max) =>
                t("wizard.bioCharCounter", { count, max }),
              savedMoments: t("wizard.draftSavedSecondsAgo"),
            }}
          />
        )}
      />

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
          name="serves_all_ksa"
          render={({ field }) => (
            <ServesAllKsaToggle
              checked={Boolean(field.value)}
              onChange={(next) => {
                field.onChange(next);
                if (next) {
                  // Flip ON → wipe any city picks so the refinement passes and
                  // the picker UI starts fresh if they toggle back off.
                  setValue("service_area_cities", [], {
                    shouldDirty: true,
                    shouldValidate: false,
                  });
                }
              }}
              labels={{
                label: t("servesAllKsa.label"),
                hint: t("servesAllKsa.hint"),
                chip: t("servesAllKsa.chip"),
              }}
            />
          )}
        />
        {servesAllKsa ? null : (
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
        )}
        {!servesAllKsa && serviceAreas.length > 15 ? (
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

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <AutoSaveIndicator
          label={t("autosave.saved")}
          visible={autoSaveVisible}
        />
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? t("saving") : t("continue")}
        </Button>
      </div>
    </form>
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
        <p className="text-xs text-muted-foreground">
          {t("serviceAreaMaxReached")}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — categories (pill cloud) + segments
// ---------------------------------------------------------------------------

function Step2Form({
  subcategoryOptions,
  selectedIds,
  onSelectedIdsChange,
  initialSegments,
  pending,
  disabled,
  onBack,
  onSubmit,
}: {
  subcategoryOptions: SubcategoryOption[];
  selectedIds: string[];
  onSelectedIdsChange: (next: string[]) => void;
  initialSegments: MarketSegmentSlug[];
  pending: boolean;
  disabled: boolean;
  onBack: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  const t = useTranslations("supplier.onboarding");
  const locale = useLocale();
  const [segments, setSegments] =
    useState<MarketSegmentSlug[]>(initialSegments);
  const [error, setError] = useState<string | null>(null);

  // Group subcategories by parent for the CategoryPillCloud.
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { parentName: string; items: Array<{ id: string; name: string }> }
    >();
    for (const sub of subcategoryOptions) {
      const parent =
        locale === "ar"
          ? sub.parent_name_ar ?? sub.parent_name_en ?? "—"
          : sub.parent_name_en ?? "—";
      const name =
        locale === "ar" && sub.name_ar ? sub.name_ar : sub.name_en;
      if (!map.has(parent)) {
        map.set(parent, { parentName: parent, items: [] });
      }
      map.get(parent)!.items.push({ id: sub.id, name });
    }
    return Array.from(map.values());
  }, [subcategoryOptions, locale]);

  function toggleCategory(id: string) {
    if (selectedIds.includes(id)) {
      onSelectedIdsChange(selectedIds.filter((v) => v !== id));
    } else {
      onSelectedIdsChange([...selectedIds, id]);
    }
  }
  function removeSub(id: string) {
    onSelectedIdsChange(selectedIds.filter((v) => v !== id));
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
      <CategoryPillCloud
        groups={groups}
        selectedIds={selectedIds}
        onToggle={toggleCategory}
        onClear={removeSub}
        labels={{
          heading: t("categoryCloud.heading"),
          hintMax: t("step2.subcategoriesHint"),
          searchPlaceholder: t("categoryCloud.searchPlaceholder"),
          selectedCounter: (picked, max) =>
            t("wizard.maxCategoriesLabel", { selected: picked, max }),
          addAria: (name) => t("categoryCloud.addAria", { name }),
          removeAria: (name) => t("categoryCloud.removeAria", { name }),
        }}
      />

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
// Step 3 — documents + profile assets (UploadChip per file).
// ---------------------------------------------------------------------------

type Step3Values = {
  logo?: File;
  iban?: File;
  companyProfile?: File;
  cr?: File;
  nationalAddress?: File;
  vat?: File;
};

function Step3Form({
  pending,
  disabled,
  legalType,
  onBack,
  onSubmit,
  onLogoPreviewChange,
}: {
  pending: boolean;
  disabled: boolean;
  legalType: PathValue;
  onBack: () => void;
  onSubmit: (fd: FormData) => void;
  onLogoPreviewChange: (url: string | null) => void;
}) {
  const t = useTranslations("supplier.onboarding");
  const [values, setValues] = useState<Step3Values>({});
  const [error, setError] = useState<string | null>(null);

  // Live preview of chosen logo via blob URL, revoked on change/unmount.
  const logoPreview = useLogoPreview(values.logo);

  // Bubble logo preview URL up so the rail can show it too.
  useEffect(() => {
    onLogoPreviewChange(logoPreview);
  }, [logoPreview, onLogoPreviewChange]);

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
  function validatePdf(
    file: File,
    errorType: string,
    errorSize: string,
  ): string | null {
    if (file.type && file.type !== "application/pdf") return errorType;
    if (file.size > PDF_MAX_BYTES) return errorSize;
    return null;
  }

  const isCompany = legalType === "company";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!values.iban) {
      setError(t("iban.required"));
      return;
    }
    if (isCompany) {
      if (!values.cr) {
        setError(t("crCert.required"));
        return;
      }
      if (!values.nationalAddress) {
        setError(t("nationalAddress.required"));
        return;
      }
      if (!values.vat) {
        setError(t("vatCert.required"));
        return;
      }
    }
    setError(null);
    const fd = new FormData();
    if (values.logo) fd.append("logo_file", values.logo);
    fd.append("iban_file", values.iban);
    if (values.companyProfile)
      fd.append("company_profile_file", values.companyProfile);
    if (values.cr) fd.append("cr_file", values.cr);
    if (values.nationalAddress)
      fd.append("national_address_file", values.nationalAddress);
    if (values.vat) fd.append("vat_file", values.vat);
    onSubmit(fd);
  }

  const chipLabels = {
    optional: t("uploadChip.optional"),
    replace: t("uploadChip.replace"),
    click: t("uploadChip.click"),
    orDrag: t("uploadChip.orDrag"),
    verified: t("uploadChip.verified"),
  };

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
      <UploadChip
        label={t("logo.label")}
        hint={t("logo.cta")}
        accept="image/*"
        kind="image"
        previewUrl={logoPreview}
        file={values.logo ?? null}
        optional
        onPick={(f) =>
          pickFile("logo", f ?? undefined, validateLogo)
        }
        labels={chipLabels}
      />

      <UploadChip
        label={t("iban.label")}
        hint={t("iban.cta")}
        accept="application/pdf"
        kind="pdf"
        file={values.iban ?? null}
        status={values.iban ? "verified" : "idle"}
        onPick={(f) =>
          pickFile("iban", f ?? undefined, (file) =>
            validatePdf(file, t("iban.errorType"), t("iban.errorSize")),
          )
        }
        labels={chipLabels}
      />

      <UploadChip
        label={t("companyProfile.label")}
        hint={t("wizard.companyProfileHint")}
        accept="application/pdf"
        kind="pdf"
        file={values.companyProfile ?? null}
        optional
        onPick={(f) =>
          pickFile("companyProfile", f ?? undefined, (file) =>
            validatePdf(
              file,
              t("companyProfile.errorType"),
              t("companyProfile.errorSize"),
            ),
          )
        }
        labels={chipLabels}
      />

      {isCompany ? (
        <div className="flex flex-col gap-6 rounded-xl border border-brand-cobalt-500/20 bg-brand-cobalt-100/20 p-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-brand-navy-900">
              {t("companyDocs.heading")}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("companyDocs.subheading")}
            </span>
          </div>

          <UploadChip
            label={t("crCert.label")}
            hint={t("crCert.cta")}
            accept="application/pdf"
            kind="pdf"
            file={values.cr ?? null}
            status={values.cr ? "verified" : "idle"}
            onPick={(f) =>
              pickFile("cr", f ?? undefined, (file) =>
                validatePdf(
                  file,
                  t("crCert.errorType"),
                  t("crCert.errorSize"),
                ),
              )
            }
            labels={chipLabels}
          />

          <UploadChip
            label={t("nationalAddress.label")}
            hint={t("nationalAddress.cta")}
            accept="application/pdf"
            kind="pdf"
            file={values.nationalAddress ?? null}
            status={values.nationalAddress ? "verified" : "idle"}
            onPick={(f) =>
              pickFile("nationalAddress", f ?? undefined, (file) =>
                validatePdf(
                  file,
                  t("nationalAddress.errorType"),
                  t("nationalAddress.errorSize"),
                ),
              )
            }
            labels={chipLabels}
          />

          <UploadChip
            label={t("vatCert.label")}
            hint={t("vatCert.cta")}
            accept="application/pdf"
            kind="pdf"
            file={values.vat ?? null}
            status={values.vat ? "verified" : "idle"}
            onPick={(f) =>
              pickFile("vat", f ?? undefined, (file) =>
                validatePdf(
                  file,
                  t("vatCert.errorType"),
                  t("vatCert.errorSize"),
                ),
              )
            }
            labels={chipLabels}
          />
        </div>
      ) : null}

      {/* Security disclosure: "your documents are safe". */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-[12.5px] leading-relaxed text-neutral-600">
        <span className="font-semibold text-brand-navy-900">
          {t("helper.iban")}
        </span>
      </div>

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

// ---------------------------------------------------------------------------
// ServesAllKsaToggle — switch that flips the service-area field into a single
// "Serves all KSA" declaration. Supersedes individual city picks; the Zod
// refinement in OnboardingStep1 enforces that the two can't coexist.
// ---------------------------------------------------------------------------

function ServesAllKsaToggle({
  checked,
  onChange,
  labels,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  labels: { label: string; hint: string; chip: string };
}) {
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "group flex items-center gap-3 rounded-xl border p-3 text-start transition-colors",
          checked
            ? "border-brand-cobalt-500/60 bg-brand-cobalt-100/40"
            : "border-neutral-200 bg-neutral-50 hover:border-brand-cobalt-500/40",
        )}
      >
        <span
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
            checked ? "bg-brand-cobalt-500" : "bg-neutral-300",
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
              checked ? "translate-x-[18px] rtl:-translate-x-[18px]" : "translate-x-0.5",
            )}
          />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-medium text-foreground">
            {labels.label}
          </span>
          <span className="text-xs text-muted-foreground">{labels.hint}</span>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {checked ? (
          <motion.div
            key="all-ksa-chip"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="inline-flex w-fit items-center gap-1.5 rounded-full border border-brand-cobalt-500/40 bg-brand-cobalt-100 px-3 py-1 text-xs text-brand-navy-900"
          >
            <Check className="size-3.5" aria-hidden />
            {labels.chip}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
