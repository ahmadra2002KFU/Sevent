"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type SignupRole = "organizer" | "supplier";

type SignupRoleToggleProps = {
  value: SignupRole;
  onChange: (role: SignupRole) => void;
  labels: { organizer: string; supplier: string };
  className?: string;
};

const ROLES: readonly SignupRole[] = ["organizer", "supplier"];

/**
 * In-place segmented control that switches between the organizer and supplier
 * sign-up tracks. Controlled — the parent owns the active role and swaps the
 * rendered form, so this never navigates. The active pill is a shared-layout
 * element (`layoutId`), so it slides smoothly between the two options; layout
 * measurement makes it correct under rtl without a direction prop.
 */
export function SignupRoleToggle({
  value,
  onChange,
  labels,
  className,
}: SignupRoleToggleProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      role="group"
      aria-label={`${labels.organizer} / ${labels.supplier}`}
      className={cn(
        "relative inline-flex w-full items-center rounded-lg bg-muted p-[3px]",
        className,
      )}
    >
      {ROLES.map((role) => {
        const isActive = value === role;
        return (
          <button
            key={role}
            type="button"
            onClick={() => onChange(role)}
            aria-pressed={isActive}
            className={cn(
              "relative inline-flex flex-1 items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cobalt-500/30",
              isActive
                ? "text-foreground"
                : "text-foreground/60 hover:text-foreground",
            )}
          >
            {isActive ? (
              <motion.span
                aria-hidden
                layoutId="signup-role-pill"
                className="absolute inset-0 rounded-md bg-background shadow-sm"
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 400, damping: 32 }
                }
              />
            ) : null}
            <span className="relative z-10">{labels[role]}</span>
          </button>
        );
      })}
    </div>
  );
}
