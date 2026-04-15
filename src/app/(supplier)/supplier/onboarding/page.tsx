import { getTranslations } from "next-intl/server";
import { loadOnboardingBootstrap } from "./loader";
import { OnboardingWizard } from "./wizard";

export const dynamic = "force-dynamic";

export default async function SupplierOnboardingPage() {
  const [t, bootstrap] = await Promise.all([
    getTranslations("supplier.onboarding"),
    loadOnboardingBootstrap(),
  ]);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">{t("intro")}</p>
        {bootstrap.supplier ? (
          <p className="mt-2 inline-flex w-fit items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-3 py-1 text-xs text-[var(--color-muted-foreground)]">
            {t("statusLabel")}:{" "}
            <span className="font-medium text-[var(--color-foreground)]">
              {bootstrap.supplier.verification_status}
            </span>
            <span aria-hidden>·</span>
            <span className="font-mono text-[10px]">{bootstrap.supplier.slug}</span>
          </p>
        ) : null}
      </header>

      <OnboardingWizard bootstrap={bootstrap} />
    </section>
  );
}
