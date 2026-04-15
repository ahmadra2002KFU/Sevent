"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const variantClass: Record<Variant, string> = {
  primary:
    "bg-[var(--color-sevent-green)] text-white hover:bg-[var(--color-sevent-green-soft)]",
  secondary:
    "border border-[var(--color-border)] bg-white text-[var(--color-foreground)] hover:bg-[var(--color-muted)]",
  danger: "bg-[#9F1A1A] text-white hover:bg-[#831414]",
  ghost:
    "text-[var(--color-sevent-green)] hover:underline",
};

export function SubmitButton({
  children,
  variant = "primary",
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variantClass[variant],
        className,
      )}
    >
      {pending ? pendingLabel ?? "Working…" : children}
    </button>
  );
}
