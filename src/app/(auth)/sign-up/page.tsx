import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Logo } from "@/components/brand/Logo";
import { SignUpForm, type SignUpRole } from "./form";

const ROLES: readonly SignUpRole[] = ["organizer", "supplier", "agency"];

type PageProps = {
  searchParams: Promise<{ role?: string }>;
};

export default async function SignUpPage({ searchParams }: PageProps) {
  const { role: raw } = await searchParams;
  const initialRole: SignUpRole = (ROLES as readonly string[]).includes(raw ?? "")
    ? (raw as SignUpRole)
    : "organizer";

  const [t, tCommon] = await Promise.all([
    getTranslations("auth.signUp"),
    getTranslations("auth.common"),
  ]);

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
            <SignUpForm
              initialRole={initialRole}
              labels={{
                fullNameLabel: t("fullNameLabel"),
                fullNamePlaceholder: t("fullNamePlaceholder"),
                emailLabel: t("emailLabel"),
                emailPlaceholder: t("emailPlaceholder"),
                passwordLabel: t("passwordLabel"),
                passwordPlaceholder: t("passwordPlaceholder"),
                passwordHint: t("passwordHint"),
                roleLabel: t("roleLabel"),
                roleOrganizer: t("roleOrganizer"),
                roleSupplier: t("roleSupplier"),
                roleAgency: t("roleAgency"),
                submit: t("submit"),
                submitting: t("submitting"),
                errorFullName: t("errorFullName"),
                errorEmail: t("errorEmail"),
                errorPassword: t("errorPassword"),
              }}
            />

            <p className="text-center text-sm text-muted-foreground">
              {t("haveAccount")}{" "}
              <Link
                href="/sign-in"
                className="font-semibold text-brand-cobalt-500 transition-colors hover:text-brand-cobalt-400"
              >
                {t("signIn")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
