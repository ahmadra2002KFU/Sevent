"use client";

/**
 * One form per `pricing_rule_type`. Rule-type is chosen at "New rule" time
 * then the matching sub-form renders. Each sub-form serializes its specific
 * shape and the top-level submit hands the raw config to the server action,
 * where `parsePricingRuleConfig` does the authoritative validation via the
 * Zod schemas in `src/lib/domain/pricing/rules.ts`.
 */

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  PRICING_RULE_TYPES,
  safeParsePricingRuleConfig,
  type PricingRuleType,
} from "@/lib/domain/pricing/rules";
import type { PackageRow, PricingRuleRow } from "@/lib/supabase/types";
import {
  upsertPricingRuleAction,
  type CatalogActionResult,
  type UpsertPricingRuleInput,
} from "./actions";

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

type Props = {
  supplierId: string;
  packages: PackageRow[];
  initial?: PricingRuleRow | null;
  onDone: (result: CatalogActionResult) => void;
  onCancel: () => void;
};

type MetaState = {
  package_id: string | "";
  priority: number;
  version: number;
  is_active: boolean;
  valid_from: string;
  valid_to: string;
};

export function RuleForm({ supplierId, packages, initial, onDone, onCancel }: Props) {
  const t = useTranslations("supplier.catalog");
  const [ruleType, setRuleType] = useState<PricingRuleType>(
    (initial?.rule_type as PricingRuleType | undefined) ?? "qty_tier_all_units",
  );
  const [meta, setMeta] = useState<MetaState>({
    package_id: initial?.package_id ?? "",
    priority: initial?.priority ?? 100,
    version: initial?.version ?? 1,
    is_active: initial?.is_active ?? true,
    valid_from: initial?.valid_from ?? "",
    valid_to: initial?.valid_to ?? "",
  });
  const [config, setConfig] = useState<unknown>(() => initial?.config_jsonb ?? defaultConfig(ruleType));
  const [clientIssues, setClientIssues] = useState<string[] | null>(null);
  const [serverIssues, setServerIssues] = useState<string[] | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onRuleTypeChange = (next: PricingRuleType) => {
    setRuleType(next);
    if (!initial) setConfig(defaultConfig(next));
    setClientIssues(null);
    setServerIssues(null);
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerError(null);
    setServerIssues(null);

    // Client-side round trip through the shared Zod schema before hitting the
    // server. Keeps the UI from POSTing obviously invalid configs.
    const pre = safeParsePricingRuleConfig(ruleType, config);
    if (!pre.success) {
      setClientIssues(
        pre.error.issues.map((i) =>
          i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message,
        ),
      );
      return;
    }
    setClientIssues(null);

    const payload: UpsertPricingRuleInput = {
      id: initial?.id,
      package_id: meta.package_id || null,
      rule_type: ruleType,
      priority: Number(meta.priority) || 100,
      version: Number(meta.version) || 1,
      is_active: meta.is_active,
      valid_from: meta.valid_from ? meta.valid_from : null,
      valid_to: meta.valid_to ? meta.valid_to : null,
      config: pre.data,
    };

    startTransition(async () => {
      const result = await upsertPricingRuleAction(payload);
      if (!result.ok) {
        setServerError(result.error);
        setServerIssues(result.issues ?? null);
        return;
      }
      onDone(result);
    });
  };

  // Suppress "unused" lint on supplierId while giving future form writers a
  // stable reference for cross-rule scope logic.
  void supplierId;

  return (
    <form
      className="flex flex-col gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/40 p-4"
      onSubmit={submit}
      noValidate
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("ruleForm.typeLabel")}>
          <select
            value={ruleType}
            onChange={(e) => onRuleTypeChange(e.target.value as PricingRuleType)}
            disabled={Boolean(initial)}
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm disabled:bg-[var(--color-muted)]"
          >
            {PRICING_RULE_TYPES.map((rt) => (
              <option key={rt} value={rt}>
                {t(`ruleType.${rt}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={t("ruleForm.packageLabel")}
          hint={t("ruleForm.packageHint")}
        >
          <select
            value={meta.package_id}
            onChange={(e) => setMeta({ ...meta, package_id: e.target.value })}
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          >
            <option value="">{t("ruleForm.packageAny")}</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Field label={t("priority")}>
          <input
            type="number"
            value={meta.priority}
            onChange={(e) => setMeta({ ...meta, priority: Number(e.target.value) })}
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t("ruleForm.versionLabel")}>
          <input
            type="number"
            min={1}
            value={meta.version}
            onChange={(e) => setMeta({ ...meta, version: Number(e.target.value) })}
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t("validFrom")}>
          <input
            type="date"
            value={meta.valid_from}
            onChange={(e) => setMeta({ ...meta, valid_from: e.target.value })}
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t("validTo")}>
          <input
            type="date"
            value={meta.valid_to}
            onChange={(e) => setMeta({ ...meta, valid_to: e.target.value })}
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={meta.is_active}
          onChange={(e) => setMeta({ ...meta, is_active: e.target.checked })}
        />
        <span>{t("activeToggle")}</span>
      </label>

      {/* Per-type sub-form dispatch. One React component per rule_type. */}
      {ruleType === "qty_tier_all_units" ? (
        <QtyTierAllUnitsForm value={config} onChange={setConfig} />
      ) : null}
      {ruleType === "qty_tier_incremental" ? (
        <QtyTierIncrementalForm value={config} onChange={setConfig} />
      ) : null}
      {ruleType === "distance_fee" ? (
        <DistanceFeeForm value={config} onChange={setConfig} />
      ) : null}
      {ruleType === "date_surcharge" ? (
        <DateSurchargeForm value={config} onChange={setConfig} />
      ) : null}
      {ruleType === "duration_multiplier" ? (
        <DurationMultiplierForm value={config} onChange={setConfig} />
      ) : null}

      {clientIssues ? (
        <IssueList issues={clientIssues} kind="client" />
      ) : null}
      {serverError ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {serverError}
        </div>
      ) : null}
      {serverIssues ? <IssueList issues={serverIssues} kind="server" /> : null}

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-60"
        >
          {isPending ? t("saving") : t("save")}
        </button>
      </div>
    </form>
  );
}

// ===========================================================================
// Per-type defaults
// ===========================================================================

function defaultConfig(rt: PricingRuleType): unknown {
  switch (rt) {
    case "qty_tier_all_units":
      return { breakpoints: [{ gte: 10, discount_pct: 10 }] };
    case "qty_tier_incremental":
      return {
        breakpoints: [
          { from: 1, to: 49, price_halalas: 15000 },
          { from: 50, to: null, price_halalas: 12000 },
        ],
      };
    case "distance_fee":
      return { sar_per_km: 3.5, free_radius_km: 20, min_fee_halalas: 5000 };
    case "date_surcharge":
      return {
        scope: "weekday",
        days: ["fri", "sat"],
        multiplier: 1.15,
      };
    case "duration_multiplier":
      return {
        tiers: [
          { applies_from_days: 7, multiplier: 0.9, label: "week" },
        ],
      };
  }
}

// ===========================================================================
// Per-type sub-forms
// ===========================================================================

type SubFormProps = {
  value: unknown;
  onChange: (next: unknown) => void;
};

function QtyTierAllUnitsForm({ value, onChange }: SubFormProps) {
  const t = useTranslations("supplier.catalog");
  type Row = { gte: number; discount_pct: number };
  const cfg = (value as { breakpoints?: Row[] }) ?? {};
  const rows: Row[] = cfg.breakpoints ?? [];

  const update = (next: Row[]) => onChange({ breakpoints: next });

  return (
    <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {t("ruleType.qty_tier_all_units")}
      </p>
      <ul className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <li key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs">{t("ruleForm.qtyAllUnits.gte")}</span>
              <input
                type="number"
                min={1}
                value={r.gte}
                onChange={(e) =>
                  update(rows.map((x, j) => (j === i ? { ...x, gte: Number(e.target.value) } : x)))
                }
                className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs">{t("ruleForm.qtyAllUnits.discountPct")}</span>
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={r.discount_pct}
                onChange={(e) =>
                  update(
                    rows.map((x, j) =>
                      j === i ? { ...x, discount_pct: Number(e.target.value) } : x,
                    ),
                  )
                }
                className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={() => update(rows.filter((_, j) => j !== i))}
              className="self-end rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs hover:bg-[var(--color-muted)]"
            >
              {t("remove")}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => update([...rows, { gte: (rows.at(-1)?.gte ?? 0) + 10, discount_pct: 5 }])}
        className="self-start rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs hover:bg-[var(--color-muted)]"
      >
        {t("addRow")}
      </button>
    </div>
  );
}

function QtyTierIncrementalForm({ value, onChange }: SubFormProps) {
  const t = useTranslations("supplier.catalog");
  type Row = { from: number; to: number | null; price_halalas: number };
  const cfg = (value as { breakpoints?: Row[] }) ?? {};
  const rows: Row[] = cfg.breakpoints ?? [];

  const update = (next: Row[]) => onChange({ breakpoints: next });

  return (
    <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {t("ruleType.qty_tier_incremental")}
      </p>
      <ul className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <li key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs">{t("ruleForm.qtyIncr.from")}</span>
              <input
                type="number"
                min={1}
                value={r.from}
                onChange={(e) =>
                  update(rows.map((x, j) => (j === i ? { ...x, from: Number(e.target.value) } : x)))
                }
                className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs">{t("ruleForm.qtyIncr.to")}</span>
              <input
                type="number"
                min={1}
                value={r.to ?? ""}
                placeholder={t("ruleForm.qtyIncr.toPlaceholder")}
                onChange={(e) =>
                  update(
                    rows.map((x, j) =>
                      j === i
                        ? { ...x, to: e.target.value === "" ? null : Number(e.target.value) }
                        : x,
                    ),
                  )
                }
                className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs">{t("ruleForm.qtyIncr.priceHalalas")}</span>
              <input
                type="number"
                min={0}
                value={r.price_halalas}
                onChange={(e) =>
                  update(
                    rows.map((x, j) =>
                      j === i ? { ...x, price_halalas: Number(e.target.value) } : x,
                    ),
                  )
                }
                className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={() => update(rows.filter((_, j) => j !== i))}
              className="self-end rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs hover:bg-[var(--color-muted)]"
            >
              {t("remove")}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() =>
          update([
            ...rows,
            {
              from: ((rows.at(-1)?.to ?? 0) + 1) || 1,
              to: null,
              price_halalas: rows.at(-1)?.price_halalas ?? 10000,
            },
          ])
        }
        className="self-start rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs hover:bg-[var(--color-muted)]"
      >
        {t("addRow")}
      </button>
      <p className="text-xs text-[var(--color-muted-foreground)]">
        {t("ruleForm.qtyIncr.hint")}
      </p>
    </div>
  );
}

function DistanceFeeForm({ value, onChange }: SubFormProps) {
  const t = useTranslations("supplier.catalog");
  type Cfg = {
    sar_per_km: number;
    free_radius_km: number;
    min_fee_halalas: number;
    max_fee_halalas?: number;
  };
  const cfg: Cfg = {
    sar_per_km: 0,
    free_radius_km: 0,
    min_fee_halalas: 0,
    ...(value as Partial<Cfg>),
  };

  const patch = (p: Partial<Cfg>) => onChange({ ...cfg, ...p });

  return (
    <div className="grid gap-2 rounded-md border border-[var(--color-border)] bg-white p-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs">{t("ruleForm.distance.sarPerKm")}</span>
        <input
          type="number"
          step="0.01"
          min={0}
          value={cfg.sar_per_km}
          onChange={(e) => patch({ sar_per_km: Number(e.target.value) })}
          className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs">{t("ruleForm.distance.freeRadiusKm")}</span>
        <input
          type="number"
          step="0.1"
          min={0}
          value={cfg.free_radius_km}
          onChange={(e) => patch({ free_radius_km: Number(e.target.value) })}
          className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs">{t("ruleForm.distance.minFeeHalalas")}</span>
        <input
          type="number"
          min={0}
          value={cfg.min_fee_halalas}
          onChange={(e) => patch({ min_fee_halalas: Number(e.target.value) })}
          className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs">{t("ruleForm.distance.maxFeeHalalas")}</span>
        <input
          type="number"
          min={0}
          value={cfg.max_fee_halalas ?? ""}
          onChange={(e) =>
            patch({
              max_fee_halalas: e.target.value === "" ? undefined : Number(e.target.value),
            })
          }
          className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        />
      </label>
    </div>
  );
}

function DateSurchargeForm({ value, onChange }: SubFormProps) {
  const t = useTranslations("supplier.catalog");
  type SpecificDate = {
    scope: "specific_date";
    date: string;
    multiplier?: number;
    flat_addon_halalas?: number;
  };
  type NamedPeriod = {
    scope: "named_period";
    name: string;
    start: string;
    end: string;
    multiplier?: number;
    flat_addon_halalas?: number;
  };
  type Weekday = {
    scope: "weekday";
    days: Array<(typeof WEEKDAYS)[number]>;
    multiplier?: number;
    flat_addon_halalas?: number;
  };
  type Cfg = SpecificDate | NamedPeriod | Weekday;

  // Normalise the incoming value so a just-switched rule type never crashes the
  // sub-form before the user's first edit.
  const current = (value as Partial<Cfg> | null) ?? null;
  const scope: Cfg["scope"] = (current?.scope as Cfg["scope"]) ?? "weekday";

  const setScope = (nextScope: Cfg["scope"]) => {
    if (nextScope === "specific_date") {
      onChange({ scope: "specific_date", date: "2026-01-01", multiplier: 1.15 });
    } else if (nextScope === "named_period") {
      onChange({
        scope: "named_period",
        name: "ramadan",
        start: "2026-02-18",
        end: "2026-03-19",
        multiplier: 1.2,
      });
    } else {
      onChange({ scope: "weekday", days: ["fri", "sat"], multiplier: 1.15 });
    }
  };

  const patch = (p: Partial<Cfg>) => onChange({ ...(current ?? {}), ...p });

  return (
    <div className="flex flex-col gap-3 rounded-md border border-[var(--color-border)] bg-white p-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs">{t("ruleForm.dateSurcharge.scopeLabel")}</span>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as Cfg["scope"])}
          className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        >
          <option value="specific_date">{t("ruleForm.dateSurcharge.scope.specific_date")}</option>
          <option value="named_period">{t("ruleForm.dateSurcharge.scope.named_period")}</option>
          <option value="weekday">{t("ruleForm.dateSurcharge.scope.weekday")}</option>
        </select>
      </label>

      {scope === "specific_date" ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs">{t("ruleForm.dateSurcharge.dateLabel")}</span>
            <input
              type="date"
              value={(current as SpecificDate | null)?.date ?? ""}
              onChange={(e) => patch({ date: e.target.value } as Partial<SpecificDate>)}
              className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            />
          </label>
          <MultiplierAddonFields current={current} patch={patch} t={t} />
        </div>
      ) : null}

      {scope === "named_period" ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs">{t("ruleForm.dateSurcharge.nameLabel")}</span>
            <input
              value={(current as NamedPeriod | null)?.name ?? ""}
              onChange={(e) => patch({ name: e.target.value } as Partial<NamedPeriod>)}
              className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs">{t("ruleForm.dateSurcharge.startLabel")}</span>
            <input
              type="date"
              value={(current as NamedPeriod | null)?.start ?? ""}
              onChange={(e) => patch({ start: e.target.value } as Partial<NamedPeriod>)}
              className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs">{t("ruleForm.dateSurcharge.endLabel")}</span>
            <input
              type="date"
              value={(current as NamedPeriod | null)?.end ?? ""}
              onChange={(e) => patch({ end: e.target.value } as Partial<NamedPeriod>)}
              className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            />
          </label>
          <div className="sm:col-span-3 grid gap-2 sm:grid-cols-2">
            <MultiplierAddonFields current={current} patch={patch} t={t} />
          </div>
        </div>
      ) : null}

      {scope === "weekday" ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs">{t("ruleForm.dateSurcharge.daysLabel")}</span>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => {
              const selected = ((current as Weekday | null)?.days ?? []).includes(d);
              return (
                <label
                  key={d}
                  className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs ${
                    selected
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                      : "border-[var(--color-border)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) => {
                      const prev = (current as Weekday | null)?.days ?? [];
                      const next = e.target.checked
                        ? Array.from(new Set([...prev, d]))
                        : prev.filter((x) => x !== d);
                      patch({ days: next } as Partial<Weekday>);
                    }}
                  />
                  {t(`ruleForm.dateSurcharge.weekday.${d}`)}
                </label>
              );
            })}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <MultiplierAddonFields current={current} patch={patch} t={t} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MultiplierAddonFields({
  current,
  patch,
  t,
}: {
  current: unknown;
  patch: (p: Record<string, unknown>) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const c = (current as { multiplier?: number; flat_addon_halalas?: number } | null) ?? {};
  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs">{t("ruleForm.dateSurcharge.multiplierLabel")}</span>
        <input
          type="number"
          step="0.01"
          min={0}
          max={5}
          value={c.multiplier ?? ""}
          onChange={(e) =>
            patch({ multiplier: e.target.value === "" ? undefined : Number(e.target.value) })
          }
          className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs">{t("ruleForm.dateSurcharge.flatAddonHalalas")}</span>
        <input
          type="number"
          min={0}
          value={c.flat_addon_halalas ?? ""}
          onChange={(e) =>
            patch({
              flat_addon_halalas: e.target.value === "" ? undefined : Number(e.target.value),
            })
          }
          className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        />
      </label>
    </>
  );
}

function DurationMultiplierForm({ value, onChange }: SubFormProps) {
  const t = useTranslations("supplier.catalog");
  type Row = { applies_from_days: number; multiplier: number; label?: string };
  type Cfg = { tiers: Row[]; daily_cap_halalas?: number };
  const cfg = (value as Partial<Cfg> | null) ?? {};
  const tiers: Row[] = cfg.tiers ?? [];

  const update = (nextTiers: Row[], cap?: number | undefined) =>
    onChange({ ...cfg, tiers: nextTiers, daily_cap_halalas: cap ?? cfg.daily_cap_halalas });

  return (
    <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {t("ruleType.duration_multiplier")}
      </p>
      <ul className="flex flex-col gap-2">
        {tiers.map((r, i) => (
          <li key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs">{t("ruleForm.duration.appliesFromDays")}</span>
              <input
                type="number"
                min={1}
                value={r.applies_from_days}
                onChange={(e) =>
                  update(
                    tiers.map((x, j) =>
                      j === i ? { ...x, applies_from_days: Number(e.target.value) } : x,
                    ),
                  )
                }
                className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs">{t("ruleForm.duration.multiplier")}</span>
              <input
                type="number"
                step="0.01"
                min={0}
                max={5}
                value={r.multiplier}
                onChange={(e) =>
                  update(
                    tiers.map((x, j) =>
                      j === i ? { ...x, multiplier: Number(e.target.value) } : x,
                    ),
                  )
                }
                className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs">{t("ruleForm.duration.label")}</span>
              <input
                value={r.label ?? ""}
                onChange={(e) =>
                  update(
                    tiers.map((x, j) =>
                      j === i ? { ...x, label: e.target.value || undefined } : x,
                    ),
                  )
                }
                className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={() => update(tiers.filter((_, j) => j !== i))}
              className="self-end rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs hover:bg-[var(--color-muted)]"
            >
              {t("remove")}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() =>
          update([
            ...tiers,
            { applies_from_days: (tiers.at(-1)?.applies_from_days ?? 0) + 7, multiplier: 0.9 },
          ])
        }
        className="self-start rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs hover:bg-[var(--color-muted)]"
      >
        {t("addRow")}
      </button>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs">{t("ruleForm.duration.dailyCapHalalas")}</span>
        <input
          type="number"
          min={0}
          value={cfg.daily_cap_halalas ?? ""}
          onChange={(e) =>
            onChange({
              ...cfg,
              tiers,
              daily_cap_halalas: e.target.value === "" ? undefined : Number(e.target.value),
            })
          }
          className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        />
      </label>
    </div>
  );
}

function IssueList({ issues, kind }: { issues: string[]; kind: "client" | "server" }) {
  return (
    <ul
      role={kind === "server" ? "alert" : undefined}
      className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700"
    >
      {issues.map((i, idx) => (
        <li key={idx}>• {i}</li>
      ))}
    </ul>
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
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint ? (
        <span className="text-xs text-[var(--color-muted-foreground)]">{hint}</span>
      ) : null}
    </label>
  );
}
