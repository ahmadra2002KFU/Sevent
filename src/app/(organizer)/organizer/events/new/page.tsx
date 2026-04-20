import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/supabase/server";
import { EventForm } from "./event-form";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const gate = await requireRole(["organizer", "agency", "admin"]);
  if (gate.status === "unauthenticated") redirect("/sign-in?next=/organizer/events/new");
  if (gate.status === "forbidden") redirect("/");

  const t = await getTranslations("organizer.eventForm");
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
      </header>
      <EventForm />
    </section>
  );
}
