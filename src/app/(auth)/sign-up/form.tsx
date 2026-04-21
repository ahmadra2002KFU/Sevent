"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, CalendarHeart, Loader2, Store } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { signUpAction, type AuthState } from "../actions";

export type SignUpRole = "organizer" | "supplier";

type Labels = {
  fullNameLabel: string;
  fullNamePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  passwordHint: string;
  roleLabel: string;
  roleOrganizerTitle: string;
  roleOrganizerSubline: string;
  roleSupplierTitle: string;
  roleSupplierSubline: string;
  submit: string;
  submitting: string;
  errorFullName: string;
  errorEmail: string;
  errorPassword: string;
};

const initial: AuthState = { ok: false };

type RoleCard = {
  value: SignUpRole;
  icon: typeof CalendarHeart;
  title: string;
  subline: string;
};

/**
 * Sign-up form. The role picker is intentionally large & icon-first so low-literacy
 * users can spot their choice at a glance: two full-width clickable cards instead of
 * a tile row of radio-like options. The whole card is the hit target (>=44×44), and
 * focus/active states use brand-cobalt tokens for visual consistency.
 */
export function SignUpForm({
  initialRole = "organizer",
  labels,
}: {
  initialRole?: SignUpRole;
  labels: Labels;
}) {
  const schema = z.object({
    fullName: z
      .string()
      .min(2, labels.errorFullName)
      .max(120, labels.errorFullName),
    email: z.string().email(labels.errorEmail),
    password: z.string().min(8, labels.errorPassword),
  });
  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "", password: "" },
    mode: "onBlur",
  });

  const [role, setRole] = useState<SignUpRole>(initialRole);
  const [state, formAction] = useActionState(signUpAction, initial);
  const [isPending, startTransition] = useTransition();
  const formId = useId();

  const onSubmit: SubmitHandler<FormValues> = (values) => {
    const fd = new FormData();
    fd.set("fullName", values.fullName);
    fd.set("email", values.email);
    fd.set("password", values.password);
    fd.set("role", role);
    startTransition(() => formAction(fd));
  };

  const roleCards: RoleCard[] = [
    {
      value: "organizer",
      icon: CalendarHeart,
      title: labels.roleOrganizerTitle,
      subline: labels.roleOrganizerSubline,
    },
    {
      value: "supplier",
      icon: Store,
      title: labels.roleSupplierTitle,
      subline: labels.roleSupplierSubline,
    },
  ];

  return (
    <Form {...form}>
      <AnimatePresence>
        {state?.error ? (
          <motion.div
            key="signup-error"
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <Alert
              variant="destructive"
              className="border-semantic-danger-500/30 bg-semantic-danger-100 text-semantic-danger-500"
            >
              <AlertCircle className="size-4" aria-hidden />
              <AlertDescription className="text-sm text-semantic-danger-500">
                {state.error}
              </AlertDescription>
            </Alert>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <form
        id={formId}
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
        noValidate
      >
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">{labels.roleLabel}</Label>
          <LayoutGroup id="signup-role">
            <div
              role="radiogroup"
              aria-label={labels.roleLabel}
              className="grid gap-3 sm:grid-cols-2"
            >
              {roleCards.map((card) => {
                const Icon = card.icon;
                const isActive = role === card.value;
                return (
                  <motion.button
                    key={card.value}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => setRole(card.value)}
                    whileHover={{ y: -3, scale: 1.01 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 400, damping: 22 }}
                    className={cn(
                      "group relative flex min-h-[120px] w-full flex-col items-start justify-between gap-3 overflow-hidden rounded-xl border-2 p-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cobalt-500 focus-visible:ring-offset-2",
                      isActive
                        ? "border-brand-cobalt-500 shadow-brand-md"
                        : "border-border bg-card hover:border-brand-cobalt-500/30 hover:bg-brand-cobalt-500/5",
                    )}
                  >
                    {isActive ? (
                      <motion.span
                        layoutId="signup-role-bg"
                        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-cobalt-100 via-brand-cobalt-100/70 to-brand-cobalt-100/30"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        aria-hidden
                      />
                    ) : null}
                    <motion.span
                      animate={{
                        backgroundColor: isActive ? "rgb(30 123 216)" : "rgb(244 244 239)",
                        color: isActive ? "rgb(255 255 255)" : "rgb(15 46 92)",
                        rotate: isActive ? [0, -8, 8, 0] : 0,
                      }}
                      transition={{
                        backgroundColor: { duration: 0.3 },
                        color: { duration: 0.3 },
                        rotate: { duration: 0.5, ease: "easeInOut" },
                      }}
                      className="relative flex size-12 items-center justify-center rounded-lg"
                    >
                      <Icon className="size-6" aria-hidden />
                    </motion.span>
                    <span className="relative flex flex-col gap-1">
                      <span
                        className={cn(
                          "text-base font-semibold leading-tight",
                          isActive ? "text-brand-navy-900" : "text-foreground",
                        )}
                      >
                        {card.title}
                      </span>
                      <span
                        className={cn(
                          "text-xs leading-snug",
                          isActive
                            ? "text-brand-navy-900/80"
                            : "text-muted-foreground",
                        )}
                      >
                        {card.subline}
                      </span>
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </LayoutGroup>
        </div>

        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{labels.fullNameLabel}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  name="fullName"
                  autoComplete="name"
                  placeholder={labels.fullNamePlaceholder}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{labels.emailLabel}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder={labels.emailPlaceholder}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{labels.passwordLabel}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  placeholder={labels.passwordPlaceholder}
                />
              </FormControl>
              <FormDescription>{labels.passwordHint}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          className="mt-2 min-h-[44px] w-full bg-brand-cobalt-500 text-white hover:bg-brand-cobalt-400"
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {labels.submitting}
            </>
          ) : (
            labels.submit
          )}
        </Button>
      </form>
    </Form>
  );
}
