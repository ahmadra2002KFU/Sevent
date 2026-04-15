"use server";

/**
 * Lane 2 · Sprint 2 — supplier catalog server actions.
 *
 * Writes packages + pricing_rules. Every money input goes through
 * `sarToHalalas` before persistence; every pricing_rules.config_jsonb is
 * validated via `parsePricingRuleConfig(rule_type, …)` at the action boundary
 * so invalid JSON can never reach the DB.
 */

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";
import { sarToHalalas } from "@/lib/domain/money";
import { PackageFormInput, PackageRow } from "@/lib/domain/packages";
import {
  PRICING_RULE_TYPES,
  parsePricingRuleConfig,
  type PricingRuleType,
} from "@/lib/domain/pricing/rules";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CatalogActionResult =
  | { ok: true }
  | { ok: false; error: string; issues?: string[] };

const CATALOG_PATH = "/supplier/catalog";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function resolveSupplierId(
  supabase: SupabaseServerClient,
): Promise<{ supplierId: string } | { error: string }> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { error: "You must be signed in to manage the catalog." };
  }
  const { data, error } = await supabase
    .from("suppliers")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (error) return { error: `Supplier lookup failed: ${error.message}` };
  if (!data) return { error: "Complete onboarding before adding packages." };
  return { supplierId: data.id as string };
}

function zodIssues(err: ZodError): string[] {
  return err.issues.map((i) =>
    i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message,
  );
}

function revalidateCatalog(slug?: string) {
  revalidatePath(CATALOG_PATH);
  if (slug) revalidatePath(`/s/${slug}`);
}

async function supplierSlug(
  supabase: SupabaseServerClient,
  supplierId: string,
): Promise<string | undefined> {
  const { data } = await supabase
    .from("suppliers")
    .select("slug")
    .eq("id", supplierId)
    .maybeSingle();
  return (data?.slug as string | undefined) ?? undefined;
}

// ===========================================================================
// Packages CRUD
// ===========================================================================

