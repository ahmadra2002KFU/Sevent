"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertCircle,
  Briefcase,
  Building,
  Loader2,
  UserRound,
} from "lucide-react";
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

export type SignUpRole = "organizer" | "supplier" | "agency";

type Labels = {
  fullNameLabel: string;
  fullNamePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  passwordHint: string;
  roleLabel: string;
  roleOrganizer: string;
  roleSupplier: string;
  roleAgency: string;
  submit: string;
  submitting: string;
  errorFullName: string;
  errorEmail: string;
  errorPassword: string;
};

const initial: AuthState = { ok: false };

const ROLE_META: Record<SignUpRole, { icon: typeof UserRound }> = {
  organizer: { icon: UserRound },
  supplier: { icon: Building },
  agency: { icon: Briefcase },
};

/**
 * Sign-up form. Chooses a role via a tile-style card picker (click anywhere
 * on the card to select, not just a tiny radio dot) — keeps the step feeling
 * like a meaningful decision rather than a form question.
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

  const roleOptions: Array<{ value: SignUpRole; label: string }> = [
    { value: "organizer", label: labels.roleOrganizer },
    { value: "supplier", label: labels.roleSupplier },
    { value: "agency", label: labels.roleAgency },
  ];

  return (
    <Form {...form}>
      {state?.error ? (
        <Alert
          variant="destructive"
          className="border-semantic-danger-500/30 bg-semantic-danger-100 text-semantic-danger-500"
        >
          <AlertCircle className="size-4" aria-hidden />
          <AlertDescription className="text-sm text-semantic-danger-500">
            {state.error}
          </AlertDescription>
        </Alert>
      ) : null}

      <form
        id={formId}
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
        noValidate
      >
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">{labels.roleLabel}</Label>
          <div className="grid gap-2 sm:grid-cols-3">
            {roleOptions.map((opt) => {
              const Icon = ROLE_META[opt.value].icon;
              const isActive = role === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  className={cn(
                    "group flex flex-col items-start gap-2 rounded-lg border px-3 py-3 text-start transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cobalt-500 focus-visible:ring-offset-2",
                    isActive
                      ? "border-brand-cobalt-500 bg-brand-cobalt-100 text-brand-navy-900 shadow-brand-sm"
                      : "border-border bg-card text-foreground hover:border-brand-cobalt-500/30",
                  )}
                  aria-pressed={isActive}
                >
                  <Icon
                    className={cn(
                      "size-4",
                      isActive ? "text-brand-cobalt-500" : "text-muted-foreground",
                    )}
                    aria-hidden
                  />
                  <span className="text-xs font-semibold leading-tight">
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
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
          className="mt-2 w-full bg-brand-cobalt-500 text-white hover:bg-brand-cobalt-400"
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
