"use client";

import { useMemo, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { KSA_CITIES, type KsaRegionSlug } from "@/lib/domain/cities";

type Props = {
  /** Currently-selected city slugs. */
  value: string[];
  /** Toggle a city in/out of the selection. The picker never closes itself. */
  onToggle: (slug: string) => void;
  /** A slug to omit from the list — typically the supplier's base city. */
  excludeSlug?: string;
  /** Cap on selections; unselected rows go disabled once it's reached. */
  max?: number;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Multi-select city picker. Unlike {@link CityCombobox} (single-select, closes
 * on pick), this stays open after every selection and shows a checkmark beside
 * each chosen city, so the supplier can tick through several cities in one go.
 */
export function CityMultiSelect({
  value,
  onToggle,
  excludeSlug,
  max,
  placeholder,
  ariaLabel,
  disabled,
  className,
}: Props) {
  const t = useTranslations("common.cityCombobox");
  const locale = useLocale();
  const isAr = locale === "ar";
  const [open, setOpen] = useState(false);

  const selectedSet = useMemo(() => new Set(value), [value]);
  const atMax = typeof max === "number" && value.length >= max;

  const grouped = useMemo(() => {
    type Bucket = {
      regionLabel: string;
      items: Array<(typeof KSA_CITIES)[number]>;
    };
    const byRegion = new Map<KsaRegionSlug, Bucket>();
    for (const city of KSA_CITIES) {
      if (city.slug === excludeSlug) continue;
      if (!byRegion.has(city.region)) {
        byRegion.set(city.region, {
          regionLabel: t(`region.${city.region}`),
          items: [],
        });
      }
      byRegion.get(city.region)!.items.push(city);
    }
    // Regional capital first inside each region; rest alphabetical by locale.
    for (const g of byRegion.values()) {
      g.items.sort((a, b) => {
        if (a.is_regional_capital !== b.is_regional_capital) {
          return a.is_regional_capital ? -1 : 1;
        }
        const an = isAr ? a.name_ar : a.name_en;
        const bn = isAr ? b.name_ar : b.name_en;
        return an.localeCompare(bn, locale);
      });
    }
    return Array.from(byRegion.values()).sort((a, b) =>
      a.regionLabel.localeCompare(b.regionLabel, locale),
    );
  }, [locale, isAr, t, excludeSlug]);

  const triggerLabel =
    value.length > 0
      ? t("selectedCount", { count: value.length })
      : placeholder ?? t("multiPlaceholder");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(
            "h-11 min-h-[44px] w-full justify-between text-sm font-normal",
            className,
          )}
        >
          <span className={cn(value.length === 0 && "text-muted-foreground")}>
            {triggerLabel}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(28rem,90vw)] p-0" align="start">
        <Command>
          <CommandInput placeholder={t("searchPlaceholder")} />
          <CommandList>
            <CommandEmpty>{t("empty")}</CommandEmpty>
            {grouped.map((g) => (
              <CommandGroup key={g.regionLabel} heading={g.regionLabel}>
                {g.items.map((c) => {
                  const label = isAr ? c.name_ar : c.name_en;
                  const isSelected = selectedSet.has(c.slug);
                  const searchValue = `${c.slug} ${c.name_en} ${c.name_ar}`;
                  return (
                    <CommandItem
                      key={c.slug}
                      value={searchValue}
                      data-checked={isSelected ? "true" : undefined}
                      disabled={!isSelected && atMax}
                      // No setOpen(false): multi-select stays open so the
                      // supplier can keep ticking cities one after another.
                      onSelect={() => onToggle(c.slug)}
                    >
                      <span>{label}</span>
                      {c.is_regional_capital ? (
                        <span className="ms-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {t("capitalBadge")}
                        </span>
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default CityMultiSelect;
