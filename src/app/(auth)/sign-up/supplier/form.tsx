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
import { TermsCheckbox } from "@/components/auth/TermsCheckbox";
import { signUpSupplierAction } from "../../actions";

type AuthState = { ok: boolean; error?: string };

export type SupplierSignUpLabels = {
  emailLabel: string;
  emailPlaceholder: string;
  phoneLabel: string;
  phoneCountryCode: string;
  phonePlaceholder: string;
  passwordLabel: string;
  passwordHint: string;
  cta: string;
  submitting: string;
  terms: string;
  termsLinkTerms: string;
  termsLinkPrivacy: string;
  errorEmail: string;
  errorPhone: string;
  errorPassword: string;
  errorTerms: string;
};

const initial: AuthState = { ok: false };

/**
 * Supplier sign-up form (screen 1 of the redesigned onboarding). Distinct
 * from the organizer form because the supplier track captures phone + an
 * explicit T&C consent gate, and intentionally omits Google OAuth (plan
 * decision 2). The submit target is `signUpSupplierAction`.
 */
export function SupplierSignUpForm({
  labels,
  locale = "en",
}: {
  labels: SupplierSignUpLabels;
  locale?: "en" | "ar";
}) {
  const schema = z.object({
    email: z.string().email(labels.errorEmail),
    phone: z.string().regex(/^5\d{8}$/, labels.errorPhone),
    password: z.string().min(8, labels.errorPassword),
    termsAccepted: z.literal(true, { message: labels.errorTerms }),
  });
  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      phone: "",
      password: "",
      termsAccepted: false as unknown as true,
    },
    mode: "onBlur",
  });

  const [state, formAction] = useActionState(signUpSupplierAction, initial);
  const [isPending, startTransition] = useTransition();
  const formId = useId();

  const onSubmit: SubmitHandler<FormValues> = (values) => {
    const fd = new FormData();
    fd.set("email", values.email);
    fd.set("phone", values.phone);
    fd.set("password", values.password);
    fd.set("termsAccepted", values.termsAccepted ? "true" : "false");
    fd.set("language", locale);
    startTransition(() => formAction(fd));
  };

  return (
    <Form {...form}>
      <AnimatePresence>
        {state?.error ? (
          <motion.div
            key="supplier-signup-error"
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <Alert
              variant="destructive"
              className="mb-4 border-semantic-danger-500/30 bg-semantic-danger-100 text-semantic-danger-500"
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
        className="flex flex-col gap-4"
        noValidate
      >
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
                  placeholder="••••••••"
                />
              </FormControl>
              <FormDescription>{labels.passwordHint}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="termsAccepted"
          render={({ field, fieldState }) => (
            <FormItem className="pt-1">
              <FormControl>
                <TermsCheckbox
                  name={field.name}
                  checked={Boolean(field.value)}
                  onBlur={field.onBlur}
                  onChange={(e) => field.onChange(e.target.checked)}
                  text={labels.terms}
                  termsLinkText={labels.termsLinkTerms}
                  privacyLinkText={labels.termsLinkPrivacy}
                />
              </FormControl>
              {fieldState.error ? (
                <FormMessage className="mt-1">
                  {fieldState.error.message}
                </FormMessage>
              ) : null}
            </FormItem>
          )}
        />

        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          className="mt-2 min-h-[44px] w-full bg-brand-cobalt-500 text-[15px] font-bold text-white shadow-[0_4px_14px_rgba(30,123,216,0.3)] hover:bg-brand-cobalt-400"
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {labels.submitting}
            </>
          ) : (
            labels.cta
          )}
        </Button>
      </form>
    </Form>
  );
}

export default SupplierSignUpForm;
