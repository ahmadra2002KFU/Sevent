"use client";

import { useActionState, useId, useTransition } from "react";
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
import { PhoneInput } from "@/components/auth/PhoneInput";
import { signUpAction } from "../actions";

type AuthState = { ok: boolean; error?: string };

export type SignUpRole = "organizer" | "supplier";

type Labels = {
  fullNameLabel: string;
  fullNamePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  phoneLabel: string;
  phoneCountryCode: string;
  phonePlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  passwordHint: string;
  submit: string;
  submitting: string;
  errorFullName: string;
  errorEmail: string;
  errorPhone: string;
  errorPassword: string;
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
    phone: z.string().regex(/^5\d{8}$/, labels.errorPhone),
    password: z.string().min(8, labels.errorPassword),
  });
  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "", phone: "", password: "" },
    mode: "onBlur",
  });

  const [state, formAction] = useActionState(signUpAction, initial);
  const [isPending, startTransition] = useTransition();
  const formId = useId();

  const onSubmit: SubmitHandler<FormValues> = (values) => {
    const fd = new FormData();
    fd.set("fullName", values.fullName);
    fd.set("email", values.email);
    fd.set("phone", values.phone);
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
          name="phone"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>{labels.phoneLabel}</FormLabel>
              <FormControl>
                <PhoneInput
                  name={field.name}
                  value={field.value}
                  onBlur={field.onBlur}
                  countryCode={labels.phoneCountryCode}
                  placeholder={labels.phonePlaceholder}
                  invalid={Boolean(fieldState.error)}
                  onValueChange={(digits) => field.onChange(digits)}
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
