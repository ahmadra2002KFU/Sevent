import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoProps = {
  variant?: "wordmark" | "mark";
  tone?: "color" | "white";
  className?: string;
  /** Set on above-the-fold placements (site headers) to avoid a load flash. */
  priority?: boolean;
  "aria-label"?: string;
};

/**
 * Sevent brand logo.
 *
 * Renders the exact brand artwork (raster PNG) via next/image. The PNGs are the
 * canonical files in /public, derived from the master `Logo New.png`:
 *   - wordmark  → /logo.png            (full "SEVENT" lockup, also used by emails)
 *   - mark      → /logo-mark.png       (the standalone "S")
 *   - tone="white" swaps to the reversed (white knockout) art for dark
 *     backgrounds → /logo-white.png and /logo-mark-white.png
 *
 * Intrinsic width/height drive the aspect ratio; callers size with a Tailwind
 * height class (e.g. `h-7 w-auto`). As a raster it never mirrors under
 * `dir="rtl"`, so no direction pinning is required.
 */
const ASSETS = {
  wordmark: {
    color: "/logo.png",
    white: "/logo-white.png",
    width: 895,
    height: 259,
  },
  mark: {
    color: "/logo-mark.png",
    white: "/logo-mark-white.png",
    width: 242,
    height: 259,
  },
} as const;

export function Logo({
  variant = "wordmark",
  tone = "color",
  className,
  priority = false,
  "aria-label": ariaLabel = "Sevent",
}: LogoProps) {
  const asset = ASSETS[variant];
  const src = tone === "white" ? asset.white : asset.color;

  return (
    <Image
      src={src}
      alt={ariaLabel}
      width={asset.width}
      height={asset.height}
      priority={priority}
      className={cn("shrink-0", className)}
    />
  );
}
