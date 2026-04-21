"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { ActionState } from "../action-state";

/**
 * Toast-style banner that surfaces the result of a server action consumed via
 * `useActionState`. Idempotent: nothing renders for the idle state.
 *
 * Visually hosted by a shadcn Alert so the tone/border matches every other
 * inline feedback surface.
 */
export function ActionBanner({ state }: { state: ActionState }) {
  if (state.status === "idle") return null;
  const isError = state.status === "error";
  const Icon = isError ? AlertTriangle : CheckCircle2;
  return (
    <Alert
      role="status"
      className={cn(
        isError
          ? "border-semantic-danger-500/30 bg-semantic-danger-100 text-semantic-danger-500"
          : "border-semantic-success-500/30 bg-semantic-success-100 text-semantic-success-500",
      )}
    >
      <Icon className="size-4" aria-hidden />
      <AlertDescription
        className={cn(
          isError ? "text-semantic-danger-500" : "text-semantic-success-500",
        )}
      >
        {state.message}
      </AlertDescription>
    </Alert>
  );
}
