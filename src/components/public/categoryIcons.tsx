import {
  Badge,
  Blocks,
  Building2,
  Hammer,
  Camera,
  Flower2,
  Megaphone,
  Printer,
  ShieldCheck,
  Sparkles,
  Truck,
  Utensils,
  Volume2,
  Users,
  Tag,
  type LucideIcon,
} from "lucide-react";

/**
 * Maps active top-level category slugs to lucide icons.
 * Unknown slugs fall back to a neutral tag icon. Centralized here so every
 * public surface renders the same icon for a given category.
 */
const ICONS: Record<string, LucideIcon> = {
  event_management: Sparkles,
  media_production: Camera,
  marketing_pr: Megaphone,
  advertising_prints_identity_applications: Printer,
  avl: Volume2,
  furniture: Flower2,
  logistics: Truck,
  site_services: Building2,
  fit_out_works: Hammer,
  construction: Blocks,
  hospitality: Utensils,
  workforce: Users,
  // Legacy parent slugs resolve to their active replacement for redirects and
  // old fallback copy that might still be cached outside this deploy.
  sound_lighting: Volume2,
  av: Volume2,
  photo_video: Camera,
  photography: Camera,
  catering_hospitality: Utensils,
  catering: Utensils,
  tents_structures: Building2,
  electricity_power: Building2,
  furniture_equipment: Flower2,
  flowers_decor: Flower2,
  decor: Flower2,
  entertainment_arts: Sparkles,
  entertainment: Sparkles,
  coordination_management: Sparkles,
  stands_exhibitions: Sparkles,
  venues: Sparkles,
  transport_logistics: Truck,
  transportation: Truck,
  makeup_beauty: Badge,
  staffing: ShieldCheck,
};

export const FALLBACK_CATEGORY_ICON: LucideIcon = Tag;

export function getCategoryIcon(slug: string): LucideIcon {
  return ICONS[slug] ?? FALLBACK_CATEGORY_ICON;
}