export async function upsertPackageAction(
  input: unknown,
): Promise<CatalogActionResult> {
  const parsed = PackageFormInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      issues: zodIssues(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const resolved = await resolveSupplierId(supabase);
  if ("error" in resolved) return { ok: false, error: resolved.error };
  const supplierId = resolved.supplierId;

  // Convert SAR decimal → halalas at the action boundary and re-validate the
  // halalas-shaped row before touching the DB. This is the single source of
  // truth for SAR↔halalas conversion (money.ts).
  let base_price_halalas: number;
  try {
    base_price_halalas = sarToHalalas(parsed.data.base_price_sar);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Invalid price.",
    };
  }

  const row = {
    id: parsed.data.id,
    supplier_id: supplierId,
    subcategory_id: parsed.data.subcategory_id,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    base_price_halalas,
    currency: "SAR" as const,
    unit: parsed.data.unit,
    min_qty: parsed.data.min_qty,
    max_qty: parsed.data.max_qty ?? null,
    from_price_visible: parsed.data.from_price_visible,
    is_active: parsed.data.is_active,
  };

  const check = PackageRow.safeParse(row);
  if (!check.success) {
    return {
      ok: false,
      error: "Package values are invalid.",
      issues: zodIssues(check.error),
    };
  }

  if (row.id) {
    const { error } = await supabase
      .from("packages")
      .update({
        subcategory_id: row.subcategory_id,
        name: row.name,
        description: row.description,
        base_price_halalas: row.base_price_halalas,
        currency: row.currency,
        unit: row.unit,
        min_qty: row.min_qty,
        max_qty: row.max_qty,
        from_price_visible: row.from_price_visible,
        is_active: row.is_active,
      })
      .eq("id", row.id)
      .eq("supplier_id", supplierId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("packages").insert({
      supplier_id: row.supplier_id,
      subcategory_id: row.subcategory_id,
      name: row.name,
      description: row.description,
      base_price_halalas: row.base_price_halalas,
      currency: row.currency,
      unit: row.unit,
      min_qty: row.min_qty,
      max_qty: row.max_qty,
      from_price_visible: row.from_price_visible,
      is_active: row.is_active,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidateCatalog(await supplierSlug(supabase, supplierId));
  return { ok: true };
}

export async function togglePackageActiveAction(
  packageId: string,
  next: boolean,
): Promise<CatalogActionResult> {
  if (!packageId) return { ok: false, error: "Missing package id." };
  const supabase = await createSupabaseServerClient();
  const resolved = await resolveSupplierId(supabase);
  if ("error" in resolved) return { ok: false, error: resolved.error };

  const { error } = await supabase
    .from("packages")
    .update({ is_active: next })
    .eq("id", packageId)
    .eq("supplier_id", resolved.supplierId);
  if (error) return { ok: false, error: error.message };
  revalidateCatalog(await supplierSlug(supabase, resolved.supplierId));
  return { ok: true };
}

export async function deletePackageAction(
  packageId: string,
): Promise<CatalogActionResult> {
  if (!packageId) return { ok: false, error: "Missing package id." };
  const supabase = await createSupabaseServerClient();
  const resolved = await resolveSupplierId(supabase);
  if ("error" in resolved) return { ok: false, error: resolved.error };

  const { error } = await supabase
    .from("packages")
    .delete()
    .eq("id", packageId)
    .eq("supplier_id", resolved.supplierId);
  if (error) return { ok: false, error: error.message };
  revalidateCatalog(await supplierSlug(supabase, resolved.supplierId));
  return { ok: true };
}

// ===========================================================================
// Pricing rules CRUD
// ===========================================================================

const RuleMetaSchema = z.object({
  id: z.string().uuid().optional(),
  package_id: z.string().uuid().nullable().optional(),
  rule_type: z.enum(PRICING_RULE_TYPES),
  priority: z.coerce.number().int().default(100),
  version: z.coerce.number().int().positive().default(1),
  is_active: z.coerce.boolean().default(true),
  valid_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  valid_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export type UpsertPricingRuleInput = z.infer<typeof RuleMetaSchema> & {
  /** Raw (unparsed) per-type config payload; validated against rule_type. */
  config: unknown;
};

export async function upsertPricingRuleAction(
  input: UpsertPricingRuleInput,
): Promise<CatalogActionResult> {
  const metaParsed = RuleMetaSchema.safeParse(input);
  if (!metaParsed.success) {
    return {
      ok: false,
      error: "Rule metadata is invalid.",
      issues: zodIssues(metaParsed.error),
    };
  }
  const meta = metaParsed.data;

  // Dispatch the config through the shared per-type parser. This is the
  // interface contract with Sprint 4's pricing engine — invalid configs must
  // never reach config_jsonb.
  let config_jsonb: unknown;
  try {
    config_jsonb = parsePricingRuleConfig(
      meta.rule_type as PricingRuleType,
      input.config,
    );
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        ok: false,
        error: "Rule configuration is invalid.",
        issues: zodIssues(err),
      };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Invalid rule config.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const resolved = await resolveSupplierId(supabase);
  if ("error" in resolved) return { ok: false, error: resolved.error };
  const supplierId = resolved.supplierId;

  // If package_id is present, make sure it belongs to this supplier. Two-hop
  // check so an attacker cannot attach a rule to another supplier's package
  // even if RLS on pricing_rules is misconfigured.
  if (meta.package_id) {
    const { data: pkg, error: pkgErr } = await supabase
      .from("packages")
      .select("id")
      .eq("id", meta.package_id)
      .eq("supplier_id", supplierId)
      .maybeSingle();
    if (pkgErr) return { ok: false, error: pkgErr.message };
    if (!pkg) return { ok: false, error: "Package not found." };
  }

  const payload = {
    supplier_id: supplierId,
    package_id: meta.package_id ?? null,
    rule_type: meta.rule_type,
    config_jsonb,
    priority: meta.priority,
    version: meta.version,
    is_active: meta.is_active,
    valid_from: meta.valid_from ?? null,
    valid_to: meta.valid_to ?? null,
    currency: "SAR" as const,
  };

  if (meta.id) {
    const { error } = await supabase
      .from("pricing_rules")
      .update(payload)
      .eq("id", meta.id)
      .eq("supplier_id", supplierId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("pricing_rules").insert(payload);
    if (error) return { ok: false, error: error.message };
  }

  revalidateCatalog(await supplierSlug(supabase, supplierId));
  return { ok: true };
}

export async function togglePricingRuleActiveAction(
  ruleId: string,
  next: boolean,
): Promise<CatalogActionResult> {
  if (!ruleId) return { ok: false, error: "Missing rule id." };
  const supabase = await createSupabaseServerClient();
  const resolved = await resolveSupplierId(supabase);
  if ("error" in resolved) return { ok: false, error: resolved.error };

  const { error } = await supabase
    .from("pricing_rules")
    .update({ is_active: next })
    .eq("id", ruleId)
    .eq("supplier_id", resolved.supplierId);
  if (error) return { ok: false, error: error.message };
  revalidateCatalog(await supplierSlug(supabase, resolved.supplierId));
  return { ok: true };
}

export async function deletePricingRuleAction(
  ruleId: string,
): Promise<CatalogActionResult> {
  if (!ruleId) return { ok: false, error: "Missing rule id." };
  const supabase = await createSupabaseServerClient();
  const resolved = await resolveSupplierId(supabase);
  if ("error" in resolved) return { ok: false, error: resolved.error };

  const { error } = await supabase
    .from("pricing_rules")
    .delete()
    .eq("id", ruleId)
    .eq("supplier_id", resolved.supplierId);
  if (error) return { ok: false, error: error.message };
  revalidateCatalog(await supplierSlug(supabase, resolved.supplierId));
  return { ok: true };
}
