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

import { useActionState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { formatHalalas, halalasToSar, sarToHalalas } from "@/lib/domain/money";
import type {
  QuoteLineItemKind,
  QuoteSnapshot,
  QuoteSource,
} from "@/lib/domain/quote";
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
  line_items: z.array(lineItemSchema).min(1),
  setup_fee_sar: moneyStringSchema,
  teardown_fee_sar: moneyStringSchema,
  deposit_pct: z.coerce.number().min(0).max(100),
  payment_schedule: z.string().max(500),
  cancellation_terms: z.string().max(500),
  inclusions_text: z.string().max(4000),
  exclusions_text: z.string().max(4000),
  notes: z.string().max(1024),
  expires_at: z.string(),
});

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

export function QuoteBuilderForm(props: QuoteBuilderFormProps) {
  const t = useTranslations("supplier.quote");
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    sendQuoteAction,
    initialActionState,
  );

  const defaults = buildDefaults(props.initialSnapshot);

  const {
    control,
    register,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults,
    mode: "onBlur",
  });

  const { fields, append, remove } = useFieldArray({ control, name: "line_items" });

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
      <input type="hidden" name="setup_fee_sar" value={values.setup_fee_sar ?? ""} />
      <input type="hidden" name="teardown_fee_sar" value={values.teardown_fee_sar ?? ""} />
      <input type="hidden" name="deposit_pct" value={String(values.deposit_pct ?? 0)} />
      <input type="hidden" name="payment_schedule" value={values.payment_schedule ?? ""} />
      <input type="hidden" name="cancellation_terms" value={values.cancellation_terms ?? ""} />
      <input type="hidden" name="notes" value={values.notes ?? ""} />
      <input
        type="hidden"
        name="expires_at"
        value={datetimeLocalToIso(values.expires_at ?? "") ?? ""}
      />

      <ActionBanner state={state} />

      {props.locked ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {t("sendBlockedTerminal", { status: props.initialSnapshot.source })}
        </div>
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
          <h2 className="text-base font-semibold">{t("lineItemsHeading")}</h2>
          <button
            type="button"
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
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-muted)]"
          >
            {t("addLineItem")}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                <th className="py-2 pr-3">{t("label")}</th>
                <th className="py-2 pr-3">{t("qty")}</th>
                <th className="py-2 pr-3">{t("unit")}</th>
                <th className="py-2 pr-3">{t("unitPrice")}</th>
                <th className="py-2 pr-3">{t("total")}</th>
                <th className="py-2" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {fields.map((field, idx) => (
                <tr key={field.id} className="border-b border-[var(--color-border)]">
                  <td className="py-2 pr-3 align-top">
                    <input
                      {...register(`line_items.${idx}.label`)}
                      className="w-full rounded-md border border-[var(--color-border)] bg-white px-2 py-1.5"
                    />
                    <ErrorText msg={errors.line_items?.[idx]?.label?.message} />
                    <input type="hidden" {...register(`line_items.${idx}.kind`)} />
                  </td>
                  <td className="py-2 pr-3 align-top">
                    <input
                      type="number"
                      min={1}
                      {...register(`line_items.${idx}.qty`)}
                      className="w-20 rounded-md border border-[var(--color-border)] bg-white px-2 py-1.5"
                    />
                  </td>
                  <td className="py-2 pr-3 align-top">
                    <Controller
                      control={control}
                      name={`line_items.${idx}.unit`}
                      render={({ field: f }) => (
                        <select
                          {...f}
                          className="rounded-md border border-[var(--color-border)] bg-white px-2 py-1.5"
                        >
                          {UNITS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      )}
                    />
                  </td>
                  <td className="py-2 pr-3 align-top">
                    <input
                      type="text"
                      inputMode="decimal"
                      {...register(`line_items.${idx}.unit_price_sar`)}
                      className="w-28 rounded-md border border-[var(--color-border)] bg-white px-2 py-1.5"
                    />
                    <ErrorText msg={errors.line_items?.[idx]?.unit_price_sar?.message} />
                  </td>
                  <td className="py-2 pr-3 align-top">
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={isEngineMode}
                      {...register(`line_items.${idx}.total_sar`)}
                      className="w-28 rounded-md border border-[var(--color-border)] bg-white px-2 py-1.5 disabled:bg-[var(--color-muted)] disabled:text-[var(--color-muted-foreground)]"
                      aria-label={t("total")}
                    />
                    <ErrorText msg={errors.line_items?.[idx]?.total_sar?.message} />
                  </td>
                  <td className="py-2 align-top">
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      disabled={fields.length <= 1}
                      className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Remove line item"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isEngineMode ? (
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {t("travelFeeComputed")}
          </p>
        ) : null}
      </section>

      {/* Addons */}
      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">{t("addonsHeading")}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <LabeledField label={t("setupFee")} error={errors.setup_fee_sar?.message}>
            <input
              type="text"
              inputMode="decimal"
              {...register("setup_fee_sar")}
              className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            />
          </LabeledField>
          <LabeledField label={t("teardownFee")} error={errors.teardown_fee_sar?.message}>
            <input
              type="text"
              inputMode="decimal"
              {...register("teardown_fee_sar")}
              className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            />
          </LabeledField>
          <LabeledField label={t("depositPct")} error={errors.deposit_pct?.message}>
            <input
              type="number"
              min={0}
              max={100}
              {...register("deposit_pct")}
              className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            />
          </LabeledField>
          <LabeledField label={t("expiresAt")} error={errors.expires_at?.message}>
            <input
              type="datetime-local"
              {...register("expires_at")}
              className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            />
          </LabeledField>
          <LabeledField
            label={t("paymentSchedule")}
            error={errors.payment_schedule?.message}
            className="sm:col-span-2"
          >
            <input
              type="text"
              {...register("payment_schedule")}
              className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            />
          </LabeledField>
          <LabeledField
            label={t("cancellationTerms")}
            error={errors.cancellation_terms?.message}
            className="sm:col-span-2"
          >
            <textarea
              rows={2}
              {...register("cancellation_terms")}
              className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            />
          </LabeledField>
          <LabeledField
            label={t("inclusions")}
            hint="One per line."
            error={errors.inclusions_text?.message}
          >
            <textarea
              rows={3}
              {...register("inclusions_text")}
              className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            />
          </LabeledField>
          <LabeledField
            label={t("exclusions")}
            hint="One per line."
            error={errors.exclusions_text?.message}
          >
            <textarea
              rows={3}
              {...register("exclusions_text")}
              className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            />
          </LabeledField>
          <LabeledField
            label={t("notes")}
            className="sm:col-span-2"
            error={errors.notes?.message}
          >
            <textarea
              rows={3}
              {...register("notes")}
              className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            />
          </LabeledField>
        </div>
      </section>

      {/* Totals summary */}
      <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)]/40 p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-medium">{t("total")}</span>
          <span className="text-base font-semibold">
            {formatHalalas(props.initialSnapshot.total_halalas)}
          </span>
        </div>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          {isEngineMode
            ? "The server recomputes totals from your rules on send."
            : "Free-form total is the sum of your line items plus addons."}
        </p>
      </section>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={isPending || props.locked}
          className="rounded-md bg-[var(--color-sevent-green)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-sevent-green-hover,var(--color-sevent-green))] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? t("sending") : t("sendDraft")}
        </button>
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
          ? "rounded-md border border-[#F2C2C2] bg-[#FCE9E9] px-3 py-2 text-sm text-[#9F1A1A]"
          : "rounded-md border border-[#BDE3CB] bg-[#E2F4EA] px-3 py-2 text-sm text-[var(--color-sevent-green)]"
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
    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm has-[:checked]:border-[var(--color-sevent-green)] has-[:checked]:bg-[var(--color-sevent-green)]/10">
      <input
        type="radio"
        value={value}
        className="accent-[var(--color-sevent-green)]"
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
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint ? (
        <span className="text-xs text-[var(--color-muted-foreground)]">{hint}</span>
      ) : null}
      <ErrorText msg={error} />
    </label>
  );
}

function ErrorText({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <span className="text-xs text-red-700">{msg}</span>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDefaults(snapshot: QuoteSnapshot): FormValues {
  return {
    source: snapshot.source,
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
    expires_at: snapshot.expires_at ? toDatetimeLocal(snapshot.expires_at) : "",
  };
}

function toDatetimeLocal(iso: string): string {
  // <input type="datetime-local"> expects "YYYY-MM-DDTHH:mm"
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

function datetimeLocalToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
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
