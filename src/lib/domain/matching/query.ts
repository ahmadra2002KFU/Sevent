/**
 * Sevent auto-match — hard-filter query.
 *
 * This module owns the SQL-side hard filters applied before ranking:
 *   - suppliers.verification_status = 'approved' AND suppliers.is_published
 *   - supplier_categories.subcategory_id matches `ctx.subcategory_id`
 *   - base_city = ctx.event.city OR ctx.event.city = ANY(service_area_cities)
 *   - NO availability_block overlapping [ctx.event.starts_at, ctx.event.ends_at]
 *   - concurrent_event_limit - current_overlaps > 0 on the event window
 *   - at least one active package whose [min_qty, max_qty] covers
 *     ctx.event.guest_count (if provided; unfiltered when guest_count is null)
 *
 * The ranker consumes this pre-filtered list — it MUST NOT try to re-apply
 * any of these filters.
 *
 * Filter lane split (by necessity):
 *   - Filters 1–3 (approved/published, category link, city/service-area) are
 *     applied SQL-side via PostgREST `.or("base_city.eq.<city>,service_area_cities.cs.{<city>}")`.
 *   - Availability overlap (4) and capacity (5) are fetched with a single
 *     bulk query keyed by supplier_id and filtered in TypeScript because
 *     PostgREST does not express `starts_at < :ends AND ends_at > :starts`
 *     across a joined table cleanly without a DB-side view. Documented here;
 *     the volume is bounded (<= tens of suppliers per subcategory/city in
 *     the pilot).
 *   - Package qty coverage (6) is applied while we collect package data — we
 *     keep a supplier only if at least one active package in the subcategory
 *     matches the guest-count window (or any package exists when guest_count
 *     is null).
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AutoMatchCandidate, AutoMatchContext } from "./autoMatch";
import { computeResponseRate30d } from "@/lib/domain/responsiveness";

const INVITE_WINDOW_DAYS = 14;

export async function fetchAutoMatchCandidates(
  ctx: AutoMatchContext,
): Promise<AutoMatchCandidate[]> {
  const supabase = await createSupabaseServerClient();

  // ---------------------------------------------------------------------------
  // Step 1. Pull supplier IDs linked to the target subcategory.
  // ---------------------------------------------------------------------------
  const catLinkRes = await supabase
    .from("supplier_categories")
    .select("supplier_id")
    .eq("subcategory_id", ctx.subcategory_id);

  if (catLinkRes.error) return [];
  const supplierIds = Array.from(
    new Set(((catLinkRes.data ?? []) as Array<{ supplier_id: string }>).map((r) => r.supplier_id)),
  );
  if (supplierIds.length === 0) return [];

  // ---------------------------------------------------------------------------
  // Step 2. Load those suppliers with the approval + publish + city filters.
  // ---------------------------------------------------------------------------
  const city = ctx.event.city;
  // PostgREST .or clause: same-city OR service-area contains-city OR
  // supplier declares nationwide service. The `serves_all_ksa` branch lets a
  // supplier cover every KSA city without enumerating them in the 15-pick list.
  const cityFilter = `base_city.eq.${city},service_area_cities.cs.{${city}},serves_all_ksa.eq.true`;

  const suppliersRes = await supabase
    .from("suppliers")
    .select(
      "id, business_name, slug, base_city, service_area_cities, serves_all_ksa, concurrent_event_limit, verification_status, is_published",
    )
    .in("id", supplierIds)
    .eq("verification_status", "approved")
    .eq("is_published", true)
    .or(cityFilter);

  if (suppliersRes.error) return [];
  const suppliers = (suppliersRes.data ?? []) as Array<{
    id: string;
    business_name: string;
    slug: string;
    base_city: string;
    service_area_cities: string[] | null;
    serves_all_ksa: boolean | null;
    concurrent_event_limit: number;
    verification_status: string;
    is_published: boolean;
  }>;
  if (suppliers.length === 0) return [];

  const filteredIds = suppliers.map((s) => s.id);

  // ---------------------------------------------------------------------------
  // Step 3. Load availability blocks for these suppliers that could overlap
  //         the event window. `starts_at < event.ends_at AND ends_at > event.starts_at`
  //         is the canonical half-open overlap check.
  // ---------------------------------------------------------------------------
  const availRes = await supabase
    .from("availability_blocks")
    .select("supplier_id, starts_at, ends_at, reason, released_at")
    .in("supplier_id", filteredIds)
    .is("released_at", null)
    .lt("starts_at", ctx.event.ends_at)
    .gt("ends_at", ctx.event.starts_at);

  if (availRes.error) return [];
  const avail = (availRes.data ?? []) as Array<{
    supplier_id: string;
    starts_at: string;
    ends_at: string;
    reason: string;
    released_at: string | null;
  }>;

  const blockedSuppliers = new Set<string>();
  const overlapCount = new Map<string, number>();
  for (const a of avail) {
    // ANY active block (manual_block, soft_hold, booked) within window blocks the supplier.
    // Soft-holds + booked entries additionally count toward concurrent-event capacity —
    // but in Sprint 3 any active overlap at all disqualifies a candidate, so we treat
    // them uniformly here. We still track the count to expose `active_overlaps` for
    // the ranker's transparency and to keep the ctx shape in sync with Lane 3 expectations.
    blockedSuppliers.add(a.supplier_id);
    if (a.reason === "soft_hold" || a.reason === "booked") {
      overlapCount.set(a.supplier_id, (overlapCount.get(a.supplier_id) ?? 0) + 1);
    }
  }

  // ---------------------------------------------------------------------------
  // Step 4. Load active packages in the target subcategory for our survivors.
  // ---------------------------------------------------------------------------
  const pkgRes = await supabase
    .from("packages")
    .select("id, supplier_id, min_qty, max_qty, base_price_halalas, is_active, subcategory_id")
    .in("supplier_id", filteredIds)
    .eq("subcategory_id", ctx.subcategory_id)
    .eq("is_active", true);

  if (pkgRes.error) return [];
  const pkgs = (pkgRes.data ?? []) as Array<{
    id: string;
    supplier_id: string;
    min_qty: number;
    max_qty: number | null;
    base_price_halalas: number;
    is_active: boolean;
    subcategory_id: string;
  }>;

  const pkgsBySupplier = new Map<string, AutoMatchCandidate["packages"]>();
  for (const p of pkgs) {
    const arr = pkgsBySupplier.get(p.supplier_id) ?? [];
    arr.push({
      id: p.id,
      min_qty: p.min_qty,
      max_qty: p.max_qty,
      base_price_halalas: p.base_price_halalas,
    });
    pkgsBySupplier.set(p.supplier_id, arr);
  }

  // ---------------------------------------------------------------------------
  // Step 5. Load invite counts (last 14d) for rotation scoring.
  // ---------------------------------------------------------------------------
  const invitesCutoff = new Date(
    Date.now() - INVITE_WINDOW_DAYS * 24 * 3600 * 1000,
  ).toISOString();

  const inviteRes = await supabase
    .from("rfq_invites")
    .select("supplier_id")
    .in("supplier_id", filteredIds)
    .gt("sent_at", invitesCutoff);

  const inviteCountBySupplier = new Map<string, number>();
  if (!inviteRes.error) {
    for (const row of (inviteRes.data ?? []) as Array<{ supplier_id: string }>) {
      inviteCountBySupplier.set(
        row.supplier_id,
        (inviteCountBySupplier.get(row.supplier_id) ?? 0) + 1,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Step 6. Assemble candidates — apply availability, capacity, qty filters.
  // ---------------------------------------------------------------------------
  const guestCount = ctx.event.guest_count;
  const survivors: AutoMatchCandidate[] = [];

  for (const s of suppliers) {
    // Availability overlap disqualifies.
    if (blockedSuppliers.has(s.id)) continue;

    // Capacity check — soft_hold + booked overlaps must be strictly below limit.
    const activeOverlaps = overlapCount.get(s.id) ?? 0;
    if (activeOverlaps >= s.concurrent_event_limit) continue;

    // Must have at least one active package in this subcategory.
    const supplierPackages = pkgsBySupplier.get(s.id) ?? [];
    if (supplierPackages.length === 0) continue;

    // When guest_count is provided, at least one package's qty range must cover it.
    if (guestCount !== null) {
      const anyCovers = supplierPackages.some((p) => {
        const min = p.min_qty;
        const max = p.max_qty ?? Number.POSITIVE_INFINITY;
        return guestCount >= min && guestCount <= max;
      });
      if (!anyCovers) continue;
    }

    survivors.push({
      supplier_id: s.id,
      business_name: s.business_name,
      slug: s.slug,
      base_city: s.base_city,
      service_area_cities: s.service_area_cities ?? [],
      serves_all_ksa: Boolean(s.serves_all_ksa),
      concurrent_event_limit: s.concurrent_event_limit,
      active_overlaps: activeOverlaps,
      packages: supplierPackages,
      response_rate_30d: null,
      invites_last_14d: inviteCountBySupplier.get(s.id) ?? 0,
    });
  }

  // ---------------------------------------------------------------------------
  // Step 7. Attach response-rate-30d per survivor (service-role aggregation).
  // ---------------------------------------------------------------------------
  const ratesForSurvivors = await Promise.all(
    survivors.map((c) => computeResponseRate30d(c.supplier_id)),
  );
  for (let i = 0; i < survivors.length; i += 1) {
    survivors[i].response_rate_30d = ratesForSurvivors[i];
  }

  return survivors;
}
