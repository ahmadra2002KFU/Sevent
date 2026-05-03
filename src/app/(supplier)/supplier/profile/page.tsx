import { getTranslations } from "next-intl/server";
import { requireAccess } from "@/lib/auth/access";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { UserCog } from "lucide-react";
import {
  ACCENT_HEX_VALUES,
  DEFAULT_ACCENT_HEX,
} from "@/lib/domain/taxonomy";
import {
  STORAGE_BUCKETS,
  createSignedDownloadUrls,
} from "@/lib/supabase/storage";
import { PreviewProfileButton } from "@/components/ui-ext/PreviewProfileButton";
import { ProfilePageTabs } from "./ProfilePageTabs";
import type { PortfolioItem } from "../portfolio/PortfolioManager";
import {
  getSupplierRowForUserCached,
  loadOnboardingBootstrap,
} from "@/app/(onboarding)/supplier/onboarding/loader";

export const dynamic = "force-dynamic";

const DEFAULT_SECTIONS_ORDER = ["bio", "packages", "portfolio", "reviews"];

/**
 * Narrow the DB-stored accent_color to a palette member. The DB CHECK only
 * validates hex shape, so a legacy row could hold a color that's no longer
 * in the curated palette; in that case we fall back to the brand default so
 * the editor still renders a valid selection.
 */
function coerceAccentColor(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_ACCENT_HEX;
  return (ACCENT_HEX_VALUES as readonly string[]).includes(raw)
    ? raw
    : DEFAULT_ACCENT_HEX;
}

/**
 * Narrow the DB-stored profile_sections_order to the four expected keys in
 * some order. Any drift (missing key, extra key, duplicates) falls back to
 * the canonical order so the editor always starts from a valid state.
 */
function coerceSectionsOrder(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...DEFAULT_SECTIONS_ORDER];
  const values = raw.filter((v): v is string => typeof v === "string");
  const unique = Array.from(new Set(values));
  const expected = new Set(DEFAULT_SECTIONS_ORDER);
  if (unique.length !== DEFAULT_SECTIONS_ORDER.length) {
    return [...DEFAULT_SECTIONS_ORDER];
  }
  if (!unique.every((v) => expected.has(v))) {
    return [...DEFAULT_SECTIONS_ORDER];
  }
  return unique;
}

export default async function SupplierProfilePage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string | string[] }>;
}) {
  // The Profile page is the unified hub: customize + portfolio + settings
  // (the wizard, formerly its own /supplier/onboarding route). The
  // `supplier.profile.access` gate admits in_onboarding / pending_review /
  // approved / rejected suppliers; the customize + portfolio tabs are
  // shown-disabled for non-approved states (see ProfilePageTabs).
  const [{ decision, admin, user }, sp, t] = await Promise.all([
    requireAccess("supplier.profile.access"),
    searchParams ?? Promise.resolve(undefined),
    getTranslations("supplier.profile.customizer"),
  ]);
  const supplierId = decision.supplierId;
  const isApproved = decision.state === "supplier.approved";
  const tabParamRaw = sp?.tab;
  const tabParam = Array.isArray(tabParamRaw) ? tabParamRaw[0] : tabParamRaw;

  // Bootstrap is only consumed by the wizard inside the Settings tab. Approved
  // suppliers default to Customize and only need bootstrap if they navigate
  // to ?tab=settings — skip it on initial load to avoid 4 wasted DB round
  // trips. Unapproved suppliers always default to Settings, so they need it.
  const needsBootstrap = !isApproved || tabParam === "settings";

  // Fetch the wide `suppliers` row once via the per-request cache. The
  // onboarding bootstrap reuses this row (passed via options) instead of
  // issuing its own SELECT.
  const supplierRowPromise = supplierId
    ? getSupplierRowForUserCached(admin, user.id, supplierId)
    : Promise.resolve(null);

  // Portfolio media is only loaded when approved; unapproved suppliers see
  // the disabled Portfolio tab and never need the signed URLs.
  const portfolioMediaPromise =
    isApproved && supplierId
      ? admin
          .from("supplier_media")
          .select("id, kind, file_path, title, sort_order")
          .eq("supplier_id", supplierId)
          .in("kind", ["photo", "document"])
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: null });

  const [supplier, { data: mediaRows }] = await Promise.all([
    supplierRowPromise,
    portfolioMediaPromise,
  ]);

  const bootstrap = needsBootstrap
    ? await loadOnboardingBootstrap({
        admin,
        supplierId,
        userId: user.id,
        // Reuse the wide row we just fetched; loader skips its own SELECT.
        supplierRow: supplier,
      })
    : null;

  // Defensive: if a user with profile.access reaches us before a suppliers
  // row exists (race window between auth trigger + onboarding setup), bounce
  // them to the path picker so they enter the proper flow.
  if (!supplierId) {
    return (
      <section className="flex flex-col gap-6">
        <PageHeader title={t("title")} description={t("description")} />
        <EmptyState
          icon={UserCog}
          title={t("empty.title")}
          description={t("empty.description")}
        />
      </section>
    );
  }

  const supplierRow = supplier ?? {
    accent_color: null,
    profile_sections_order: null,
    bio: bootstrap?.supplier?.bio ?? null,
    slug: bootstrap?.supplier?.slug ?? null,
  };

  // Batch all portfolio signed URLs into a single storage round-trip instead
  // of one per row. With 50 portfolio items this drops 50 sequential HTTPS
  // calls to 1.
  const rawMediaRows =
    (mediaRows as Array<{
      id: string;
      kind: string;
      file_path: string;
      title: string | null;
      sort_order: number;
    }> | null) ?? [];
  // Skip the storage round-trip entirely when there's nothing to sign — no
  // portfolio rows means an empty Map, no HTTPS call to Supabase Storage.
  const portfolioUrlMap =
    rawMediaRows.length === 0
      ? new Map<string, string>()
      : await createSignedDownloadUrls(
          admin,
          STORAGE_BUCKETS.portfolio,
          rawMediaRows.map((r) => r.file_path),
        );
  const portfolioItems: PortfolioItem[] = rawMediaRows
    .map((row): PortfolioItem | null => {
      const url = portfolioUrlMap.get(row.file_path);
      if (!url) return null;
      return {
        id: row.id,
        kind: row.kind === "document" ? "document" : "photo",
        public_url: url,
        file_path: row.file_path,
        title: row.title,
        sort_order: Number(row.sort_order ?? 0),
      };
    })
    .filter((row): row is PortfolioItem => row !== null);

  // Header copy adapts to the supplier's state. Approved sees the
  // customize-focused copy; everyone else sees a profile-completion framing.
  const headerTitle = isApproved
    ? t("title")
    : t("titlePending");
  const headerDescription = isApproved
    ? t("description")
    : t("descriptionPending");

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title={headerTitle}
        description={headerDescription}
        actions={
          isApproved && supplierRow.slug ? (
            <PreviewProfileButton slug={supplierRow.slug} />
          ) : null
        }
      />
      <ProfilePageTabs
        isApproved={isApproved}
        initialAccentColor={coerceAccentColor(supplierRow.accent_color)}
        initialSectionOrder={coerceSectionsOrder(
          supplierRow.profile_sections_order,
        )}
        initialPortfolioItems={portfolioItems}
        initialBio={supplierRow.bio}
        bootstrap={bootstrap}
      />
    </section>
  );
}
