/**
 * Slug collision helper for suppliers.slug. Fetches every slug already taken
 * that begins with the slugified base name in a single round-trip, then walks
 * suffixes `-2`, `-3`, … in memory until it finds one that is not yet taken.
 * RLS governs reads via the caller's client.
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

  // Pull every slug that could collide in one query, then resolve in memory.
  // `like` with an escaped base avoids LIKE metacharacter surprises if the
  // slugifier ever lets `%` or `_` through; slugifyBusinessName currently
  // strips them, but defending the query is cheap.
  const escapedBase = base.replace(/[\\%_]/g, (ch) => `\\${ch}`);
  let query = client
    .from("suppliers")
    .select("slug")
    .like("slug", `${escapedBase}%`);
  if (opts.excludeSupplierId) {
    query = query.neq("id", opts.excludeSupplierId);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`uniqueSupplierSlug: lookup failed: ${error.message}`);
  }

  const taken = new Set<string>(
    (data ?? [])
      .map((row) => (row as { slug: string | null }).slug)
      .filter((s): s is string => typeof s === "string"),
  );

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `uniqueSupplierSlug: could not find a free slug for "${businessName}" after ${MAX_ATTEMPTS} attempts`,
  );
}
