"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Variant = "default" | "outline" | "destructive" | "ghost" | "secondary";

/**
 * Form-submit button that reflects `useFormStatus` pending state and delegates
 * presentation to the shadcn `<Button>`. Kept as a thin wrapper so the admin
 * verification server-action call sites (`<form action={...}>`) don't need to
 * reason about pending UI.
 */
export function SubmitButton({
  children,
  variant = "default",
  pendingLabel,
  className,
  size,
}: {
  children: React.ReactNode;
  variant?: Variant;
  pendingLabel?: string;
  className?: string;
  size?: "xs" | "sm" | "default" | "lg";
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={pending}
      className={cn(className)}
      aria-busy={pending || undefined}
    >
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          {pendingLabel ?? "Working…"}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
