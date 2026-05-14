"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Logo } from "@/components/brand/Logo";
import {
  SignupRoleToggle,
  type SignupRole,
} from "@/components/auth/SignupRoleToggle";
import {
  SignupValueHero,
  type SignupValueHeroProps,
} from "@/components/auth/SignupValueHero";
import { SignUpForm, type SignUpFormLabels } from "./form";
import {
  SupplierSignUpForm,
  type SupplierSignUpLabels,
} from "./supplier/form";

export type SignUpExperienceLabels = {
  backHome: string;
  toggle: { organizer: string; supplier: string };
  /** Shared navy value panel — identical for both roles. */
  hero: SignupValueHeroProps["labels"];
  organizer: {
    title: string;
    subtitle: string;
    haveAccount: string;
    signIn: string;
    form: SignUpFormLabels;
  };
  supplier: {
    eyebrow: string;
    title: string;
    alreadyHaveAccount: string;
    signIn: string;
    form: SupplierSignUpLabels;
  };
};

const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

const fade = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.18, ease: EASE },
};

/**
 * Single-page sign-up experience. Holds the active role in client state and
 * swaps the header, notice and form in place — switching tracks never
 * triggers a navigation. The navy value panel is shared and stays mounted
 * (identical for both roles). The dedicated `/sign-up/organizer` and
 * `/sign-up/supplier` routes redirect here; `?role=supplier` seeds the
 * initial role for the supplier funnel.
 */
export function SignUpExperience({
  initialRole,
  locale,
  labels,
}: {
  initialRole: SignupRole;
  locale: "en" | "ar";
  labels: SignUpExperienceLabels;
}) {
  const [role, setRole] = useState<SignupRole>(initialRole);
  const column = role === "organizer" ? labels.organizer : labels.supplier;

  return (
    <main className="flex min-h-screen bg-neutral-50">
      {/* Shared navy value panel — direct flex child so `self-stretch` keeps
          it full-height. Identical for both roles. Hidden below lg. */}
      <SignupValueHero labels={labels.hero} />

      {/* Form column */}
      <div className="flex flex-1 justify-center overflow-y-auto px-6 py-12 lg:py-16">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
            {labels.backHome}
          </Link>

          <Card className="border-border bg-card shadow-brand">
            <CardHeader className="flex flex-col items-start gap-4 pb-2">
              <Logo variant="wordmark" className="h-7 w-auto" />
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`header-${role}`}
                  className="space-y-1"
                  initial={fade.initial}
                  animate={fade.animate}
                  exit={fade.exit}
                  transition={fade.transition}
                >
                  {role === "supplier" ? (
                    <div className="text-[12.5px] font-bold uppercase tracking-wider text-brand-cobalt-500">
                      {labels.supplier.eyebrow}
                    </div>
                  ) : null}
                  <h1 className="text-2xl font-bold tracking-tight text-brand-navy-900">
                    {column.title}
                  </h1>
                  {role === "organizer" ? (
                    <p className="text-sm text-muted-foreground">
                      {labels.organizer.subtitle}
                    </p>
                  ) : null}
                </motion.div>
              </AnimatePresence>
            </CardHeader>

            <CardContent className="flex flex-col gap-5">
              <SignupRoleToggle
                value={role}
                onChange={setRole}
                labels={labels.toggle}
              />

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`form-${role}`}
                  initial={fade.initial}
                  animate={fade.animate}
                  exit={fade.exit}
                  transition={fade.transition}
                >
                  {role === "organizer" ? (
                    <SignUpForm role="organizer" labels={labels.organizer.form} />
                  ) : (
                    <SupplierSignUpForm
                      locale={locale}
                      labels={labels.supplier.form}
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              <p className="text-center text-sm text-muted-foreground">
                {role === "organizer"
                  ? labels.organizer.haveAccount
                  : labels.supplier.alreadyHaveAccount}{" "}
                <Link
                  href="/sign-in"
                  className="font-semibold text-brand-cobalt-500 transition-colors hover:text-brand-cobalt-400"
                >
                  {column.signIn}
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
