/**
 * Slug collision helper for suppliers.slug. Walks suffixes `-2`, `-3`, … until
 * it finds one that is not yet taken. RLS governs reads via the caller's client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { slugifyBusinessName } from "@/lib/domain/onboarding";

const MAX_ATTEMPTS = 50;

export async function uniqueSupplierSlug(
  client: SupabaseClient,
  businessName: string,
  opts: { excludeSupplierId?: string } = {},
): Promise<string> {
  const base = slugifyBusinessName(businessName) || "supplier";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    let query = client
      .from("suppliers")
      .select("id", { count: "exact", head: true })
      .eq("slug", candidate);
    if (opts.excludeSupplierId) {
      query = query.neq("id", opts.excludeSupplierId);
    }
    const { count, error } = await query;
    if (error) {
      throw new Error(`uniqueSupplierSlug: lookup failed: ${error.message}`);
    }
    if (!count) {
      return candidate;
    }
  }
  throw new Error(
    `uniqueSupplierSlug: could not find a free slug for "${businessName}" after ${MAX_ATTEMPTS} attempts`,
  );
}
