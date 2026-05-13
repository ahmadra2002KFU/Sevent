"use client";

import { useActionState, useEffect, useId, useState, useTransition } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, CheckCircle2, Loader2, Mail } from "lucide-react";
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
import {
  resendConfirmationAction,
  signInAction,
  type AuthState,
  type ResendState,
} from "../actions";

type Labels = {
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  submit: string;
  submitting: string;
  errorEmailRequired: string;
  errorPasswordRequired: string;
  // Resend labels (only consumed when `showResend` is true). Required so the
  // server component owns all i18n; we don't want the client to read message
  // bundles directly.
  resendCta: string;
  resendSending: string;
  resendSuccess: string;
  resendCapReached: string;
  resendCooldown: string;
  resendInvalidEmail: string;
  resendUnknownError: string;
};

const initial: AuthState = { ok: false };
const initialResend: ResendState = { ok: false };

/**
 * Sign-in form — shadcn Form (react-hook-form + zod) in front of the existing
 * server action. zod validates client-side for immediate field-level feedback;
 * on submit we forward the data to `signInAction` via `useActionState` so the
 * existing redirect-by-role flow is preserved.
 */
export function SignInForm({
  next,
  showResend = false,
  labels,
}: {
  next?: string;
  showResend?: boolean;
  labels: Labels;
}) {
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
  const [resendState, resendDispatch] = useActionState(
    resendConfirmationAction,
    initialResend,
  );
  const [isPending, startTransition] = useTransition();
  const [isResending, startResend] = useTransition();
  const formId = useId();

  const onSubmit: SubmitHandler<FormValues> = (values) => {
    const fd = new FormData();
    fd.set("email", values.email);
    fd.set("password", values.password);
    fd.set("next", next ?? "");
    startTransition(() => formAction(fd));
  };

  const onResend = () => {
    const email = form.getValues("email").trim();
    if (!email) {
      form.setError("email", { message: labels.errorEmailRequired });
      return;
    }
    const fd = new FormData();
    fd.set("email", email);
    startResend(() => resendDispatch(fd));
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

      {showResend ? (
        <ResendBlock
          labels={labels}
          state={resendState}
          isResending={isResending}
          onResend={onResend}
        />
      ) : null}
    </Form>
  );
}

function ResendBlock({
  labels,
  state,
  isResending,
  onResend,
}: {
  labels: Labels;
  state: ResendState;
  isResending: boolean;
  onResend: () => void;
}) {
  // The cooldown is "live": if the user keeps the tab open across the 1-hour
  // boundary, the disabled button should re-enable on its own. `now` ticks
  // every 30s when a retryAt is in effect; otherwise the timer is idle.
  const cooldownActive = useCooldownActive(state.retryAt);
  const buttonDisabled = isResending || cooldownActive;

  const resultMessage = (() => {
    if (state.ok) {
      return { tone: "success" as const, text: labels.resendSuccess };
    }
    if (state.reason === "invalid_email") {
      return { tone: "error" as const, text: labels.resendInvalidEmail };
    }
    if (state.reason === "rate_limited") {
      return { tone: "error" as const, text: labels.resendCapReached };
    }
    if (state.reason === "supabase_error") {
      return { tone: "error" as const, text: state.error ?? labels.resendUnknownError };
    }
    if (state.reason === "unknown") {
      return { tone: "error" as const, text: labels.resendUnknownError };
    }
    return null;
  })();

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{labels.resendCta}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onResend}
          disabled={buttonDisabled}
        >
          {isResending ? (
            <>
              <Loader2 className="size-3 animate-spin" aria-hidden />
              {labels.resendSending}
            </>
          ) : (
            <>
              <Mail className="size-3.5" aria-hidden />
              {labels.resendCta}
            </>
          )}
        </Button>
      </div>

      {cooldownActive ? (
        <p className="text-xs text-muted-foreground">{labels.resendCooldown}</p>
      ) : null}

      {!cooldownActive && resultMessage ? (
        <p
          className={
            resultMessage.tone === "success"
              ? "flex items-center gap-1.5 text-xs text-semantic-success-500"
              : "flex items-center gap-1.5 text-xs text-semantic-danger-500"
          }
        >
          {resultMessage.tone === "success" ? (
            <CheckCircle2 className="size-3.5" aria-hidden />
          ) : (
            <AlertCircle className="size-3.5" aria-hidden />
          )}
          {resultMessage.text}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Returns true while `retryAtIso` is in the future. Polls every 30s so the
 * button automatically re-enables when the cooldown expires without requiring
 * a page reload.
 */
function useCooldownActive(retryAtIso: string | undefined): boolean {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!retryAtIso) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [retryAtIso]);
  if (!retryAtIso) return false;
  return new Date(retryAtIso).getTime() > now;
}
