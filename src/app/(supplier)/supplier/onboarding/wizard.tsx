"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Check, FileText, Trash2, Upload } from "lucide-react";
import {
  DOC_TYPES,
  LANGUAGES,
  LEGAL_TYPES,
  OnboardingStep1,
} from "@/lib/domain/onboarding";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type WizardProps = { bootstrap: OnboardingBootstrap };
type Step = 1 | 2 | 3;

export function OnboardingWizard({ bootstrap }: WizardProps) {
  const t = useTranslations("supplier.onboarding");
  const [step, setStep] = useState<Step>(() => resolveInitialStep(bootstrap));
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(
    bootstrap.supplier?.id ?? null,
  );
  const [isPending, startTransition] = useTransition();

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

  return (
    <div className="flex flex-col gap-6">
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
                startTransition(async () => {
                  const result = await submitOnboardingStep1(undefined, fd);
                  handleStepResult(result, 2);
                });
              }}
            />
          ) : null}

          {step === 2 ? (
            <Step2Form
              existingDocs={bootstrap.docs}
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
              initial={bootstrap.supplier}
              categories={bootstrap.categories}
              selectedSubcategoryIds={bootstrap.subcategoryIds}
              pending={isPending}
              disabled={!supplierId}
              onBack={() => setStep(2)}
              onSubmit={(fd) => {
                startTransition(async () => {
                  const result = await submitOnboardingStep3(undefined, fd);
                  if (result.ok) setServerMessage(t("submittedForReview"));
                  else setServerMessage(result.message ?? t("genericError"));
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
  if (bootstrap.docs.length === 0) return 2;
  if (!bootstrap.supplier.base_city) return 3;
  return 3;
}

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

type Step1Values = {
  business_name: string;
  legal_type: (typeof LEGAL_TYPES)[number];
  cr_number?: string;
  national_id?: string;
  bio?: string;
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
    formState: { errors },
  } = useForm<Step1Values>({
    resolver: zodResolver(OnboardingStep1),
    defaultValues: {
      business_name: initial?.business_name ?? "",
      legal_type: (initial?.legal_type as Step1Values["legal_type"]) ?? "company",
      cr_number: initial?.cr_number ?? "",
      national_id: initial?.national_id ?? "",
      bio: initial?.bio ?? "",
    },
  });

  const legalType = watch("legal_type");

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Field label={t("businessNameLabel")} error={errors.business_name?.message}>
        <Input {...register("business_name")} />
      </Field>
      <Field label={t("legalTypeLabel")} error={errors.legal_type?.message}>
        <select
          {...register("legal_type")}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-3 focus:ring-ring/50"
        >
          {LEGAL_TYPES.map((lt) => (
            <option key={lt} value={lt}>
              {t(`legalType.${lt}`)}
            </option>
          ))}
        </select>
      </Field>
      {legalType === "company" ? (
        <Field label={t("crNumberLabel")} error={errors.cr_number?.message}>
          <Input {...register("cr_number")} />
        </Field>
      ) : null}
      {legalType === "freelancer" ? (
        <Field label={t("nationalIdLabel")} error={errors.national_id?.message}>
          <Input {...register("national_id")} />
        </Field>
      ) : null}
      <Field label={t("bioLabel")} error={errors.bio?.message} hint={t("bioHint")}>
        <Textarea {...register("bio")} rows={4} />
      </Field>
      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? t("saving") : t("continue")}
        </Button>
      </div>
    </form>
  );
}

type DocDraft = {
  id: string;
  doc_type: (typeof DOC_TYPES)[number];
  notes: string;
  file?: File;
};

function Step2Form({
  existingDocs,
  pending,
  disabled,
  onBack,
  onSubmit,
}: {
  existingDocs: OnboardingBootstrap["docs"];
  pending: boolean;
  disabled: boolean;
  onBack: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  const t = useTranslations("supplier.onboarding");
  const [drafts, setDrafts] = useState<DocDraft[]>(() => [
    { id: crypto.randomUUID(), doc_type: "cr", notes: "" },
  ]);
  const [error, setError] = useState<string | null>(null);

  const addDraft = () => {
    setDrafts((d) => [
      ...d,
      { id: crypto.randomUUID(), doc_type: "other", notes: "" },
    ]);
  };
  const updateDraft = (id: string, patch: Partial<DocDraft>) => {
    setDrafts((d) =>
      d.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  };
  const removeDraft = (id: string) => {
    setDrafts((d) => d.filter((entry) => entry.id !== id));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const withFiles = drafts.filter((d) => d.file && d.file.size > 0);
    if (withFiles.length === 0) {
      setError(t("step2RequireFile"));
      return;
    }
    const fd = new FormData();
    for (const draft of withFiles) {
      if (!draft.file) continue;
      fd.append("doc_type", draft.doc_type);
      fd.append("notes", draft.notes ?? "");
      fd.append("file", draft.file);
    }
    onSubmit(fd);
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
      {existingDocs.length > 0 ? (
        <section className="rounded-lg border border-border bg-muted/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("existingDocs")}
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {existingDocs.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" aria-hidden />
                  <span className="font-mono text-xs">{d.doc_type}</span>
                </span>
                <Badge variant="outline" className="text-xs">
                  {d.status}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <ul className="flex flex-col gap-4">
        {drafts.map((draft, idx) => (
          <li
            key={draft.id}
            className="flex flex-col gap-3 rounded-lg border border-border p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("docLabel")} #{idx + 1}
              </span>
              {drafts.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => removeDraft(draft.id)}
                >
                  <Trash2 />
                  {t("remove")}
                </Button>
              ) : null}
            </div>
            <Field label={t("docTypeLabel")}>
              <select
                value={draft.doc_type}
                onChange={(e) =>
                  updateDraft(draft.id, {
                    doc_type: e.target.value as DocDraft["doc_type"],
                  })
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-3 focus:ring-ring/50"
              >
                {DOC_TYPES.map((dt) => (
                  <option key={dt} value={dt}>
                    {t(`docType.${dt}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("docFileLabel")}>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm transition-colors hover:border-brand-cobalt-500 hover:bg-brand-cobalt-100/30">
                <Upload
                  className="size-4 shrink-0 text-brand-cobalt-500"
                  aria-hidden
                />
                <span className="flex-1 truncate text-muted-foreground">
                  {draft.file
                    ? `${draft.file.name} (${Math.round(
                        draft.file.size / 1024,
                      )} KB)`
                    : t("chooseFileHint")}
                </span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) =>
                    updateDraft(draft.id, {
                      file: e.target.files?.[0] ?? undefined,
                    })
                  }
                  className="sr-only"
                />
              </label>
            </Field>
            <Field label={t("docNotesLabel")}>
              <Input
                value={draft.notes}
                onChange={(e) => updateDraft(draft.id, { notes: e.target.value })}
              />
            </Field>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={addDraft}>
          {t("addAnother")}
        </Button>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onBack}>
            {t("back")}
          </Button>
          <Button type="submit" size="lg" disabled={pending || disabled}>
            {pending ? t("uploading") : t("continue")}
          </Button>
        </div>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}

type Step3Values = {
  base_city: string;
  base_lat?: string;
  base_lng?: string;
  service_area_cities: string;
  capacity?: string;
  concurrent_event_limit: number;
  languages: Array<(typeof LANGUAGES)[number]>;
  subcategory_ids: string[];
};

function Step3Form({
  initial,
  categories,
  selectedSubcategoryIds,
  pending,
  disabled,
  onBack,
  onSubmit,
}: {
  initial: OnboardingBootstrap["supplier"];
  categories: OnboardingBootstrap["categories"];
  selectedSubcategoryIds: string[];
  pending: boolean;
  disabled: boolean;
  onBack: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  const t = useTranslations("supplier.onboarding");

  const { register, handleSubmit, formState } = useForm<Step3Values>({
    defaultValues: {
      base_city: initial?.base_city ?? "",
      base_lat: "",
      base_lng: "",
      service_area_cities: (initial?.service_area_cities ?? []).join(", "),
      capacity: initial?.capacity != null ? String(initial.capacity) : "",
      concurrent_event_limit: initial?.concurrent_event_limit ?? 1,
      languages: (initial?.languages ?? ["en"]).filter((l) =>
        (LANGUAGES as readonly string[]).includes(l),
      ) as Step3Values["languages"],
      subcategory_ids: selectedSubcategoryIds,
    },
  });

  const parents = useMemo(
    () => categories.filter((c) => c.parent_id === null),
    [categories],
  );
  const childrenByParent = useMemo(() => {
    const map = new Map<string, typeof categories>();
    for (const c of categories) {
      if (c.parent_id) {
        const list = map.get(c.parent_id) ?? [];
        list.push(c);
        map.set(c.parent_id, list);
      }
    }
    return map;
  }, [categories]);

  const submit: SubmitHandler<Step3Values> = (values) => {
    const fd = new FormData();
    fd.append("base_city", values.base_city.trim());
    if (values.base_lat) fd.append("base_lat", values.base_lat);
    if (values.base_lng) fd.append("base_lng", values.base_lng);
    fd.append("service_area_cities", values.service_area_cities);
    if (values.capacity) fd.append("capacity", values.capacity);
    fd.append("concurrent_event_limit", String(values.concurrent_event_limit));
    for (const lang of values.languages) fd.append("languages", lang);
    for (const id of values.subcategory_ids) fd.append("subcategory_ids", id);
    // Server action `submitOnboardingStep3` runs the authoritative Zod check
    // (via `Step3Input` which relaxes the shared `OnboardingStep3` schema's
    // `category_ids.min(1)` requirement to 0). A previous client-side preCheck
    // against the stricter schema silently swallowed every submission because
    // `category_ids` is always [] in the form — bug surfaced as "submit button
    // does nothing". RHF's field-level `validate` already blocks empty
    // languages/subcategory_ids before we get here.
    onSubmit(fd);
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit(submit)} noValidate>
      <Field label={t("baseCityLabel")}>
        <Input
          {...register("base_city", { required: true, minLength: 2 })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("baseLatLabel")} hint={t("latLngHint")}>
          <Input {...register("base_lat")} />
        </Field>
        <Field label={t("baseLngLabel")}>
          <Input {...register("base_lng")} />
        </Field>
      </div>
      <Field label={t("serviceAreaLabel")} hint={t("serviceAreaHint")}>
        <Input {...register("service_area_cities", { required: true })} />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-foreground">
          {t("languagesLabel")}
        </legend>
        <div className="flex gap-4">
          {LANGUAGES.map((lang) => (
            <label key={lang} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                value={lang}
                className="size-4 rounded border-border accent-brand-cobalt-500"
                {...register("languages", { validate: (v) => v.length > 0 })}
              />
              {t(`language.${lang}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("capacityLabel")} hint={t("capacityHint")}>
          <Input type="number" min={0} {...register("capacity")} />
        </Field>
        <Field label={t("concurrentLimitLabel")} hint={t("concurrentLimitHint")}>
          <Input
            type="number"
            min={1}
            {...register("concurrent_event_limit", {
              valueAsNumber: true,
              required: true,
              min: 1,
            })}
          />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-foreground">
          {t("subcategoriesLabel")}
        </legend>
        <p className="text-xs text-muted-foreground">
          {t("subcategoriesHint")}
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {parents.map((parent) => {
            const subs = childrenByParent.get(parent.id) ?? [];
            if (subs.length === 0) return null;
            return (
              <div
                key={parent.id}
                className="rounded-lg border border-border p-3"
              >
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {parent.name_en}
                </p>
                <div className="flex flex-col gap-1.5 text-sm">
                  {subs.map((sub) => (
                    <label
                      key={sub.id}
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <input
                        type="checkbox"
                        value={sub.id}
                        className="size-4 rounded border-border accent-brand-cobalt-500"
                        {...register("subcategory_ids", {
                          validate: (v) => v.length > 0,
                        })}
                      />
                      {sub.name_en}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>
      <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onBack}>
          {t("back")}
        </Button>
        <Button
          type="submit"
          size="lg"
          disabled={pending || disabled || formState.isSubmitting}
        >
          {pending ? t("saving") : t("submit")}
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
