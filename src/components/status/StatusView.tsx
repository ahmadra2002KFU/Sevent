import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

// TODO: localize via next-intl after i18n stability.
//
// Minimal status surface used by error boundaries and not-found pages.
// Kept dependency-light on purpose: an error in i18n itself must not
// cascade into the fallback UI, so this component stays English-only
// and avoids `useTranslations` / `getTranslations`.

type StatusAction = {
  label: string;
  href: string;
};

type StatusViewProps = {
  title: string;
  message: string;
  primary?: ReactNode;
  secondary?: StatusAction;
};

export function StatusView({
  title,
  message,
  primary,
  secondary,
}: StatusViewProps) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <div className="mt-2 flex items-center gap-2">
        {primary}
        {secondary ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={secondary.href}>{secondary.label}</Link>
          </Button>
        ) : null}
      </div>
    </main>
  );
}
