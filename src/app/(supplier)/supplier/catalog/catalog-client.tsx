"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { formatHalalas } from "@/lib/domain/money";
import type { PackageRow, PricingRuleRow } from "@/lib/supabase/types";
import type { PricingRuleType } from "@/lib/domain/pricing/rules";
import type { CatalogSubcategory } from "./loader";
import { PackageForm } from "./package-form";
import { RuleForm } from "./rule-form";
import {
  deletePackageAction,
  deletePricingRuleAction,
  togglePackageActiveAction,
  togglePricingRuleActiveAction,
  type CatalogActionResult,
} from "./actions";

type Props = {
  supplierId: string;
  packages: PackageRow[];
  rules: PricingRuleRow[];
  subcategories: CatalogSubcategory[];
};

type PackageEditor =
  | { kind: "closed" }
  | { kind: "new" }
  | { kind: "edit"; pkg: PackageRow };

type RuleEditor =
  | { kind: "closed" }
  | { kind: "new" }
  | { kind: "edit"; rule: PricingRuleRow };

export function CatalogClient({ supplierId, packages, rules, subcategories }: Props) {
  const t = useTranslations("supplier.catalog");
  const [pkgEditor, setPkgEditor] = useState<PackageEditor>({ kind: "closed" });
  const [ruleEditor, setRuleEditor] = useState<RuleEditor>({ kind: "closed" });
  const [banner, setBanner] = useState<{ kind: "success" | "error"; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const subcategoryById = useMemo(() => {
    const m = new Map<string, CatalogSubcategory>();
    for (const s of subcategories) m.set(s.id, s);
    return m;
  }, [subcategories]);

  const packageById = useMemo(() => {
    const m = new Map<string, PackageRow>();
    for (const p of packages) m.set(p.id, p);
    return m;
  }, [packages]);

  const rulesByPackage = useMemo(() => {
    const m = new Map<string, PricingRuleRow[]>();
    const supplierWide: PricingRuleRow[] = [];
    for (const r of rules) {
      if (r.package_id) {
        const list = m.get(r.package_id) ?? [];
        list.push(r);
        m.set(r.package_id, list);
      } else {
        supplierWide.push(r);
      }
    }
    return { byPackage: m, supplierWide };
  }, [rules]);

  const handleResult = (result: CatalogActionResult, successMsg: string) => {
    if (result.ok) {
      setBanner({ kind: "success", msg: successMsg });
      setPkgEditor({ kind: "closed" });
      setRuleEditor({ kind: "closed" });
    } else {
      setBanner({
        kind: "error",
        msg: result.issues?.length ? `${result.error}: ${result.issues.join("; ")}` : result.error,
      });
    }
  };

  return (
    <div className="flex flex-col gap-10">
      {banner ? (
        <div
          role={banner.kind === "error" ? "alert" : "status"}
          className={
            banner.kind === "error"
              ? "rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              : "rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          }
        >
          {banner.msg}
        </div>
      ) : null}

      {/* ================================== Packages ================================== */}
      <section className="flex flex-col gap-4">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">
            {t("packagesHeading")}
          </h2>
          {pkgEditor.kind === "closed" ? (
            <button
              type="button"
              onClick={() => {
                setBanner(null);
                setPkgEditor({ kind: "new" });
              }}
              className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90"
            >
              {t("newPackage")}
            </button>
          ) : null}
        </header>

        {pkgEditor.kind !== "closed" ? (
          <PackageForm
            subcategories={subcategories}
            initial={pkgEditor.kind === "edit" ? pkgEditor.pkg : null}
            onCancel={() => setPkgEditor({ kind: "closed" })}
            onDone={(r) => handleResult(r, t("savedPackage"))}
          />
        ) : null}

        {packages.length === 0 ? (
          <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)]/40 p-4 text-sm text-[var(--color-muted-foreground)]">
            {t("noPackages")}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] bg-white">
            {packages.map((p) => {
              const sub = subcategoryById.get(p.subcategory_id);
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex flex-col gap-1">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      {sub
                        ? `${sub.parent_name_en ? `${sub.parent_name_en} · ` : ""}${sub.name_en}`
                        : ""}{" "}
                      · {t(`packageForm.unit.${p.unit}`)} · {t("priceFrom", { price: formatHalalas(p.base_price_halalas) })}
                    </p>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      {t("qtyRange", {
                        min: p.min_qty,
                        max: p.max_qty ?? "∞",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={p.is_active}
                        disabled={isPending}
                        onChange={(e) => {
                          const next = e.target.checked;
                          startTransition(async () => {
                            const r = await togglePackageActiveAction(p.id, next);
                            handleResult(r, t("savedPackage"));
                          });
                        }}
                      />
                      {t("activeToggle")}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setBanner(null);
                        setPkgEditor({ kind: "edit", pkg: p });
                      }}
                      className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs hover:bg-[var(--color-muted)]"
                    >
                      {t("edit")}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        if (typeof window !== "undefined" && !window.confirm(t("confirmDeletePackage"))) return;
                        startTransition(async () => {
                          const r = await deletePackageAction(p.id);
                          handleResult(r, t("deletedPackage"));
                        });
                      }}
                      className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 hover:bg-red-100 disabled:opacity-60"
                    >
                      {t("delete")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ================================= Pricing rules ============================ */}
      <section className="flex flex-col gap-4">
        <header className="flex items-center justify-between">
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold tracking-tight">
              {t("rulesHeading")}
            </h2>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {t("rulesSubheading")}
            </p>
          </div>
          {ruleEditor.kind === "closed" ? (
            <button
              type="button"
              onClick={() => {
                setBanner(null);
                setRuleEditor({ kind: "new" });
              }}
              className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90"
            >
              {t("newRule")}
            </button>
          ) : null}
        </header>

        {ruleEditor.kind !== "closed" ? (
          <RuleForm
            supplierId={supplierId}
            packages={packages}
            initial={ruleEditor.kind === "edit" ? ruleEditor.rule : null}
            onCancel={() => setRuleEditor({ kind: "closed" })}
            onDone={(r) => handleResult(r, t("savedRule"))}
          />
        ) : null}

        <RuleGroupView
          heading={t("rulesSupplierWide")}
          rules={rulesByPackage.supplierWide}
          packageById={packageById}
          onEdit={(r) => {
            setBanner(null);
            setRuleEditor({ kind: "edit", rule: r });
          }}
          onToggle={(r, next) =>
            startTransition(async () => {
              const result = await togglePricingRuleActiveAction(r.id, next);
              handleResult(result, t("savedRule"));
            })
          }
          onDelete={(r) => {
            if (typeof window !== "undefined" && !window.confirm(t("confirmDeleteRule"))) return;
            startTransition(async () => {
              const result = await deletePricingRuleAction(r.id);
              handleResult(result, t("deletedRule"));
            });
          }}
          isPending={isPending}
        />

        {packages.map((p) => {
          const list = rulesByPackage.byPackage.get(p.id) ?? [];
          if (list.length === 0) return null;
          return (
            <RuleGroupView
              key={p.id}
              heading={t("rulesForPackage", { name: p.name })}
              rules={list}
              packageById={packageById}
              onEdit={(r) => {
                setBanner(null);
                setRuleEditor({ kind: "edit", rule: r });
              }}
              onToggle={(r, next) =>
                startTransition(async () => {
                  const result = await togglePricingRuleActiveAction(r.id, next);
                  handleResult(result, t("savedRule"));
                })
              }
              onDelete={(r) => {
                if (typeof window !== "undefined" && !window.confirm(t("confirmDeleteRule"))) return;
                startTransition(async () => {
                  const result = await deletePricingRuleAction(r.id);
                  handleResult(result, t("deletedRule"));
                });
              }}
              isPending={isPending}
            />
          );
        })}

        {rules.length === 0 ? (
          <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)]/40 p-4 text-sm text-[var(--color-muted-foreground)]">
            {t("noRules")}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function RuleGroupView({
  heading,
  rules,
  packageById,
  onEdit,
  onToggle,
  onDelete,
  isPending,
}: {
  heading: string;
  rules: PricingRuleRow[];
  packageById: Map<string, PackageRow>;
  onEdit: (r: PricingRuleRow) => void;
  onToggle: (r: PricingRuleRow, next: boolean) => void;
  onDelete: (r: PricingRuleRow) => void;
  isPending: boolean;
}) {
  const t = useTranslations("supplier.catalog");
  if (rules.length === 0) return null;
  return (
    <section
      aria-label={heading}
      className="rounded-lg border border-[var(--color-border)] bg-white"
    >
      <header className="border-b border-[var(--color-border)] p-3">
        <p className="text-sm font-medium">{heading}</p>
      </header>
      <ul className="divide-y divide-[var(--color-border)]">
        {rules.map((r) => {
          const type = r.rule_type as PricingRuleType;
          return (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="flex flex-col gap-1 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-muted)] px-2 py-0.5 text-xs">
                    {t(`ruleType.${type}`)}
                  </span>
                  <span className="text-xs text-[var(--color-muted-foreground)]">
                    {t("priority")}: {r.priority} · v{r.version}
                  </span>
                  {r.valid_from || r.valid_to ? (
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      {t("validWindow", {
                        from: r.valid_from ?? "…",
                        to: r.valid_to ?? "…",
                      })}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {r.package_id
                    ? t("ruleScopePackage", {
                        name: packageById.get(r.package_id)?.name ?? r.package_id,
                      })
                    : t("ruleScopeSupplier")}
                </p>
                <pre className="overflow-x-auto rounded-md bg-[var(--color-muted)]/40 p-2 text-[10px] leading-relaxed">
                  {JSON.stringify(r.config_jsonb, null, 2)}
                </pre>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={r.is_active}
                    disabled={isPending}
                    onChange={(e) => onToggle(r, e.target.checked)}
                  />
                  {t("activeToggle")}
                </label>
                <button
                  type="button"
                  onClick={() => onEdit(r)}
                  className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs hover:bg-[var(--color-muted)]"
                >
                  {t("edit")}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => onDelete(r)}
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 hover:bg-red-100 disabled:opacity-60"
                >
                  {t("delete")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
