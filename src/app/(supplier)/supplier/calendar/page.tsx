import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { endOfMonth, startOfMonth } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { loadCalendarData } from "./actions";
import { MonthGrid } from "./month-grid";
import { BlockList } from "./block-list";

type SearchParams = Promise<{ y?: string; m?: string }>;

function clampMonth(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1 || n > 12) return fallback;
  return n;
}

function clampYear(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  // Allow a generous window so navigation never "sticks" on a busted value.
  if (!Number.isFinite(n) || n < 2000 || n > 2100) return fallback;
  return n;
}

export default async function SupplierCalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = clampYear(params.y, now.getFullYear());
  const month = clampMonth(params.m, now.getMonth() + 1);

  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);

  const t = await getTranslations("supplier.calendar");

  const result = await loadCalendarData(monthStart, monthEnd);

  // Calendar is no longer in the top nav — it's reached via a button on the
  // bookings page. Surface a return link here so the user is never stranded.
  const backToBookings = (
    <Button asChild variant="link" size="sm" className="w-fit px-0">
      <Link href="/supplier/bookings">
        <ArrowLeft aria-hidden />
        {t("backToBookings")}
      </Link>
    </Button>
  );

  if (!result.ok) {
    return (
      <section className="flex flex-col gap-6">
        {backToBookings}
        <PageHeader title={t("title")} />
        <Alert variant="destructive">
          <AlertTitle>{t("errorHeading")}</AlertTitle>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      {backToBookings}
      <PageHeader title={t("title")} description={t("subtitle")} />

      <MonthGrid
        year={year}
        month={month}
        blocks={result.blocks}
        labels={{
          title: t("title"),
          prev: t("prevMonth"),
          next: t("nextMonth"),
          legendManual: t("legendManual"),
          legendSoftHold: t("legendSoftHold"),
          legendBooked: t("legendBooked"),
          today: t("today"),
          weekdays: [
            t("weekday.sun"),
            t("weekday.mon"),
            t("weekday.tue"),
            t("weekday.wed"),
            t("weekday.thu"),
            t("weekday.fri"),
            t("weekday.sat"),
          ],
        }}
      />

      <BlockList
        blocks={result.manualBlocks}
        labels={{
          heading: t("manualListHeading"),
          noBlocks: t("noBlocks"),
          newBlock: t("newBlock"),
          edit: t("edit"),
          delete: t("delete"),
          cancel: t("cancel"),
          save: t("save"),
          saving: t("saving"),
          confirmDelete: t("confirmDelete"),
          starts: t("starts"),
          ends: t("ends"),
          notes: t("notes"),
          conflict: t("conflict"),
          formTitleNew: t("formTitleNew"),
          formTitleEdit: t("formTitleEdit"),
        }}
      />
    </section>
  );
}
