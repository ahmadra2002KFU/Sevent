"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileCustomizer } from "./ProfileCustomizer";
import { PortfolioManager, type PortfolioItem } from "../portfolio/PortfolioManager";

type ProfilePageTabsProps = {
  initialAccentColor: string;
  initialSectionOrder: string[];
  initialPortfolioItems: PortfolioItem[];
  initialBio: string | null;
};

const TAB_KEYS = ["customize", "portfolio"] as const;
type TabKey = (typeof TAB_KEYS)[number];

function isTabKey(value: string | null): value is TabKey {
  return value === "customize" || value === "portfolio";
}

/**
 * Wraps the two profile-edit surfaces (customizer + portfolio) in a tab pane.
 *
 * The active tab is URL-driven via `?tab=` so deep links work — in particular,
 * the per-row "Edit" button on the portfolio row of the customizer just links
 * to `?tab=portfolio` and lands the user on the same page's portfolio editor.
 * No separate /supplier/portfolio route exists; this is the only edit surface.
 */
export function ProfilePageTabs({
  initialAccentColor,
  initialSectionOrder,
  initialPortfolioItems,
  initialBio,
}: ProfilePageTabsProps) {
  const t = useTranslations("supplier.profile.tabs");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab");
  const activeTab: TabKey = isTabKey(tabParam) ? tabParam : "customize";

  function handleChange(value: string) {
    if (!isTabKey(value)) return;
    const params = new URLSearchParams(searchParams.toString());
    if (value === "customize") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleChange}
      className="w-full gap-4"
    >
      <TabsList className="self-start">
        <TabsTrigger value="customize">{t("customize")}</TabsTrigger>
        <TabsTrigger value="portfolio">{t("portfolio")}</TabsTrigger>
      </TabsList>
      <TabsContent value="customize">
        <ProfileCustomizer
          initialAccentColor={initialAccentColor}
          initialSectionOrder={initialSectionOrder}
          initialBio={initialBio}
        />
      </TabsContent>
      <TabsContent value="portfolio">
        <PortfolioManager initialItems={initialPortfolioItems} />
      </TabsContent>
    </Tabs>
  );
}
