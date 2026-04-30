"use client";

/**
 * Sprint 4 Lane 2 — supplier quote builder (client form).
 *
 * Two trust domains:
 *   - rule_engine / mixed: line-item totals are read-only because the server
 *     ignores them and recomputes via composePrice(). We still let the
 *     supplier tweak addons (setup/teardown/deposit/etc) because those are
 *     passed through to composePrice verbatim.
 *   - free_form: every line item + total is editable. The server trusts the
 *     numbers but the Zod schema on the action rejects non-integer halalas.
 *
 * Submission flow: the real form (`<form action={formAction}>`) hosts hidden
 * inputs that are generated from RHF state on every render. RHF drives the
 * editable UI + blur-time validation; the hidden fields are what the server
 * action actually reads from FormData. This keeps `useActionState`'s pending
 * / success / error UX without fighting RHF for form control.
 */

import { useActionState, useEffect, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { FileText, Trash2, Upload } from "lucide-react";
import { formatHalalas, halalasToSar, sarToHalalas } from "@/lib/domain/money";
import type {
  QuoteLineItemKind,
  QuoteSnapshot,
  QuoteSource,
} from "@/lib/domain/quote";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { sendQuoteAction } from "./actions";
import type { ActionState } from "./action-state";
import { initialActionState } from "./action-state";

// ---------------------------------------------------------------------------
// Client-side form schema — minimally overlapping with the server Zod schema.
// The server re-parses + re-computes; client validation is kept light so the
// server is the single source of truth.
// ---------------------------------------------------------------------------

const UNITS = ["event", "hour", "day", "person", "unit"] as const;
const KINDS: readonly QuoteLineItemKind[] = [
  "package",
  "qty_discount",
  "date_surcharge",
  "distance_fee",
  "duration_multiplier",
  "free_form",
] as const;

const moneyStringSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), {
    message: "Must be a positive SAR amount (max 2 decimals).",
  });

const lineItemSchema = z.object({
  kind: z.enum(KINDS as unknown as readonly [QuoteLineItemKind, ...QuoteLineItemKind[]]),
  label: z.string().trim().min(1, "Required").max(200),
  qty: z.coerce.number().int().positive(),
  unit: z.enum(UNITS),
  unit_price_sar: moneyStringSchema,
  total_sar: moneyStringSchema,
});

const formSchema = z.object({
  source: z.enum(["rule_engine", "free_form", "mixed"] as const),
  prices_include_vat: z.boolean(),
  line_items: z.array(lineItemSchema).min(1),
  setup_fee_sar: moneyStringSchema,
  teardown_fee_sar: moneyStringSchema,
  deposit_pct: z.coerce.number().min(0).max(100),
  payment_schedule: z.string().max(500),
  cancellation_terms: z.string().max(500),
  inclusions_text: z.string().max(4000),
  exclusions_text: z.string().max(4000),
  notes: z.string().max(1024),
  validity_days: z.coerce.number().int().min(1).max(365),
});

const VAT_RATE_PCT = 15;

