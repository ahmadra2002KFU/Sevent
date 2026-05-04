import { getTranslations } from "next-intl/server";
import { Sparkles } from "lucide-react";
import { requireAccess } from "@/lib/auth/access";
import { Badge } from "@/components/ui/badge";

export default async function SupplierCatalogPage() {
  await requireAccess("supplier.catalog");
  const t = await getTranslations("supplier.catalog");

  return (
    <section className="flex min-h-[60vh] items-center justify-center">
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
    </section>
  );
}
