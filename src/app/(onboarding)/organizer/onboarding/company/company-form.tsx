"use client";

import { useActionState } from "react";
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

export function CompanyForm({ defaultLanguage }: { defaultLanguage: "en" | "ar" }) {
  const t = useTranslations("organizer.onboarding.company");
  const [state, action] = useActionState<CreateCompanyState, FormData>(
    createCompanyAction,
    initial,
  );

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <Field label={t("nameLabel")}>
        <Input
          id="company-name"
          name="name"
          required
          maxLength={120}
          placeholder={t("namePlaceholder")}
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
        />
      </Field>

      <Field label={t("defaultLanguageLabel")}>
        <Select name="default_language" defaultValue={defaultLanguage}>
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