type FormValues = z.input<typeof formSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type QuoteBuilderFormProps = {
  inviteId: string;
  rfqId: string;
  supplierId: string;
  packageId: string | null;
  initialSnapshot: QuoteSnapshot;
  locked: boolean; // true when the quote is terminal; form disables submission
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// Technical-proposal upload cap mirrors the onboarding PDF cap (10 MB).
const TECHNICAL_PROPOSAL_MAX_BYTES = 10 * 1024 * 1024;

export function QuoteBuilderForm(props: QuoteBuilderFormProps) {
  const t = useTranslations("supplier.quote");
  const locale = useLocale();
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    sendQuoteAction,
    initialActionState,
  );

  // Tech file is picked via a real <input type="file"> inside the form; React
  // state powers the UI feedback (file name / remove button) and the server
  // reads the file directly from FormData on submit.
  const [technicalFile, setTechnicalFile] = useState<File | null>(null);
  const [technicalFileError, setTechnicalFileError] = useState<string | null>(
    null,
  );

  const defaults = buildDefaults(props.initialSnapshot);

  const {
    control,
    register,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults,
    mode: "onBlur",
  });

  const { fields, append, remove } = useFieldArray({ control, name: "line_items" });

  // Auto-recompute per-line total on qty/unit-price change in free-form mode.
  // The field stays editable, so the supplier can override; the override
  // survives until they touch qty/price again.
  useEffect(() => {
    const syncLine = (line: FormValues["line_items"][number] | undefined, idx: number) => {
      if (!line) return;
      const qty = Number(line.qty ?? 0);
      const price = Number(line.unit_price_sar ?? 0);
      if (!Number.isFinite(qty) || !Number.isFinite(price) || qty < 0 || price < 0) return;
      const computed = (qty * price).toFixed(2);
      const current = Number(line.total_sar || 0);
      if (!Number.isFinite(current) || current !== Number(computed)) {
        setValue(`line_items.${idx}.total_sar`, computed, { shouldValidate: false });
      }
    };
    // Seed current values once so an already-filled row without a total
    // (e.g. after a page refresh in free-form mode) displays the sum.
    const initial = getValues();
    if (initial.source === "free_form") {
      (initial.line_items ?? []).forEach((line, idx) => {
        if (!line.total_sar || line.total_sar.length === 0) syncLine(line, idx);
      });
    }
    const subscription = watch((value, info) => {
      if (!info.name) return;
      if (value.source !== "free_form") return;
      if (info.name === "source") {
        (value.line_items ?? []).forEach((line, idx) =>
          syncLine(line as FormValues["line_items"][number] | undefined, idx),
        );
        return;
      }
      const match = /^line_items\.(\d+)\.(qty|unit_price_sar)$/.exec(info.name);
      if (!match) return;
      const idx = Number(match[1]);
      syncLine(
        value.line_items?.[idx] as FormValues["line_items"][number] | undefined,
        idx,
      );
    });
    return () => subscription.unsubscribe();
  }, [watch, setValue, getValues]);

  const values = watch();
  const source = values.source as QuoteSource;
  const isEngineMode = source === "rule_engine" || source === "mixed";

  // Snapshot shape the server action parses — computed from live RHF state.
  const lineItemsPayload = (values.line_items ?? []).map((li) => {
    const unit_price_halalas = tryHalalas(li.unit_price_sar);
    const qty = Number(li.qty || 1);
    const total_halalas =
      li.total_sar && li.total_sar.length > 0
        ? tryHalalas(li.total_sar)
        : unit_price_halalas * qty;
    return {
      kind: li.kind,
      label: li.label ?? "",
      qty,
      unit: li.unit,
      unit_price_halalas,
      total_halalas,
    };
  });
  const inclusionsPayload = splitLines(values.inclusions_text ?? "");
  const exclusionsPayload = splitLines(values.exclusions_text ?? "");

  // Preview total — reflects the user's current edits (line totals + setup +
  // teardown + VAT). Mirrors engine.ts step 8/9; in engine/mixed mode the
  // server re-derives travel fee separately, so this is a client-side
  // approximation, not the final amount.
  const liveSubtotalHalalas = lineItemsPayload.reduce(
    (sum, li) => sum + (Number.isFinite(li.total_halalas) ? li.total_halalas : 0),
    0,
  );
  const liveSetupHalalas = tryHalalas(values.setup_fee_sar);
  const liveTeardownHalalas = tryHalalas(values.teardown_fee_sar);
  const liveTaxableBaseHalalas = Math.max(
    0,
    Math.round(liveSubtotalHalalas + liveSetupHalalas + liveTeardownHalalas),
  );
  const pricesIncludeVat = values.prices_include_vat === true;
  const liveVatHalalas = pricesIncludeVat
    ? Math.round(
        (liveTaxableBaseHalalas * VAT_RATE_PCT) / (100 + VAT_RATE_PCT),
      )
    : Math.round((liveTaxableBaseHalalas * VAT_RATE_PCT) / 100);
  const liveTotalHalalas = pricesIncludeVat
    ? liveTaxableBaseHalalas
    : liveTaxableBaseHalalas + liveVatHalalas;
  const liveBeforeVatHalalas = pricesIncludeVat
    ? liveTaxableBaseHalalas - liveVatHalalas
    : liveTaxableBaseHalalas;

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {/* Hidden identity + invariant fields */}
      <input type="hidden" name="rfq_id" value={props.rfqId} />
      <input type="hidden" name="supplier_id" value={props.supplierId} />
      <input type="hidden" name="invite_id" value={props.inviteId} />
      {props.packageId ? (
        <input type="hidden" name="package_id" value={props.packageId} />
      ) : null}
      <input
        type="hidden"
        name="qty"
        value={String(props.initialSnapshot.line_items[0]?.qty ?? 1)}
      />
      <input type="hidden" name="line_items" value={JSON.stringify(lineItemsPayload)} />
      <input type="hidden" name="inclusions" value={JSON.stringify(inclusionsPayload)} />
      <input type="hidden" name="exclusions" value={JSON.stringify(exclusionsPayload)} />
      <input type="hidden" name="source" value={values.source ?? "rule_engine"} />
      <input
        type="hidden"
        name="prices_include_vat"
        value={pricesIncludeVat ? "true" : "false"}
      />
      <input type="hidden" name="setup_fee_sar" value={values.setup_fee_sar ?? ""} />
      <input type="hidden" name="teardown_fee_sar" value={values.teardown_fee_sar ?? ""} />
      <input type="hidden" name="deposit_pct" value={String(values.deposit_pct ?? 0)} />
      <input type="hidden" name="payment_schedule" value={values.payment_schedule ?? ""} />
      <input type="hidden" name="cancellation_terms" value={values.cancellation_terms ?? ""} />
      <input type="hidden" name="notes" value={values.notes ?? ""} />
      <input
        type="hidden"
        name="expires_at"
        value={validityDaysToIso(values.validity_days as number | string | undefined)}
      />

      <ActionBanner state={state} />

      {props.locked ? (
        <Alert variant="destructive">
          <AlertDescription>
            {t("sendBlockedTerminal", { status: props.initialSnapshot.source })}
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Mode toggle */}
      <section className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("modeLabel")}</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("modeLabel")}>
          <ModeRadio value="rule_engine" label={t("modeRuleEngine")} {...register("source")} />
          <ModeRadio value="mixed" label={t("modeMixed")} {...register("source")} />
          <ModeRadio value="free_form" label={t("modeFreeForm")} {...register("source")} />
        </div>
      </section>

      {/* Line items */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-brand-navy-900">
            {t("lineItemsHeading")}
          </h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              append({
                kind: "free_form",
                label: "",
                qty: 1,
                unit: "event",
                unit_price_sar: "",
                total_sar: "",
              })
            }
          >
            {t("addLineItem")}
          </Button>
        </div>

        <label className="flex items-start gap-2.5 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-brand-cobalt-500"
            {...register("prices_include_vat")}
          />
          <span className="flex flex-col gap-0.5">
            <span className="font-medium text-foreground">
              {t("pricesIncludeVat", { rate: VAT_RATE_PCT })}
            </span>
            <span className="text-xs text-muted-foreground">
              {pricesIncludeVat
                ? t("pricesIncludeVatHintOn", { rate: VAT_RATE_PCT })
                : t("pricesIncludeVatHintOff", { rate: VAT_RATE_PCT })}
            </span>
          </span>
        </label>

        <div className="overflow-hidden rounded-lg border border-border">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("label")}
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("qty")}
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("unit")}
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("unitPrice")}
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("total")}
                </TableHead>
                <TableHead aria-hidden />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, idx) => (
                <TableRow key={field.id}>
                  <TableCell className="align-top whitespace-normal">
                    <Input
                      {...register(`line_items.${idx}.label`)}
                    />
                    <ErrorText msg={errors.line_items?.[idx]?.label?.message} />
                    <input type="hidden" {...register(`line_items.${idx}.kind`)} />
                  </TableCell>
                  <TableCell className="align-top">
                    <Input
                      type="number"
                      min={1}
                      className="w-20"
                      {...register(`line_items.${idx}.qty`)}
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <Controller
                      control={control}
                      name={`line_items.${idx}.unit`}
                      render={({ field: f }) => (
                        <select
                          {...f}
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {UNITS.map((u) => (
                            <option key={u} value={u}>
                              {t(`units.${u}`)}
                            </option>
                          ))}
                        </select>
                      )}
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <Input
                      type="text"
                      inputMode="decimal"
                      className="w-28"
                      {...register(`line_items.${idx}.unit_price_sar`)}
                    />
                    <ErrorText msg={errors.line_items?.[idx]?.unit_price_sar?.message} />
                  </TableCell>
                  <TableCell className="align-top">
                    <Input
                      type="text"
                      inputMode="decimal"
                      disabled={isEngineMode}
                      className="w-28 disabled:bg-muted disabled:text-muted-foreground"
                      aria-label={t("total")}
                      {...register(`line_items.${idx}.total_sar`)}
                    />
                    <ErrorText msg={errors.line_items?.[idx]?.total_sar?.message} />
                  </TableCell>
                  <TableCell className="align-top">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove(idx)}
                      disabled={fields.length <= 1}
                      aria-label="Remove line item"
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {isEngineMode ? (
          <p className="text-xs text-muted-foreground">
            {t("travelFeeComputed")}
          </p>
        ) : null}
      </section>

      {/* Addons */}
      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-brand-navy-900">
          {t("addonsHeading")}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <LabeledField label={t("setupFee")} error={errors.setup_fee_sar?.message}>
            <Input
              type="text"
              inputMode="decimal"
              {...register("setup_fee_sar")}
            />
          </LabeledField>
          <LabeledField label={t("teardownFee")} error={errors.teardown_fee_sar?.message}>
            <Input
              type="text"
              inputMode="decimal"
              {...register("teardown_fee_sar")}
            />
          </LabeledField>
          <LabeledField label={t("depositPct")} error={errors.deposit_pct?.message}>
            <Input
              type="number"
              min={0}
              max={100}
              {...register("deposit_pct")}
            />
          </LabeledField>
          <LabeledField
            label={t("validityDaysLabel")}
            error={errors.validity_days?.message}
          >
            <Input
              type="number"
              min={1}
              max={365}
              {...register("validity_days")}
            />
            {(() => {
              const d = Number(values.validity_days);
              if (!Number.isFinite(d) || d < 1) return null;
              const days = Math.floor(d);
              const endDate = new Date(
                Date.now() + days * 86_400_000,
              ).toLocaleDateString(locale, {
                year: "numeric",
                month: "short",
                day: "numeric",
              });
              return (
                <p className="mt-1.5 inline-flex w-fit rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {t("validityDaysHint", { days, endDate })}
                </p>
              );
            })()}
          </LabeledField>
          <LabeledField
            label={t("paymentSchedule")}
            error={errors.payment_schedule?.message}
            className="sm:col-span-2"
          >
            <Input type="text" {...register("payment_schedule")} />
          </LabeledField>
          <LabeledField
            label={t("cancellationTerms")}
            error={errors.cancellation_terms?.message}
            className="sm:col-span-2"
          >
            <Textarea rows={2} {...register("cancellation_terms")} />
          </LabeledField>
          <LabeledField
            label={t("inclusions")}
            hint={t("onePerLine")}
            error={errors.inclusions_text?.message}
          >
            <Textarea rows={3} {...register("inclusions_text")} />
          </LabeledField>
          <LabeledField
            label={t("exclusions")}
            hint={t("onePerLine")}
            error={errors.exclusions_text?.message}
          >
            <Textarea rows={3} {...register("exclusions_text")} />
          </LabeledField>
          <LabeledField
            label={t("notes")}
            className="sm:col-span-2"
            error={errors.notes?.message}
          >
            <Textarea rows={3} {...register("notes")} />
          </LabeledField>
        </div>
      </section>

      {/* Totals summary — live from current form state, not the stale snapshot. */}
      <section className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
        <dl className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-muted-foreground">
            <dt>{t("subtotalBeforeVat")}</dt>
            <dd className="tabular-nums">
              {formatHalalas(liveBeforeVatHalalas)}
            </dd>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <dt>
              {pricesIncludeVat
                ? t("vatOfWhich", { rate: VAT_RATE_PCT })
                : t("vatLine", { rate: VAT_RATE_PCT })}
            </dt>
            <dd className="tabular-nums">{formatHalalas(liveVatHalalas)}</dd>
          </div>
          <div className="mt-1 flex items-center justify-between border-t pt-2.5">
            <dt className="font-medium text-foreground">{t("total")}</dt>
            <dd className="text-lg font-semibold text-brand-navy-900 tabular-nums">
              {formatHalalas(liveTotalHalalas)}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          {isEngineMode ? t("totalHintEngine") : t("totalHintFreeForm")}
        </p>
      </section>

      {/* Technical proposal (optional) */}
      <section className="flex flex-col gap-2">
        <span className="text-sm font-medium">
          {t("technicalProposal.label")}
        </span>
        <p className="text-xs text-muted-foreground">
          {t("technicalProposal.hint")}
        </p>
        <label
          className={
            "group flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm transition-colors hover:border-brand-cobalt-500/60 hover:bg-brand-cobalt-100/20"
          }
        >
          <input
            type="file"
            name="technical_proposal_file"
            accept="application/pdf"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              if (!file) {
                setTechnicalFile(null);
                setTechnicalFileError(null);
                return;
              }
              if (file.type && file.type !== "application/pdf") {
                setTechnicalFileError(t("technicalProposal.errorType"));
                e.target.value = "";
                return;
              }
              if (file.size > TECHNICAL_PROPOSAL_MAX_BYTES) {
                setTechnicalFileError(t("technicalProposal.errorSize"));
                e.target.value = "";
                return;
              }
              setTechnicalFileError(null);
              setTechnicalFile(file);
            }}
          />
          {technicalFile ? (
            <>
              <FileText
                className="size-5 shrink-0 text-brand-cobalt-500"
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-foreground">
                {technicalFile.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("technicalProposal.replace")}
              </span>
            </>
          ) : (
            <>
              <Upload
                className="size-5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="min-w-0 flex-1 text-muted-foreground">
                {t("technicalProposal.cta")}
              </span>
            </>
          )}
        </label>
        {technicalFileError ? (
          <span className="text-xs text-semantic-danger-500">
            {technicalFileError}
          </span>
        ) : null}
      </section>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3">
        <Button type="submit" size="lg" disabled={isPending || props.locked}>
          {isPending ? t("sending") : t("sendDraft")}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function ActionBanner({ state }: { state: ActionState }) {
  if (state.status === "idle") return null;
  const isError = state.status === "error";
  return (
    <div
      role="status"
      className={
        isError
          ? "rounded-lg border border-semantic-danger-100 bg-semantic-danger-100/60 px-3 py-2 text-sm text-semantic-danger-500"
          : "rounded-lg border border-semantic-success-100 bg-semantic-success-100/60 px-3 py-2 text-sm text-semantic-success-500"
      }
    >
      {state.message}
    </div>
  );
}

