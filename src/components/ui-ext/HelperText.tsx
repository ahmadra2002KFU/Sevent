"use client";

import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Small field-helper paragraph rendered under a FormLabel. Only visible when
 * the active locale is Arabic — boss's readability note targets Arabic
 * low-literacy users; English speakers don't need the added vertical noise.
 *
 * Render as a sibling of FormLabel + before FormControl so it reads in order.
 */
export function HelperText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const locale = useLocale();
  if (locale !== "ar") return null;
  if (!children) return null;
  return (
    <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>
      {children}
    </p>
  );
}

export default HelperText;
