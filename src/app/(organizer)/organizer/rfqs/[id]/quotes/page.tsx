/**
 * Sprint 4 Lane 3 — organizer quote-comparison page.
 *
 * Loads the comparison dataset via `loadQuotesComparison()` and renders the
 * side-by-side grid. The loader gates auth + ownership and is shared with the
 * print and CSV-export routes so all three views render the same numbers.
 */

import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { BackLink } from "@/components/ui-ext/BackLink";
import { QuoteComparisonGrid } from "./QuoteComparisonGrid";
import { loadQuotesComparison } from "./loader";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function OrganizerQuotesComparisonPage({
  params,
}: PageProps) {
  const { id } = await params;
  const data = await loadQuotesComparison(id);
  const t = await getTranslations("organizer.quote.compare");

  return (
    <section className="flex flex-col gap-6">
      <BackLink href={`/organizer/rfqs/${id}`} label={t("backToRfq")} />

      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />

      <QuoteComparisonGrid data={data} />
    </section>
  );
}
