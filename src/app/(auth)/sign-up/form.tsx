"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { signUpAction, startGoogleOAuthAction } from "../actions";

type AuthState = { ok: boolean; error?: string };

export type SignUpRole = "organizer" | "supplier";

type Labels = {
  fullNameLabel: string;
  fullNamePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  passwordHint: string;
  submit: string;
  submitting: string;
  errorFullName: string;
  errorEmail: string;
  errorPassword: string;
  googleCta: string;
  googleOrDivider: string;
  googleUnavailable: string;
};

const initial: AuthState = { ok: false };

/**
 * Single-role sign-up form. The role is fixed per-page — this instance always
 * submits as whatever the page prop says. Previously the form contained an
 * animated role-picker, but suppliers now have their own dedicated
 * `/sign-up/supplier` experience, so the picker was removed.
 */
export function SignUpForm({
  role = "organizer",
  labels,
}: {
  role?: SignUpRole;
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

  const [state, formAction] = useActionState(signUpAction, initial);
  const [isPending, startTransition] = useTransition();
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const formId = useId();

  async function handleGoogleSignIn() {
    setGoogleError(null);
    setGooglePending(true);
    try {
      const fd = new FormData();
      fd.set("role", role);
      const result = await startGoogleOAuthAction(fd);
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      setGoogleError(labels.googleUnavailable);
    } catch {
      setGoogleError(labels.googleUnavailable);
    } finally {
      setGooglePending(false);
    }
  }

  const onSubmit: SubmitHandler<FormValues> = (values) => {
    const fd = new FormData();
    fd.set("fullName", values.fullName);
    fd.set("email", values.email);
    fd.set("password", values.password);
    fd.set("role", role);
    startTransition(() => formAction(fd));
  };

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

        <div
          className="flex items-center gap-3 text-xs text-neutral-400"
          aria-hidden
        >
          <div className="h-px flex-1 bg-border" />
          <span>{labels.googleOrDivider}</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={googlePending}
          onClick={handleGoogleSignIn}
          className="min-h-[44px] w-full gap-2.5"
        >
          {googlePending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <svg aria-hidden className="size-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
              />
            </svg>
          )}
          {labels.googleCta}
        </Button>

        <AnimatePresence>
          {googleError ? (
            <motion.p
              key="google-err"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-center text-xs text-semantic-warning-500"
            >
              {googleError}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </form>
    </Form>
  );
}
