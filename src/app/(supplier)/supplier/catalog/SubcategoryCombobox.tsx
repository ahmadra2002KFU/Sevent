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
import type { CatalogSubcategory } from "./loader";

type Props = {
  subcategories: CatalogSubcategory[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
};

function localizedName(
  entry: { name_en: string; name_ar?: string | null } | null | undefined,
  locale: string,
): string {
  if (!entry) return "";
  if (locale === "ar" && entry.name_ar) return entry.name_ar;
  return entry.name_en;
}

export function SubcategoryCombobox({
  subcategories,
  value,
  onChange,
  ariaLabel,
  placeholder,
  disabled,
}: Props) {
  const t = useTranslations("supplier.catalog.subcategoryPicker");
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  // Group subcategories by parent so the dropdown reads like the onboarding
  // wizard — users pick a category first, then the exact service. Without
  // grouping an 18-item flat list is hard to scan.
  const grouped = useMemo(() => {
    const byParent = new Map<
      string,
      { parentLabel: string; items: CatalogSubcategory[] }
    >();
    for (const s of subcategories) {
      const key = s.parent_id ?? "__orphan__";
      const parentLabel =
        localizedName(
          s.parent_name_en
            ? { name_en: s.parent_name_en, name_ar: s.parent_name_ar }
            : null,
          locale,
        ) || t("uncategorized");
      if (!byParent.has(key)) {
        byParent.set(key, { parentLabel, items: [] });
      }
      byParent.get(key)!.items.push(s);
    }
    return Array.from(byParent.values()).sort((a, b) =>
      a.parentLabel.localeCompare(b.parentLabel, locale),
    );
  }, [subcategories, locale, t]);

  const selected = subcategories.find((s) => s.id === value) ?? null;
  const selectedLabel = selected
    ? `${
        selected.parent_name_en
          ? `${localizedName(
              { name_en: selected.parent_name_en, name_ar: selected.parent_name_ar },
              locale,
            )} · `
          : ""
      }${localizedName(selected, locale)}`
    : "";

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
          className="h-9 w-full justify-between text-sm font-normal"
        >
          <span className={cn(!selected && "text-muted-foreground")}>
            {selected ? selectedLabel : placeholder ?? t("placeholder")}
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
              <CommandGroup key={g.parentLabel} heading={g.parentLabel}>
                {g.items.map((s) => {
                  const label = localizedName(s, locale);
                  const searchValue = `${g.parentLabel} ${s.name_en} ${
                    s.name_ar ?? ""
                  } ${s.slug}`;
                  return (
                    <CommandItem
                      key={s.id}
                      value={searchValue}
                      data-checked={value === s.id ? "true" : undefined}
                      onSelect={() => {
                        onChange(s.id);
                        setOpen(false);
                      }}
                    >
                      <span>{label}</span>
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
