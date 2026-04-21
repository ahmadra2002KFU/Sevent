"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MapPin } from "lucide-react";

type CityFilterProps = {
  cities: readonly string[];
  currentCity: string | null;
  label: string;
  allCitiesLabel: string;
  placeholder?: string;
};

const ALL_VALUE = "__all__";

/**
 * Client-side city filter. Pushes the selected city to `?city=` in the URL
 * via the router — SSR page re-renders with the new filter, no client-side
 * data fetching. `useTransition` keeps the UI responsive during navigation.
 *
 * Shadcn Select is used for a branded dropdown experience (keyboard-friendly,
 * type-ahead, theme-aligned) rather than a bare <select>.
 */
export function CityFilter({
  cities,
  currentCity,
  label,
  allCitiesLabel,
  placeholder,
}: CityFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const handleChange = (next: string) => {
    const params = new URLSearchParams();
    if (next !== ALL_VALUE) params.set("city", next);
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
      <div className="flex min-w-[14rem] flex-col gap-1.5">
        <Label htmlFor="city-filter" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </Label>
        <Select
          value={currentCity ?? ALL_VALUE}
          onValueChange={handleChange}
          disabled={isPending}
        >
          <SelectTrigger id="city-filter" className="bg-card">
            <MapPin className="size-4 text-muted-foreground" aria-hidden />
            <SelectValue placeholder={placeholder ?? allCitiesLabel} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>{allCitiesLabel}</SelectItem>
            {cities.map((city) => (
              <SelectItem key={city} value={city}>
                {city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
