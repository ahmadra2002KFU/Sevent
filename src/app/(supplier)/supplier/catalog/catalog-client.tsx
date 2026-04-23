"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusPill } from "@/components/ui-ext/StatusPill";
import { EmptyState } from "@/components/ui-ext/EmptyState";

type Props = {
  supplierId: string;
  packages: PackageRow[];
  rules: PricingRuleRow[];
  subcategories: CatalogSubcategory[];
};

function formatSubcategoryLabel(
  sub: CatalogSubcategory,
  locale: string,
): string {
  const childName =
    locale === "ar" && sub.name_ar ? sub.name_ar : sub.name_en;
  const parent = sub.parent_name_en
    ? locale === "ar" && sub.parent_name_ar
      ? sub.parent_name_ar
      : sub.parent_name_en
    : null;
  return parent ? `${parent} · ${childName}` : childName;
}

type PackageEditor =
  | { kind: "closed" }
  | { kind: "new" }
  | { kind: "edit"; pkg: PackageRow };

type RuleEditor =
  | { kind: "closed" }
  | { kind: "new" }
  | { kind: "edit"; rule: PricingRuleRow };

export function CatalogClient({
  supplierId,
  packages,
  rules,
  subcategories,
}: Props) {
  const t = useTranslations("supplier.catalog");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [pkgEditor, setPkgEditor] = useState<PackageEditor>({ kind: "closed" });
  const [ruleEditor, setRuleEditor] = useState<RuleEditor>({ kind: "closed" });
  const [banner, setBanner] = useState<{
    kind: "success" | "error";
    msg: string;
  } | null>(null);
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
        msg: result.issues?.length
          ? `${result.error}: ${result.issues.join("; ")}`
          : result.error,
      });
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {banner ? (
        <Alert variant={banner.kind === "error" ? "destructive" : "default"}>
          <AlertDescription>{banner.msg}</AlertDescription>
        </Alert>
      ) : null}

      {/* ================================== Packages ================================== */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b">
          <div>
            <CardTitle>{t("packagesHeading")}</CardTitle>
            <CardDescription>{t("subtitle")}</CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setBanner(null);
              setPkgEditor({ kind: "new" });
            }}
          >
            <Plus />
            {t("newPackage")}
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {packages.length === 0 ? (
            <EmptyState icon={Package} title={t("noPackages")} />
          ) : (
            <div className="-mx-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("packageForm.nameLabel")}</TableHead>
                    <TableHead>{t("packageForm.subcategoryLabel")}</TableHead>
                    <TableHead>{t("packageForm.unitLabel")}</TableHead>
                    <TableHead>{t("packageForm.basePriceLabel")}</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>{t("activeToggle")}</TableHead>
                    <TableHead aria-hidden />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packages.map((p) => {
                    const sub = subcategoryById.get(p.subcategory_id);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium text-brand-navy-900">
                          {p.name}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {sub ? formatSubcategoryLabel(sub, locale) : ""}
                        </TableCell>
                        <TableCell className="text-xs">
                          {t(`packageForm.unit.${p.unit}`)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {t("priceFrom", {
                            price: formatHalalas(p.base_price_halalas),
                          })}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {t("qtyRange", {
                            min: p.min_qty,
                            max: p.max_qty ?? "∞",
                          })}
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={p.is_active}
                            disabled={isPending}
                            onCheckedChange={(next) => {
                              startTransition(async () => {
                                const r = await togglePackageActiveAction(
                                  p.id,
                                  Boolean(next),
                                );
                                handleResult(r, t("savedPackage"));
                              });
                            }}
                            aria-label={t("activeToggle")}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                setBanner(null);
                                setPkgEditor({ kind: "edit", pkg: p });
                              }}
                              aria-label={t("edit")}
                            >
                              <Pencil />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  disabled={isPending}
                                  className="text-semantic-danger-500 hover:bg-semantic-danger-100/40"
                                  aria-label={t("delete")}
                                >
                                  <Trash2 />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    {t("delete")}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t("confirmDeletePackage")}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>
                                    {tCommon("cancel")}
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      startTransition(async () => {
                                        const r = await deletePackageAction(p.id);
                                        handleResult(r, t("deletedPackage"));
                                      })
                                    }
                                  >
                                    {tCommon("confirm")}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Package dialog (new/edit) */}
      <Dialog
        open={pkgEditor.kind !== "closed"}
        onOpenChange={(open) => {
          if (!open) setPkgEditor({ kind: "closed" });
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {pkgEditor.kind === "edit" ? t("edit") : t("newPackage")}
            </DialogTitle>
            <DialogDescription>{t("subtitle")}</DialogDescription>
          </DialogHeader>
          {pkgEditor.kind !== "closed" ? (
            <PackageForm
              subcategories={subcategories}
              initial={pkgEditor.kind === "edit" ? pkgEditor.pkg : null}
              onCancel={() => setPkgEditor({ kind: "closed" })}
              onDone={(r) => handleResult(r, t("savedPackage"))}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ================================= Pricing rules ============================ */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b">
          <div>
            <CardTitle>{t("rulesHeading")}</CardTitle>
            <CardDescription>{t("rulesSubheading")}</CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setBanner(null);
              setRuleEditor({ kind: "new" });
            }}
          >
            <Plus />
            {t("newRule")}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-6">
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
            onDelete={(r) =>
              startTransition(async () => {
                const result = await deletePricingRuleAction(r.id);
                handleResult(result, t("deletedRule"));
              })
            }
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
                onDelete={(r) =>
                  startTransition(async () => {
                    const result = await deletePricingRuleAction(r.id);
                    handleResult(result, t("deletedRule"));
                  })
                }
                isPending={isPending}
              />
            );
          })}

          {rules.length === 0 ? (
            <EmptyState title={t("noRules")} />
          ) : null}
        </CardContent>
      </Card>

      {/* Rule dialog (new/edit) */}
      <Dialog
        open={ruleEditor.kind !== "closed"}
        onOpenChange={(open) => {
          if (!open) setRuleEditor({ kind: "closed" });
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {ruleEditor.kind === "edit" ? t("edit") : t("newRule")}
            </DialogTitle>
            <DialogDescription>{t("rulesSubheading")}</DialogDescription>
          </DialogHeader>
          {ruleEditor.kind !== "closed" ? (
            <RuleForm
              supplierId={supplierId}
              packages={packages}
              initial={ruleEditor.kind === "edit" ? ruleEditor.rule : null}
              onCancel={() => setRuleEditor({ kind: "closed" })}
              onDone={(r) => handleResult(r, t("savedRule"))}
            />
          ) : null}
        </DialogContent>
      </Dialog>
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
  /**
   * Invoked AFTER the user confirms in the AlertDialog — callers no longer
   * gate this with their own window.confirm(). The component owns the
   * confirmation UI.
   */
  onDelete: (r: PricingRuleRow) => void;
  isPending: boolean;
}) {
  const t = useTranslations("supplier.catalog");
  const tCommon = useTranslations("common");
  if (rules.length === 0) return null;
  return (
    <section
      aria-label={heading}
      className="overflow-hidden rounded-lg border border-border"
    >
      <header className="border-b border-border bg-muted/40 px-4 py-2.5">
        <p className="text-sm font-semibold text-brand-navy-900">{heading}</p>
      </header>
      <ul className="flex flex-col divide-y divide-border">
        {rules.map((r) => {
          const type = r.rule_type as PricingRuleType;
          return (
            <li
              key={r.id}
              className="flex flex-wrap items-start justify-between gap-3 p-4"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{t(`ruleType.${type}`)}</Badge>
                  <StatusPill
                    status={r.is_active ? "approved" : "pending"}
                    label={r.is_active ? t("activeToggle") : t("inactive")}
                  />
                  <span className="text-xs text-muted-foreground">
                    {t("priority")}: {r.priority} · v{r.version}
                  </span>
                  {r.valid_from || r.valid_to ? (
                    <span className="text-xs text-muted-foreground">
                      {t("validWindow", {
                        from: r.valid_from ?? "…",
                        to: r.valid_to ?? "…",
                      })}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {r.package_id
                    ? t("ruleScopePackage", {
                        name: packageById.get(r.package_id)?.name ?? r.package_id,
                      })
                    : t("ruleScopeSupplier")}
                </p>
                <pre className="overflow-x-auto rounded-md bg-muted/40 p-2 text-[10px] leading-relaxed">
                  {JSON.stringify(r.config_jsonb, null, 2)}
                </pre>
              </div>
              <div className="flex items-center gap-1">
                <Checkbox
                  checked={r.is_active}
                  disabled={isPending}
                  onCheckedChange={(next) => onToggle(r, Boolean(next))}
                  aria-label={t("activeToggle")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onEdit(r)}
                  aria-label={t("edit")}
                >
                  <Pencil />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={isPending}
                      className="text-semantic-danger-500 hover:bg-semantic-danger-100/40"
                      aria-label={t("delete")}
                    >
                      <Trash2 />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("delete")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("confirmDeleteRule")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>
                        {tCommon("cancel")}
                      </AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDelete(r)}>
                        {tCommon("confirm")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
