/**
 * Sprint 4 Lane 2 — supplier quote builder (server loader).
 *
 * Resolves the route `[id]` (which is the rfq_invites.id — mirrors the sibling
 * detail page) to the supplier's invite row, then loads every dependency the
 * client form needs:
 *   - invite + rfq + event (drives context + redirects)
 *   - existing quote + latest revision (pre-fills the form for edits)
 *   - supplier's packages + active pricing rules (feeds composePrice)
 *
 * Redirects:
 *   - no auth → sign-in
 *   - no supplier row → /supplier/onboarding
 *   - invite not for this supplier / not found → 404
 *   - existing quote is terminal (accepted/rejected/expired/withdrawn) →
 *     back to the invite detail with a read-only message
 *
 * Pre-computes a rule-engine draft snapshot via composePrice so the form
 * renders sensible defaults instead of empty fields. For free-form resumes
 * (existing revision with source=free_form) we pre-fill from the revision
 * itself so the supplier picks up where they left off.
 */

import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAccess } from "@/lib/auth/access";
import { fmtDateTime, type SupportedLocale } from "@/lib/domain/formatDate";
import { cityNameFor } from "@/lib/domain/cities";
import { categoryName } from "@/lib/domain/taxonomy";
import {
  composePrice,
  type PricingPackageInput,
  type PricingRuleInput,
} from "@/lib/domain/pricing/engine";
import { getDistanceKm } from "@/lib/domain/pricing/distance";
import type { PricingRuleType } from "@/lib/domain/pricing/rules";
import {
  QUOTE_ENGINE_VERSION,
  type QuoteSnapshot,
  type QuoteSource,
  type QuoteUnit,
} from "@/lib/domain/quote";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { QuoteBuilderForm } from "./QuoteBuilderForm";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

type InviteRow = {
  id: string;
  rfq_id: string;
  supplier_id: string;
  status: "invited" | "declined" | "quoted" | "withdrawn";
  rfqs: {
    id: string;
    event_id: string;
    subcategory_id: string;
    events: {
      id: string;
      organizer_id: string;
      city: string;
      starts_at: string;
      ends_at: string;
      guest_count: number | null;
      venue_location: unknown | null;
    } | null;
    categories: {
      id: string;
      slug: string;
      name_en: string;
      name_ar: string | null;
    } | null;
  } | null;
};

type QuoteRow = {
  id: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired" | "withdrawn";
  source: QuoteSource;
  quoted_package_id: string | null;
  current_revision_id: string | null;
};

type RevisionRow = {
  id: string;
  quote_id: string;
  version: number;
  snapshot_jsonb: unknown;
  created_at: string;
};

type PackageRow = {
  id: string;
  name: string;
  base_price_halalas: number;
  unit: QuoteUnit;
  min_qty: number;
  max_qty: number | null;
  is_active: boolean;
  subcategory_id: string;
};

type RuleRow = {
  id: string;
  rule_type: PricingRuleType;
  config_jsonb: unknown;
  priority: number;
  version: number;
  package_id: string | null;
  valid_from: string | null;
  valid_to: string | null;
};

const TERMINAL_STATUSES = new Set(["accepted", "rejected", "expired", "withdrawn"]);

