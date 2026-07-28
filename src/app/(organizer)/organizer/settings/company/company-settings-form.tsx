"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Loader2, Save } from "lucide-react";
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
import { updateCompanyAction, type UpdateCompanyState } from "./actions";

type CompanySettingsFormProps = {
  companyId: string;
  defaultValues: {
    name: string;
    name_ar: string;
    slug: string;
    cr_number: string;
    vat_number: string;
    billing_email: string;
    default_language: "en" | "ar";
    logo_path: string;
    /** Whole SAR, or "" for no cap. Owner-only; empty for other roles. */
    quote_acceptance_threshold_sar: string;
  };
  canEdit: boolean;
  /** Owners alone may set the member spend cap (RPC enforces via P0062). */
  isOwner: boolean;
};

const initial: UpdateCompanyState = { status: "idle" };

export function CompanySettingsForm({
  companyId,
  defaultValues,
  canEdit,
  isOwner,
}: CompanySettingsFormProps) {
  const t = useTranslations("organizer.settings.company");
  const [state, action] = useActionState<UpdateCompanyState, FormData>(
    updateCompanyAction,
    initial,
  );

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="company_id" value={companyId} />

      <Field label={t("nameLabel")}>
        <Input
          id="company-name"
          name="name"
          required
          maxLength={120}
          defaultValue={defaultValues.name}
          disabled={!canEdit}
        />
      </Field>

      <Field label={t("nameArLabel")} hint={t("nameArHint")}>
        <Input
          id="company-name-ar"
          name="name_ar"
          maxLength={120}
          defaultValue={defaultValues.name_ar}
          dir="rtl"
          lang="ar"
          disabled={!canEdit}
        />
      </Field>

      <Field label={t("slugLabel")} hint={t("slugHint")}>
        <Input
          id="company-slug"
          name="slug"
          value={defaultValues.slug}
          disabled
          readOnly
        />
      </Field>

      {/*
        Finance fields (CR / VAT / billing email) are admin-only. Members
        don't see them at all — both for the UI (PR 7 finding #7) and to
        keep the server-side payload free of those values when a non-admin
        submits. The DB-side `revoke select (cr_number, vat_number,
        billing_email)` from `authenticated` is the actual enforcement
        boundary; this hides them from the form rendering too.
      */}
      {canEdit ? (
        <>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label={t("crLabel")} hint={t("crHint")}>
              <Input
                id="company-cr"
                name="cr_number"
                inputMode="numeric"
                pattern="^\d{10}$"
                maxLength={10}
                defaultValue={defaultValues.cr_number}
              />
            </Field>

            <Field label={t("vatLabel")} hint={t("vatHint")}>
              <Input
                id="company-vat"
                name="vat_number"
                inputMode="numeric"
                pattern="^3\d{14}$"
                maxLength={15}
                defaultValue={defaultValues.vat_number}
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
              defaultValue={defaultValues.billing_email}
            />
          </Field>
        </>
      ) : null}

      {/*
        Member spend cap — owner-only. Enforced in accept_quote_tx_v2 (P0060):
        a `member`-role actor cannot accept a quote whose total exceeds it.
        Owners and admins are never gated by it. Empty = unlimited, which is
        why the input is left blank rather than defaulting to a number.
      */}
      {isOwner ? (
        <Field
          label={t("spendCapLabel")}
          hint={t("spendCapHint")}
        >
          <Input
            id="company-spend-cap"
            name="quote_acceptance_threshold_sar"
            inputMode="numeric"
            pattern="^[0-9]*$"
            maxLength={9}
            placeholder={t("spendCapPlaceholder")}
            defaultValue={defaultValues.quote_acceptance_threshold_sar}
          />
        </Field>
      ) : null}

      <Field label={t("defaultLanguageLabel")}>
        <Select
          name="default_language"
          defaultValue={defaultValues.default_language}
          disabled={!canEdit}
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

      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden />
          <AlertDescription>
            {t(`errors.${state.code}` as never)}
          </AlertDescription>
        </Alert>
      ) : null}

      {state.status === "success" ? (
        <Alert>
          <CheckCircle2 aria-hidden />
          <AlertDescription>{t("savedToast")}</AlertDescription>
        </Alert>
      ) : null}

      {!canEdit ? (
        <p className="text-xs text-muted-foreground">{t("memberReadonlyHint")}</p>
      ) : (
        <SubmitButton label={t("submit")} pendingLabel={t("submitting")} />
      )}
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
          <Save aria-hidden />
          {label}
        </>
      )}
    </Button>
  );
}
