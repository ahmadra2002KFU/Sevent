"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  DOC_TYPES,
  LANGUAGES,
  LEGAL_TYPES,
  OnboardingStep1,
  OnboardingStep3,
} from "@/lib/domain/onboarding";
import {
  submitOnboardingStep1,
  submitOnboardingStep2,
  submitOnboardingStep3,
  type OnboardingState,
} from "./actions";
import type { OnboardingBootstrap } from "./loader";

type WizardProps = { bootstrap: OnboardingBootstrap };
type Step = 1 | 2 | 3;

export function OnboardingWizard({ bootstrap }: WizardProps) {
  const t = useTranslations("supplier.onboarding");
  const [step, setStep] = useState<Step>(() => resolveInitialStep(bootstrap));
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(bootstrap.supplier?.id ?? null);
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

      <div className="rounded-lg border border-[var(--color-border)] bg-white p-6 shadow-sm">
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
          <p
            role="status"
            className="mt-4 rounded-md bg-[var(--color-muted)] p-3 text-sm text-[var(--color-foreground)]"
          >
            {serverMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function resolveInitialStep(bootstrap: OnboardingBootstrap): Step {
  if (!bootstrap.supplier) return 1;
  if (bootstrap.docs.length === 0) return 2;
  if (!bootstrap.supplier.base_city) return 3;
  return 3;
}

function Stepper({ current, t }: { current: Step; t: ReturnType<typeof useTranslations> }) {
  const steps: Array<{ id: Step; label: string }> = [
    { id: 1, label: t("step1Heading") },
    { id: 2, label: t("step2Heading") },
    { id: 3, label: t("step3Heading") },
  ];
  return (
    <ol className="flex flex-wrap items-center gap-3 text-sm">
      {steps.map((s) => {
        const done = current > s.id;
        const active = current === s.id;
        return (
          <li key={s.id} className="flex items-center gap-2">
            <span
              className={[
                "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium",
                active
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                  : done
                    ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                    : "border-[var(--color-border)] text-[var(--color-muted-foreground)]",
              ].join(" ")}
            >
              {s.id}
            </span>
            <span
              className={
                active
                  ? "font-medium text-[var(--color-foreground)]"
                  : "text-[var(--color-muted-foreground)]"
              }
            >
              {s.label}
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
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Field label={t("businessNameLabel")} error={errors.business_name?.message}>
        <input
          {...register("business_name")}
          className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        />
      </Field>
      <Field label={t("legalTypeLabel")} error={errors.legal_type?.message}>
        <select
          {...register("legal_type")}
          className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
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
          <input
            {...register("cr_number")}
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </Field>
      ) : null}
      {legalType === "freelancer" ? (
        <Field label={t("nationalIdLabel")} error={errors.national_id?.message}>
          <input
            {...register("national_id")}
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </Field>
      ) : null}
      <Field label={t("bioLabel")} error={errors.bio?.message} hint={t("bioHint")}>
        <textarea
          {...register("bio")}
          rows={4}
          className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        />
      </Field>
      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-60"
        >
          {pending ? t("saving") : t("continue")}
        </button>
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
    setDrafts((d) => [...d, { id: crypto.randomUUID(), doc_type: "other", notes: "" }]);
  };
  const updateDraft = (id: string, patch: Partial<DocDraft>) => {
    setDrafts((d) => d.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
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
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      {existingDocs.length > 0 ? (
        <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t("existingDocs")}
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {existingDocs.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs">{d.doc_type}</span>
                <span className="text-xs text-[var(--color-muted-foreground)]">{d.status}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <ul className="flex flex-col gap-4">
        {drafts.map((draft, idx) => (
          <li
            key={draft.id}
            className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                {t("docLabel")} #{idx + 1}
              </span>
              {drafts.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeDraft(draft.id)}
                  className="text-xs text-[var(--color-muted-foreground)] hover:text-red-600"
                >
                  {t("remove")}
                </button>
              ) : null}
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t("docTypeLabel")}</span>
              <select
                value={draft.doc_type}
                onChange={(e) =>
                  updateDraft(draft.id, { doc_type: e.target.value as DocDraft["doc_type"] })
                }
                className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              >
                {DOC_TYPES.map((dt) => (
                  <option key={dt} value={dt}>
                    {t(`docType.${dt}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t("docFileLabel")}</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => updateDraft(draft.id, { file: e.target.files?.[0] ?? undefined })}
                className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t("docNotesLabel")}</span>
              <input
                value={draft.notes}
                onChange={(e) => updateDraft(draft.id, { notes: e.target.value })}
                className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              />
            </label>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={addDraft}
          className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
        >
          {t("addAnother")}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm hover:bg-[var(--color-muted)]"
          >
            {t("back")}
          </button>
          <button
            type="submit"
            disabled={pending || disabled}
            className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-60"
          >
            {pending ? t("uploading") : t("continue")}
          </button>
        </div>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
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

  const parents = useMemo(() => categories.filter((c) => c.parent_id === null), [categories]);
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

    const preCheck = OnboardingStep3.safeParse({
      base_city: values.base_city.trim(),
      base_location:
        values.base_lat && values.base_lng
          ? { lat: Number(values.base_lat), lng: Number(values.base_lng) }
          : undefined,
      service_area_cities: values.service_area_cities
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      languages: values.languages,
      capacity: values.capacity ? Number(values.capacity) : undefined,
      concurrent_event_limit: Number(values.concurrent_event_limit),
      category_ids: [],
      subcategory_ids: values.subcategory_ids,
    });
    if (!preCheck.success) return;
    onSubmit(fd);
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(submit)} noValidate>
      <Field label={t("baseCityLabel")}>
        <input
          {...register("base_city", { required: true, minLength: 2 })}
          className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("baseLatLabel")} hint={t("latLngHint")}>
          <input
            {...register("base_lat")}
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t("baseLngLabel")}>
          <input
            {...register("base_lng")}
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </Field>
      </div>
      <Field label={t("serviceAreaLabel")} hint={t("serviceAreaHint")}>
        <input
          {...register("service_area_cities", { required: true })}
          className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t("languagesLabel")}</legend>
        <div className="flex gap-4">
          {LANGUAGES.map((lang) => (
            <label key={lang} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                value={lang}
                {...register("languages", { validate: (v) => v.length > 0 })}
              />
              {t(`language.${lang}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("capacityLabel")} hint={t("capacityHint")}>
          <input
            type="number"
            min={0}
            {...register("capacity")}
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t("concurrentLimitLabel")} hint={t("concurrentLimitHint")}>
          <input
            type="number"
            min={1}
            {...register("concurrent_event_limit", {
              valueAsNumber: true,
              required: true,
              min: 1,
            })}
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">{t("subcategoriesLabel")}</legend>
        <p className="text-xs text-[var(--color-muted-foreground)]">{t("subcategoriesHint")}</p>
        <div className="grid gap-3 md:grid-cols-2">
          {parents.map((parent) => {
            const subs = childrenByParent.get(parent.id) ?? [];
            if (subs.length === 0) return null;
            return (
              <div key={parent.id} className="rounded-md border border-[var(--color-border)] p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  {parent.name_en}
                </p>
                <div className="flex flex-col gap-1 text-sm">
                  {subs.map((sub) => (
                    <label key={sub.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        value={sub.id}
                        {...register("subcategory_ids", { validate: (v) => v.length > 0 })}
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
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm hover:bg-[var(--color-muted)]"
        >
          {t("back")}
        </button>
        <button
          type="submit"
          disabled={pending || disabled || formState.isSubmitting}
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-60"
        >
          {pending ? t("saving") : t("submit")}
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
      {hint ? <span className="text-xs text-[var(--color-muted-foreground)]">{hint}</span> : null}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
