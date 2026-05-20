"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Building2, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCompanyAction, type CreateCompanyState } from "./actions";

const initial: CreateCompanyState = { status: "idle" };

// Draft is namespaced + versioned so a future field/shape change can bump the
// suffix without colliding with stale blobs in a returning user's browser.
const STORAGE_KEY = "sevent:company-onboarding-draft:v1";

type Draft = {
  name: string;
  name_ar: string;
  slug: string;
  cr_number: string;
  vat_number: string;
  billing_email: string;
  default_language: "en" | "ar";
};

function emptyDraft(defaultLanguage: "en" | "ar"): Draft {
  return {
    name: "",
    name_ar: "",
    slug: "",
    cr_number: "",
    vat_number: "",
    billing_email: "",
    default_language: defaultLanguage,
  };
}

export function CompanyForm({ defaultLanguage }: { defaultLanguage: "en" | "ar" }) {
  const t = useTranslations("organizer.onboarding.company");
  const [state, action] = useActionState<CreateCompanyState, FormData>(
    createCompanyAction,
    initial,
  );

  // The form was previously uncontrolled, so any refresh or failed submit wiped
  // every field. We now mirror all inputs into a single draft object that's
  // persisted to localStorage, restoring values across reloads and failures.
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(defaultLanguage));

  // Hydrate on mount only (client-side) — reading localStorage during render
  // would diverge from the server HTML and trigger a hydration mismatch.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<Draft>;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time SSR-safe hydration: reading localStorage during render would diverge from the server HTML and cause a hydration mismatch, so it must happen after mount.
      setDraft((prev) => ({
        ...prev,
        ...saved,
        default_language:
          saved.default_language === "ar" || saved.default_language === "en"
            ? saved.default_language
            : prev.default_language,
      }));
    } catch {
      // Corrupt JSON or storage disabled (private mode) — fall back to empty.
    }
  }, []);

  // Persist on every edit so a reload restores the in-progress draft.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Quota / private-mode write failure — the in-memory form still works.
    }
  }, [draft]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form
      action={(formData) => {
        // Drop the saved draft at submit: on success the action redirects away
        // (no client success state to clear on), and on failure the in-memory
        // `draft` state survives the re-render so the visible inputs keep their
        // values. The persist effect above already covered the refresh case.
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // ignore
        }
        return action(formData);
      }}
      className="flex flex-col gap-6"
      noValidate
    >
      <Field label={t("nameLabel")}>
        <Input
          id="company-name"
          name="name"
          required
          maxLength={120}
          placeholder={t("namePlaceholder")}
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </Field>

      <Field label={t("nameArLabel")} hint={t("nameArHint")}>
        <Input
          id="company-name-ar"
          name="name_ar"
          maxLength={120}
          placeholder={t("nameArPlaceholder")}
          dir="rtl"
          lang="ar"
          value={draft.name_ar}
          onChange={(e) => set("name_ar", e.target.value)}
        />
      </Field>

      <Field label={t("slugLabel")} hint={t("slugHint")}>
        <Input
          id="company-slug"
          name="slug"
          required
          minLength={3}
          maxLength={64}
          placeholder={t("slugPlaceholder")}
          pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
          autoCapitalize="off"
          spellCheck={false}
          value={draft.slug}
          onChange={(e) => set("slug", e.target.value)}
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label={t("crLabel")} hint={t("crHint")}>
          <Input
            id="company-cr"
            name="cr_number"
            inputMode="numeric"
            pattern="^\d{10}$"
            maxLength={10}
            placeholder={t("crPlaceholder")}
            value={draft.cr_number}
            onChange={(e) => set("cr_number", e.target.value)}
          />
        </Field>

        <Field label={t("vatLabel")} hint={t("vatHint")}>
          <Input
            id="company-vat"
            name="vat_number"
            inputMode="numeric"
            pattern="^3\d{14}$"
            maxLength={15}
            placeholder={t("vatPlaceholder")}
            value={draft.vat_number}
            onChange={(e) => set("vat_number", e.target.value)}
          />
        </Field>
      </div>

      <Field label={t("billingEmailLabel")} hint={t("billingEmailHint")}>
        <Input
          id="company-billing"
          name="billing_email"
          type="email"
          required
          maxLength={255}
          placeholder={t("billingEmailPlaceholder")}
          value={draft.billing_email}
          onChange={(e) => set("billing_email", e.target.value)}
        />
      </Field>

      <Field label={t("defaultLanguageLabel")}>
        <Select
          name="default_language"
          value={draft.default_language}
          onValueChange={(v) => {
            if (v === "en" || v === "ar") set("default_language", v);
          }}
        >
          <SelectTrigger id="company-language" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">{t("defaultLanguageEn")}</SelectItem>
            <SelectItem value="ar">{t("defaultLanguageAr")}</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <AnimatePresence>
        {state.status === "error" ? (
          <motion.div
            key="company-error"
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <Alert variant="destructive">
              <AlertTriangle aria-hidden />
              <AlertDescription>
                {t(`errors.${state.code}` as never)}
              </AlertDescription>
            </Alert>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <SubmitButton label={t("submit")} pendingLabel={t("submitting")} />
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function SubmitButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-fit">
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          {pendingLabel}
        </>
      ) : (
        <>
          <Building2 aria-hidden />
          {label}
        </>
      )}
    </Button>
  );
}
