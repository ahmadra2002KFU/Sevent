import {
  Building2,
  Utensils,
  Camera,
  Flower2,
  Music4,
  Volume2,
  Bus,
  Users,
  Tag,
  type LucideIcon,
} from "lucide-react";

/**
 * Maps top-level category slugs (see supabase/seed.sql) to lucide icons.
 * Unknown slugs fall back to a neutral tag icon. Centralized here so every
 * public surface renders the same icon for a given category.
 */
const ICONS: Record<string, LucideIcon> = {
  venues: Building2,
  catering: Utensils,
  photography: Camera,
  decor: Flower2,
  entertainment: Music4,
  av: Volume2,
  transportation: Bus,
  staffing: Users,
};

export const FALLBACK_CATEGORY_ICON: LucideIcon = Tag;

export function getCategoryIcon(slug: string): LucideIcon {
  return ICONS[slug] ?? FALLBACK_CATEGORY_ICON;
}
