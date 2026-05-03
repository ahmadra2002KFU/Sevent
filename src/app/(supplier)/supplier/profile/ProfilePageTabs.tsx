"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { PortfolioItem } from "../portfolio/PortfolioManager";
import type { OnboardingBootstrap } from "@/app/(onboarding)/supplier/onboarding/loader";

// ProfileCustomizer + PortfolioManager pull in @dnd-kit (sortable + utilities,
// ~150 KB gzip combined). Both are gated behind `isApproved`, so unapproved
// suppliers — i.e. everyone in onboarding — never render them. Defer the
// chunks so they only download when an approved supplier actually opens
// these tabs.
const ProfileCustomizer = dynamic(
  () => import("./ProfileCustomizer").then((m) => ({ default: m.ProfileCustomizer })),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 w-full animate-pulse rounded-md bg-muted" />
    ),
  },
);

const PortfolioManager = dynamic(
  () =>
    import("../portfolio/PortfolioManager").then((m) => ({
      default: m.PortfolioManager,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 w-full animate-pulse rounded-md bg-muted" />
    ),
  },
);

// The wizard pulls motion/react, react-hook-form, zod resolver, and ~8 picker
// subcomponents — heavy enough that shipping it on first paint of the profile
// page added seconds to load. Defer to a chunk that only downloads when the
// Settings tab is the first thing the user opens (or they navigate to it).
const OnboardingWizard = dynamic(
  () =>
    import("@/app/(onboarding)/supplier/onboarding/wizard").then((m) => ({
      default: m.OnboardingWizard,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-72 w-full" />
      </div>
    ),
  },
);

type ProfilePageTabsProps = {
  isApproved: boolean;
  initialAccentColor: string;
  initialSectionOrder: string[];
  initialPortfolioItems: PortfolioItem[];
  initialBio: string | null;
  bootstrap: OnboardingBootstrap | null;
};

const TAB_KEYS = ["customize", "portfolio", "settings"] as const;
type TabKey = (typeof TAB_KEYS)[number];

function isTabKey(value: string | null): value is TabKey {
  return value === "customize" || value === "portfolio" || value === "settings";
}

/**
 * Wraps the three profile-edit surfaces (customizer + portfolio + settings/wizard)
 * in a tab pane.
 *
 * - Approved suppliers see all three tabs; default = customize.
 * - Unapproved suppliers (in_onboarding / pending_review / rejected) see all
 *   three tabs but customize + portfolio are visually disabled and unclickable
 *   with a tooltip explaining approval is required. Default = settings, since
 *   that's the only actionable surface for them.
 *
 * Active tab is URL-driven via `?tab=` so deep links + per-row Edit buttons
 * (e.g. portfolio Edit → ?tab=portfolio) work without a full nav.
 */
export function ProfilePageTabs({
  isApproved,
  initialAccentColor,
  initialSectionOrder,
  initialPortfolioItems,
  initialBio,
  bootstrap,
}: ProfilePageTabsProps) {
  const t = useTranslations("supplier.profile.tabs");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab");
  const requestedTab: TabKey = isTabKey(tabParam) ? tabParam : "customize";

  // Approved suppliers default to customize; unapproved default to settings
  // (the only tab that's actionable for them). If an unapproved user lands
  // on ?tab=customize or ?tab=portfolio (e.g., from a stale link), bounce
  // the local state to settings — they can't operate those tabs anyway.
  const defaultTab: TabKey = isApproved ? "customize" : "settings";
  const activeTab: TabKey =
    !isApproved && requestedTab !== "settings" ? defaultTab : requestedTab;

  function handleChange(value: string) {
    if (!isTabKey(value)) return;
    // Belt-and-braces: ignore attempts to navigate to disabled tabs.
    if (!isApproved && value !== "settings") return;
    const params = new URLSearchParams(searchParams.toString());
    if (value === defaultTab) {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const lockedTooltip = t("disabledHint");

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleChange}
      className="w-full gap-4"
    >
      {/* Horizontal-scroll wrapper: TabsList is `inline-flex w-fit`, so the
          three triggers + lock icons can exceed a narrow viewport. The
          wrapper lets the row scroll instead of overflowing the page. */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList className="self-start">
          <TabsTrigger
            value="customize"
            disabled={!isApproved}
            title={!isApproved ? lockedTooltip : undefined}
            aria-label={
              !isApproved ? `${t("customize")} — ${lockedTooltip}` : undefined
            }
            className={!isApproved ? "gap-1.5" : undefined}
          >
            {!isApproved ? <Lock className="size-3" aria-hidden /> : null}
            {t("customize")}
          </TabsTrigger>
          <TabsTrigger
            value="portfolio"
            disabled={!isApproved}
            title={!isApproved ? lockedTooltip : undefined}
            aria-label={
              !isApproved ? `${t("portfolio")} — ${lockedTooltip}` : undefined
            }
            className={!isApproved ? "gap-1.5" : undefined}
          >
            {!isApproved ? <Lock className="size-3" aria-hidden /> : null}
            {t("portfolio")}
          </TabsTrigger>
          <TabsTrigger value="settings">{t("settings")}</TabsTrigger>
        </TabsList>
      </div>
      {isApproved ? (
        <>
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
        </>
      ) : null}
      <TabsContent value="settings">
        {bootstrap ? (
          <OnboardingWizard bootstrap={bootstrap} />
        ) : (
          // Approved supplier landed on Customize first, so the server skipped
          // the wizard bootstrap fetch. Clicking Settings already triggered a
          // router.replace → the next render will arrive with bootstrap. Show
          // a short skeleton instead of a blank panel.
          <div className="flex flex-col gap-4">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-72 w-full" />
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
