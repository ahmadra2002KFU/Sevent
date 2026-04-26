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
import { ProfilePageTabs } from "./ProfilePageTabs";
import type { PortfolioItem } from "../portfolio/PortfolioManager";

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

export default async function SupplierProfileCustomizePage() {
  const { decision, admin } = await requireAccess(
    "supplier.profile.customize",
  );
  const supplierId = decision.supplierId;
  const t = await getTranslations("supplier.profile.customizer");

  const { data: supplier } = supplierId
    ? await admin
        .from("suppliers")
        .select("accent_color, profile_sections_order")
        .eq("id", supplierId)
        .maybeSingle()
    : { data: null };

  if (!supplier || !supplierId) {
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

  const supplierRow = supplier as {
    accent_color: string | null;
    profile_sections_order: string[] | null;
  };

  const { data: mediaRows } = await admin
    .from("supplier_media")
    .select("id, kind, file_path, title, sort_order")
    .eq("supplier_id", supplierId)
    .in("kind", ["photo", "document"])
    .order("sort_order", { ascending: true });

  const portfolioItems: PortfolioItem[] = await Promise.all(
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

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />
      <ProfilePageTabs
        initialAccentColor={coerceAccentColor(supplierRow.accent_color)}
        initialSectionOrder={coerceSectionsOrder(
          supplierRow.profile_sections_order,
        )}
        initialPortfolioItems={portfolioItems}
      />
    </section>
  );
}