export default async function SupplierQuoteBuilderPage({ params }: PageProps) {
  const { id: inviteId } = await params;
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations("supplier.quote");

  // 1. Gate — only approved suppliers can respond to RFQs.
  const { decision, admin } = await requireAccess("supplier.rfqs.respond");
  const supplierId = decision.supplierId;
  if (!supplierId) redirect("/supplier/onboarding");

  // 3. Invite + RFQ + event.
  const { data: inviteData } = await admin
    .from("rfq_invites")
    .select(
      `id, rfq_id, supplier_id, status,
       rfqs (
         id, event_id, subcategory_id,
         events ( id, organizer_id, city, starts_at, ends_at, guest_count, venue_location ),
         categories!rfqs_subcategory_id_fkey ( id, slug, name_en, name_ar )
       )`,
    )
    .eq("id", inviteId)
    .maybeSingle();

  if (!inviteData) notFound();
  const invite = inviteData as unknown as InviteRow;
  if (invite.supplier_id !== supplierId) notFound();
  const rfq = invite.rfqs;
  if (!rfq || !rfq.events) notFound();
  const event = rfq.events;

  // Invite must be in a state where quoting is still allowed.
  if (invite.status !== "invited" && invite.status !== "quoted") {
    redirect(`/supplier/rfqs/${inviteId}`);
  }

  // 4. Existing quote, packages, pricing rules — independent siblings; fan
  //    out in one round-trip block.
  const today = new Date().toISOString().slice(0, 10);
  const [quoteRes, pkgsRes, rulesRes] = await Promise.all([
    admin
      .from("quotes")
      .select("id, status, source, quoted_package_id, current_revision_id")
      .eq("rfq_id", rfq.id)
      .eq("supplier_id", supplierId)
      .maybeSingle(),
    admin
      .from("packages")
      .select("id, name, base_price_halalas, unit, min_qty, max_qty, is_active, subcategory_id")
      .eq("supplier_id", supplierId)
      .eq("is_active", true),
    admin
      .from("pricing_rules")
      .select("id, rule_type, config_jsonb, priority, version, package_id, is_active, valid_from, valid_to")
      .eq("supplier_id", supplierId)
      .eq("is_active", true),
  ]);

  const quote = (quoteRes.data as QuoteRow | null) ?? null;

  // Redirect on terminal quote states — the RPC would reject anyway, but a
  // redirect beats a form-level error for a read-only state.
  if (quote && TERMINAL_STATUSES.has(quote.status)) {
    redirect(`/supplier/rfqs/${inviteId}`);
  }

  // 5. Latest revision (for form pre-fill). Real dependency on quote.id.
  let latestRevision: RevisionRow | null = null;
  if (quote?.current_revision_id) {
    const { data: revRow } = await admin
      .from("quote_revisions")
      .select("id, quote_id, version, snapshot_jsonb, created_at")
      .eq("id", quote.current_revision_id)
      .maybeSingle();
    latestRevision = (revRow as RevisionRow | null) ?? null;
  }

  const packages = ((pkgsRes.data as PackageRow[] | null) ?? []).filter(
    (p) => p.subcategory_id === rfq.subcategory_id,
  );
  const activeRules = ((rulesRes.data as RuleRow[] | null) ?? []).filter((r) => {
    if (r.valid_from && r.valid_from > today) return false;
    if (r.valid_to && r.valid_to < today) return false;
    return true;
  });

  // 8. Pick a package: prefer the quoted package on an existing draft, then
  //    the first active package in the subcategory. If there are no packages
  //    the supplier cannot author a rule-engine quote — render a hint.
  const selectedPackage =
    (quote?.quoted_package_id && packages.find((p) => p.id === quote.quoted_package_id)) ||
    packages[0] ||
    null;

  // 9. Pre-computed draft snapshot. Two sources:
  //    - existing revision → use its snapshot verbatim (lets the supplier
  //      resume editing with everything they last sent).
  //    - no revision → feed the first package through composePrice for a
  //      sensible rule-engine-drafted starting point. If the supplier has no
  //      packages yet we fall back to an empty free-form snapshot.
  let initialSnapshot: QuoteSnapshot;
  if (latestRevision) {
    initialSnapshot = parseSnapshot(latestRevision.snapshot_jsonb) ?? emptyFreeForm();
  } else if (selectedPackage) {
    const venueCoords = extractLatLng(event.venue_location);
    const distance_km = await safeDistanceKm(admin, {
      supplier_id: supplierId,
      venue_lat: venueCoords.lat,
      venue_lng: venueCoords.lng,
    });
    const pkgInput: PricingPackageInput = {
      id: selectedPackage.id,
      name: selectedPackage.name,
      base_price_halalas: Number(selectedPackage.base_price_halalas),
      unit: selectedPackage.unit,
      min_qty: selectedPackage.min_qty,
      max_qty: selectedPackage.max_qty,
    };
    const ruleInputs: PricingRuleInput[] = activeRules
      .filter((r) => r.package_id === null || r.package_id === selectedPackage.id)
      .map((r) => ({
        id: r.id,
        rule_type: r.rule_type,
        config: r.config_jsonb,
        priority: r.priority,
        version: r.version,
        package_id: r.package_id,
      }));
    const computed = composePrice({
      event: {
        id: event.id,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        guest_count: event.guest_count,
        venue_lat: venueCoords.lat,
        venue_lng: venueCoords.lng,
      },
      pkg: pkgInput,
      qty: selectedPackage.min_qty,
      rules: ruleInputs,
      distance_km,
      source: "rule_engine",
      addons: {
        setup_fee_halalas: 0,
        teardown_fee_halalas: 0,
        travel_fee_halalas_override: null,
        inclusions: [],
        exclusions: [],
        cancellation_terms: "",
        payment_schedule: "",
        deposit_pct: 0,
        notes: null,
        expires_at: null,
      },
    });
    initialSnapshot = computed.snapshot;
  } else {
    initialSnapshot = emptyFreeForm();
  }

  const locked = quote ? TERMINAL_STATUSES.has(quote.status) : false;

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={`${categoryName(rfq.categories, locale) || "RFQ"} · ${cityNameFor(
          event.city,
          locale,
        )} · ${fmtDateTime(event.starts_at, locale)} → ${fmtDateTime(
          event.ends_at,
          locale,
        )}`}
      />

      <p className="-mt-2 text-sm text-muted-foreground">{t("intro")}</p>

      <Card>
        <CardContent className="p-6">
          <QuoteBuilderForm
            inviteId={invite.id}
            rfqId={rfq.id}
            supplierId={supplierId}
            initialSnapshot={initialSnapshot}
            locked={locked}
          />
        </CardContent>
      </Card>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Helpers — narrow, page-local.
// ---------------------------------------------------------------------------

async function safeDistanceKm(
  admin: SupabaseClient,
  params: { supplier_id: string; venue_lat: number | null; venue_lng: number | null },
): Promise<number | null> {
  try {
    return await getDistanceKm({
      admin,
      supplier_id: params.supplier_id,
      venue_lat: params.venue_lat,
      venue_lng: params.venue_lng,
    });
  } catch {
    return null;
  }
}

function extractLatLng(value: unknown): { lat: number | null; lng: number | null } {
  if (!value) return { lat: null, lng: null };
  if (typeof value === "object" && value !== null) {
    const v = value as { coordinates?: unknown; type?: string };
    if (v.type === "Point" && Array.isArray(v.coordinates) && v.coordinates.length >= 2) {
      const [lng, lat] = v.coordinates as [number, number];
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  }
  return { lat: null, lng: null };
}

function emptyFreeForm(): QuoteSnapshot {
  return {
    engine_version: QUOTE_ENGINE_VERSION,
    currency: "SAR",
    source: "free_form",
    line_items: [],
    subtotal_halalas: 0,
    travel_fee_halalas: 0,
    setup_fee_halalas: 0,
    teardown_fee_halalas: 0,
    vat_rate_pct: 0,
    vat_amount_halalas: 0,
    prices_include_vat: false,
    total_halalas: 0,
    deposit_pct: 0,
    payment_schedule: "",
    cancellation_terms: "",
    inclusions: [],
    exclusions: [],
    notes: null,
    expires_at: null,
    inputs_digest: "",
  };
}

/**
 * Best-effort parser: the DB stores snapshots as jsonb and we trust their
 * shape. If a future migration drifts, we fall back to an empty snapshot so
 * the page still renders and the supplier can author fresh values.
 */
function parseSnapshot(value: unknown): QuoteSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<QuoteSnapshot>;
  if (!v.engine_version || !v.currency || !Array.isArray(v.line_items)) {
    return null;
  }
  return v as QuoteSnapshot;
}

