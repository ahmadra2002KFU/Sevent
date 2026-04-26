"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileCustomizer } from "./ProfileCustomizer";
import { PortfolioManager, type PortfolioItem } from "../portfolio/PortfolioManager";

type ProfilePageTabsProps = {
  initialAccentColor: string;
  initialSectionOrder: string[];
  initialPortfolioItems: PortfolioItem[];
};

/**
 * Wraps the two profile-edit surfaces (customizer + portfolio) in a tab pane.
 * Both inner components are already client components with their own action
 * state, so the tabs do not own any cross-tab state — switching tabs preserves
 * each tab's local edits via Radix's `forceMount`-free default behavior.
 */
export function ProfilePageTabs({
  initialAccentColor,
  initialSectionOrder,
  initialPortfolioItems,
}: ProfilePageTabsProps) {
  const t = useTranslations("supplier.profile.tabs");

  return (
    <Tabs defaultValue="customize" className="w-full gap-4">
      <TabsList className="self-start">
        <TabsTrigger value="customize">{t("customize")}</TabsTrigger>
        <TabsTrigger value="portfolio">{t("portfolio")}</TabsTrigger>
      </TabsList>
      <TabsContent value="customize">
        <ProfileCustomizer
          initialAccentColor={initialAccentColor}
          initialSectionOrder={initialSectionOrder}
        />
      </TabsContent>
      <TabsContent value="portfolio">
        <PortfolioManager initialItems={initialPortfolioItems} />
      </TabsContent>
    </Tabs>
  );
}
