"use client";

import { cn } from "@/lib/utils";
import type { ActionState } from "../actions";

/**
 * Toast-style banner that surfaces the result of a server action consumed via
 * `useActionState`. Idempotent: nothing renders for the idle state.
 */
export function ActionBanner({ state }: { state: ActionState }) {
  if (state.status === "idle") return null;
  const isError = state.status === "error";
  return (
    <div
      role="status"
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        isError
          ? "border-[#F2C2C2] bg-[#FCE9E9] text-[#9F1A1A]"
          : "border-[#BDE3CB] bg-[#E2F4EA] text-[var(--color-sevent-green)]",
      )}
    >
      {state.message}
    </div>
  );
}