function ModeRadio({
  value,
  label,
  ...rest
}: {
  value: string;
  label: string;
  name?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors has-[:checked]:border-brand-cobalt-500 has-[:checked]:bg-brand-cobalt-100 has-[:checked]:text-brand-navy-900 has-[:checked]:font-medium">
      <input
        type="radio"
        value={value}
        className="accent-brand-cobalt-500"
        {...rest}
      />
      <span>{label}</span>
    </label>
  );
}

function LabeledField({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
      <ErrorText msg={error} />
    </label>
  );
}

function ErrorText({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <span className="text-xs text-semantic-danger-500">{msg}</span>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDefaults(snapshot: QuoteSnapshot): FormValues {
  return {
    source: snapshot.source,
    prices_include_vat: snapshot.prices_include_vat === true,
    line_items:
      snapshot.line_items.length > 0
        ? snapshot.line_items.map((li) => ({
            kind: li.kind,
            label: li.label,
            qty: li.qty,
            unit: li.unit as (typeof UNITS)[number],
            unit_price_sar: halalasToSar(li.unit_price_halalas).toFixed(2),
            total_sar: halalasToSar(li.total_halalas).toFixed(2),
          }))
        : [
            {
              kind: "free_form",
              label: "",
              qty: 1,
              unit: "event",
              unit_price_sar: "",
              total_sar: "",
            },
          ],
    setup_fee_sar: halalasToSar(snapshot.setup_fee_halalas).toFixed(2),
    teardown_fee_sar: halalasToSar(snapshot.teardown_fee_halalas).toFixed(2),
    deposit_pct: snapshot.deposit_pct,
    payment_schedule: snapshot.payment_schedule ?? "",
    cancellation_terms: snapshot.cancellation_terms ?? "",
    inclusions_text: snapshot.inclusions.join("\n"),
    exclusions_text: snapshot.exclusions.join("\n"),
    notes: snapshot.notes ?? "",
    validity_days: snapshot.expires_at
      ? Math.max(1, Math.ceil((new Date(snapshot.expires_at).getTime() - Date.now()) / 86_400_000))
      : 14,
  };
}

function validityDaysToIso(daysRaw: number | string | undefined): string {
  const days = Number(daysRaw);
  if (!Number.isFinite(days) || days < 1) return "";
  const ms = Date.now() + Math.floor(days) * 86_400_000;
  return new Date(ms).toISOString();
}

function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function tryHalalas(sar: string | undefined): number {
  if (!sar || sar.length === 0) return 0;
  try {
    return sarToHalalas(sar);
  } catch {
    return 0;
  }
}
