import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { StatusPill } from "@/components/ui-ext/StatusPill";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { loadCatalogBootstrap } from "./loader";
import { CatalogClient } from "./catalog-client";

export const dynamic = "force-dynamic";

export default async function SupplierCatalogPage() {
  const t = await getTranslations("supplier.catalog");
  const bootstrap = await loadCatalogBootstrap();

  if (!bootstrap.ok) {
    return (
      <section className="flex flex-col gap-6">
        <PageHeader title={t("title")} />
        <Alert variant="destructive">
          <AlertTitle>{t("errorHeading")}</AlertTitle>
          <AlertDescription>{bootstrap.error}</AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="w-fit">
          <Link href="/supplier/onboarding">{t("goToOnboarding")}</Link>
        </Button>
      </section>
    );
  }

  const statusPill =
    bootstrap.supplier.verification_status === "approved" ? (
      <StatusPill status="approved" />
    ) : bootstrap.supplier.verification_status === "rejected" ? (
      <StatusPill status="rejected" />
    ) : (
      <StatusPill status="pending" />
    );

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {statusPill}
      <Badge variant="outline" className="font-mono text-[10px]">
        /{bootstrap.supplier.slug}
      </Badge>
      {bootstrap.supplier.is_published ? (
        <Button asChild variant="ghost" size="sm">
          <Link href={`/s/${bootstrap.supplier.slug}`} prefetch={false}>
            {t("viewPublic")}
            <ArrowUpRight />
          </Link>
        </Button>
      ) : null}
    </div>
  );

  return (
    <section className="relative flex flex-col gap-6">
      <div
        aria-hidden
        className="pointer-events-none select-none flex flex-col gap-6 blur-sm"
      >
        <PageHeader
          title={t("title")}
          description={t("subtitle")}
          actions={actions}
        />

        <CatalogClient
          supplierId={bootstrap.supplier.id}
          packages={bootstrap.packages}
          rules={bootstrap.rules}
          subcategories={bootstrap.subcategories}
        />
      </div>

      <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/40 backdrop-blur-[2px]">
        <div className="mx-4 flex max-w-md flex-col items-center gap-3 rounded-xl border border-border bg-card/95 p-6 text-center shadow-brand">
          <Badge
            variant="outline"
            className="gap-1 border-brand-cobalt-500/30 bg-brand-cobalt-100 text-brand-cobalt-500"
          >
            <Sparkles className="size-3.5" aria-hidden />
            {t("comingSoonBadge")}
          </Badge>
          <h2 className="text-xl font-bold tracking-tight text-brand-navy-900">
            {t("comingSoonTitle")}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("comingSoonDescription")}
          </p>
        </div>
      </div>
    </section>
  );
}
