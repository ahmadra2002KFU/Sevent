import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth/access";
import { EventForm } from "./event-form";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  await requireAccess("organizer.events");

  const t = await getTranslations("organizer.eventForm");
  const eventsT = await getTranslations("organizer.events");

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" asChild>
        <Link href="/organizer/events">
          <ArrowLeft className="rtl:rotate-180" aria-hidden />
          {eventsT("backToEvents")}
        </Link>
      </Button>
      <div className="flex flex-col gap-1 border-b pb-5">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-cobalt-500">
          {eventsT("title")}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-navy-900 sm:text-3xl">
          {t("title")}
        </h1>
      </div>
      <EventForm />
    </section>
  );
}
