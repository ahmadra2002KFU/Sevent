"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { Globe, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { setLocaleAction } from "./locale-actions";

type LocaleOption = { code: "en" | "ar"; label: string };

const LOCALES: LocaleOption[] = [
  { code: "en", label: "English" },
  { code: "ar", label: "العربية" },
];

type LanguageSwitcherProps = {
  tone?: "light" | "dark";
};

export function LanguageSwitcher({ tone = "light" }: LanguageSwitcherProps) {
  const current = useLocale();
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={tone === "dark" ? "ghost" : "outline"}
          size="sm"
          className={
            tone === "dark"
              ? "border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
              : undefined
          }
          disabled={pending}
          aria-label="Change language"
        >
          <Globe className="size-4" aria-hidden />
          <span className="text-xs font-medium uppercase">{current}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LOCALES.map((opt) => (
          <DropdownMenuItem
            key={opt.code}
            onSelect={() => startTransition(() => setLocaleAction(opt.code))}
            className="justify-between gap-4"
          >
            <span>{opt.label}</span>
            {current === opt.code ? (
              <Check className="size-4" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
