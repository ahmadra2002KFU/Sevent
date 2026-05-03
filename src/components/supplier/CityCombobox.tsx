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

type PrependItem = {
  /** Search-matchable label and rendered text. */
  label: string;
  /** Optional helper line shown beneath the bold label. */
  description?: string;
  /** Whether this option is currently the active selection. */
  selected?: boolean;
  onSelect: () => void;
};

type Props = {
  value: string | null | undefined;
  onChange: (slug: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  /**
   * Optional bold item rendered at the very top of the dropdown — used by
   * the supplier service-area picker to surface "Serves all KSA" inside the
   * city picker instead of as a separate toggle.
   */
  prependItem?: PrependItem;
};

export function CityCombobox({
  value,
  onChange,
  placeholder,
  ariaLabel,
  disabled,
  className,
  prependItem,
}: Props) {
  const t = useTranslations("common.cityCombobox");
  const locale = useLocale();
  const isAr = locale === "ar";
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    type Bucket = { regionLabel: string; items: Array<(typeof KSA_CITIES)[number]> };
    const byRegion = new Map<KsaRegionSlug, Bucket>();
    for (const city of KSA_CITIES) {
      if (!byRegion.has(city.region)) {
        const regionLabel = t(`region.${city.region}`);
        byRegion.set(city.region, { regionLabel, items: [] });
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
  }, [locale, isAr, t]);

  const selected = KSA_CITIES.find((c) => c.slug === value) ?? null;
  const selectedLabel = selected
    ? isAr
      ? selected.name_ar
      : selected.name_en
    : null;

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
          <span className={cn(!selected && "text-muted-foreground")}>
            {selectedLabel ?? placeholder ?? t("placeholder")}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(28rem,90vw)] p-0" align="start">
        <Command>
          <CommandInput placeholder={t("searchPlaceholder")} />
          <CommandList>
            <CommandEmpty>{t("empty")}</CommandEmpty>
            {prependItem ? (
              <CommandGroup>
                <CommandItem
                  value={prependItem.label}
                  data-checked={prependItem.selected ? "true" : undefined}
                  onSelect={() => {
                    prependItem.onSelect();
                    setOpen(false);
                  }}
                  className="flex flex-col items-start gap-0.5 py-2.5"
                >
                  <span className="text-sm font-bold text-brand-navy-900">
                    {prependItem.label}
                  </span>
                  {prependItem.description ? (
                    <span className="text-xs text-muted-foreground">
                      {prependItem.description}
                    </span>
                  ) : null}
                </CommandItem>
              </CommandGroup>
            ) : null}
            {grouped.map((g) => (
              <CommandGroup key={g.regionLabel} heading={g.regionLabel}>
                {g.items.map((c) => {
                  const label = isAr ? c.name_ar : c.name_en;
                  const searchValue = `${c.slug} ${c.name_en} ${c.name_ar}`;
                  return (
                    <CommandItem
                      key={c.slug}
                      value={searchValue}
                      data-checked={value === c.slug ? "true" : undefined}
                      onSelect={() => {
                        onChange(c.slug);
                        setOpen(false);
                      }}
                    >
                      <span>{label}</span>
                      {c.is_regional_capital ? (
                        <span className="ms-auto text-[10px] uppercase tracking-wide text-muted-foreground">
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

export default CityCombobox;
