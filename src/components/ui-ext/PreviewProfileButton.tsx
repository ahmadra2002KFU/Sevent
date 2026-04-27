"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type PreviewProfileButtonProps = {
  slug: string;
};

/**
 * Opens the supplier's public profile in a new tab. Lives in the customizer
 * page header so the supplier can quickly verify how accent / order / bio
 * changes look to visitors.
 */
export function PreviewProfileButton({ slug }: PreviewProfileButtonProps) {
  const t = useTranslations("supplier.profile.customizer");
  return (
    <Button variant="outline" size="sm" asChild>
      <Link
        href={`/s/${slug}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <ExternalLink aria-hidden />
        {t("preview")}
      </Link>
    </Button>
  );
}
