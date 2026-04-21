"use client";

import { useActionState, useId, useTransition } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { signInAction, type AuthState } from "../actions";

type Labels = {
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  submit: string;
  submitting: string;
  errorEmailRequired: string;
  errorPasswordRequired: string;
};

const initial: AuthState = { ok: false };

/**
 * Sign-in form — shadcn Form (react-hook-form + zod) in front of the existing
 * server action. zod validates client-side for immediate field-level feedback;
 * on submit we forward the data to `signInAction` via `useActionState` so the
 * existing redirect-by-role flow is preserved.
 */
export function SignInForm({ next, labels }: { next?: string; labels: Labels }) {
  const schema = z.object({
    email: z.string().email(labels.errorEmailRequired),
    password: z.string().min(1, labels.errorPasswordRequired),
  });
  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
    mode: "onBlur",
  });

  const [state, formAction] = useActionState(signInAction, initial);
  const [isPending, startTransition] = useTransition();
  const formId = useId();

  const onSubmit: SubmitHandler<FormValues> = (values) => {
    const fd = new FormData();
    fd.set("email", values.email);
    fd.set("password", values.password);
    fd.set("next", next ?? "");
    startTransition(() => formAction(fd));
  };

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
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{labels.passwordLabel}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  placeholder={labels.passwordPlaceholder}
                />
              </FormControl>
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
