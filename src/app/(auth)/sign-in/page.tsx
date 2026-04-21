import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Logo } from "@/components/brand/Logo";
import { SignInForm } from "./form";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignInPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const confirm = params.confirm === "1";
  const t = await getTranslations("auth.signIn");
  const tCommon = await getTranslations("auth.common");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-6 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
          {tCommon("backHome")}
        </Link>

        <Card className="border-border bg-card shadow-brand">
          <CardHeader className="flex flex-col items-start gap-4 pb-2">
            <Logo variant="wordmark" className="h-7 w-auto" />
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-brand-navy-900">
                {t("title")}
              </h1>
              <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-5">
            {confirm ? (
              <Alert className="border-brand-cobalt-500/20 bg-brand-cobalt-100 text-brand-navy-900">
                <Info className="size-4 text-brand-cobalt-500" aria-hidden />
                <AlertDescription className="text-sm text-brand-navy-900">
                  {t("confirmBanner")}
                </AlertDescription>
              </Alert>
            ) : null}

            <SignInForm
              next={next}
              labels={{
                emailLabel: t("emailLabel"),
                emailPlaceholder: t("emailPlaceholder"),
                passwordLabel: t("passwordLabel"),
                passwordPlaceholder: t("passwordPlaceholder"),
                submit: t("submit"),
                submitting: t("submitting"),
                errorEmailRequired: t("errorEmailRequired"),
                errorPasswordRequired: t("errorPasswordRequired"),
              }}
            />

            <p className="text-center text-sm text-muted-foreground">
              {t("newHere")}{" "}
              <Link
                href="/sign-up"
                className="font-semibold text-brand-cobalt-500 transition-colors hover:text-brand-cobalt-400"
              >
                {t("createAccount")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
