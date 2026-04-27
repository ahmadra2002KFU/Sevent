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
  createSignedDownloadUrl,
} from "@/lib/supabase/storage";
import { PreviewProfileButton } from "@/components/ui-ext/PreviewProfileButton";
import { ProfilePageTabs } from "./ProfilePageTabs";
import type { PortfolioItem } from "../portfolio/PortfolioManager";
import { loadOnboardingBootstrap } from "@/app/(onboarding)/supplier/onboarding/loader";

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

export default async function SupplierProfilePage() {
  // The Profile page is the unified hub: customize + portfolio + settings
  // (the wizard, formerly its own /supplier/onboarding route). The
  // `supplier.profile.access` gate admits in_onboarding / pending_review /
  // approved / rejected suppliers; the customize + portfolio tabs are
  // shown-disabled for non-approved states (see ProfilePageTabs).
  const { decision, admin, user } = await requireAccess(
    "supplier.profile.access",
  );
  const supplierId = decision.supplierId;
  const isApproved = decision.state === "supplier.approved";
  const t = await getTranslations("supplier.profile.customizer");

  // Wizard bootstrap is needed for the Settings tab regardless of state.
  const bootstrap = await loadOnboardingBootstrap({
    admin,
    supplierId,
    userId: user.id,
  });

  // Customize + portfolio data are only rendered for approved suppliers, so
  // we skip the read for unapproved states to save a couple of round-trips.
  const { data: supplier } = isApproved && supplierId
    ? await admin
        .from("suppliers")
        .select("accent_color, profile_sections_order, bio, slug")
        .eq("id", supplierId)
        .maybeSingle()
    : { data: null };

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

  const supplierRow = (supplier as {
    accent_color: string | null;
    profile_sections_order: string[] | null;
    bio: string | null;
    slug: string | null;
  } | null) ?? {
    accent_color: null,
    profile_sections_order: null,
    bio: bootstrap.supplier?.bio ?? null,
    slug: bootstrap.supplier?.slug ?? null,
  };

  // Portfolio media is only loaded when approved; unapproved suppliers see
  // the disabled Portfolio tab and never need the signed URLs.
  let portfolioItems: PortfolioItem[] = [];
  if (isApproved) {
    const { data: mediaRows } = await admin
      .from("supplier_media")
      .select("id, kind, file_path, title, sort_order")
      .eq("supplier_id", supplierId)
      .in("kind", ["photo", "document"])
      .order("sort_order", { ascending: true });

    portfolioItems = await Promise.all(
      (
        (mediaRows as Array<{
          id: string;
          kind: string;
          file_path: string;
          title: string | null;
          sort_order: number;
        }> | null) ?? []
      ).map(async (row) => ({
        id: row.id,
        kind: row.kind === "document" ? "document" : "photo",
        public_url: await createSignedDownloadUrl(
          admin,
          STORAGE_BUCKETS.portfolio,
          row.file_path,
        ),
        file_path: row.file_path,
        title: row.title,
        sort_order: Number(row.sort_order ?? 0),
      })),
    );
  }

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
