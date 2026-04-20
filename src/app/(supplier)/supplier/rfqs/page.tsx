import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type InviteRow = {
  id: string;
  status: "invited" | "declined" | "quoted" | "withdrawn";
  sent_at: string;
  response_due_at: string;
  responded_at: string | null;
  decline_reason_code: string | null;
  rfqs: {
    id: string;
    subcategory_id: string;
    events: {
      id: string;
      city: string;
      starts_at: string;
      ends_at: string;
      guest_count: number | null;
    } | null;
    categories: {
      id: string;
      slug: string;
      name_en: string;
    } | null;
  } | null;
};

function countdownLabel(
  t: (key: string, values?: Record<string, string | number | Date>) => string,
  responseDueAt: string,
): string {
  const diffMs = Date.parse(responseDueAt) - Date.now();
  if (Number.isNaN(diffMs)) return "";
  if (diffMs <= 0) return t("expired");
  const hours = Math.max(1, Math.ceil(diffMs / (60 * 60 * 1000)));
  return t("countdownHours", { hours });
}

function formatEventDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function SupplierRfqInboxPage() {
  const t = await getTranslations("supplier.rfqInbox");

  const gate = await requireRole("supplier");
  if (gate.status === "unauthenticated") redirect("/sign-in?next=/supplier/rfqs");
  if (gate.status === "forbidden") redirect("/supplier/onboarding");
  const { user, admin } = gate;

  const { data: supplierRow } = await admin
    .from("suppliers")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!supplierRow) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">{t("empty")}</p>
      </section>
    );
  }

  const supplierId = (supplierRow as { id: string }).id;

  const { data: invitesData } = await admin
    .from("rfq_invites")
    .select(
      `id, status, sent_at, response_due_at, responded_at, decline_reason_code,
       rfqs (
         id, subcategory_id,
         events ( id, city, starts_at, ends_at, guest_count ),
         categories!rfqs_subcategory_id_fkey ( id, slug, name_en )
       )`,
    )
    .eq("supplier_id", supplierId)
    .order("sent_at", { ascending: false });

  const rawInvites = (invitesData ?? []) as unknown as InviteRow[];

  // Open invites come first — they're the only actionable rows. Everything
  // else (quoted / declined / withdrawn) surfaces below as past activity so
  // suppliers can still find responses they already sent.
  const invited = rawInvites.filter((row) => row.status === "invited");
  const past = rawInvites.filter((row) => row.status !== "invited");

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {t("subtitle")}
        </p>
      </header>

      {invited.length === 0 ? (
        <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-6 text-sm text-[var(--color-muted-foreground)]">
          {t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {invited.map((invite) => {
            const event = invite.rfqs?.events;
            const subcategory = invite.rfqs?.categories;
            return (
              <li key={invite.id}>
                <Link
                  href={`/supplier/rfqs/${invite.id}`}
                  className="block rounded-lg border border-[var(--color-border)] bg-white p-4 transition hover:border-[var(--color-sevent-green)] hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-base font-semibold">
                        {subcategory?.name_en ?? "RFQ"}
                      </span>
                      <span className="text-sm text-[var(--color-muted-foreground)]">
                        {event?.city ?? "—"}
                        {event?.starts_at
                          ? ` · ${formatEventDate(event.starts_at)}`
                          : ""}
                        {event?.guest_count
                          ? ` · ${event.guest_count} guests`
                          : ""}
                      </span>
                    </div>
                    <span
                      className="rounded-full border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-1 text-xs font-medium text-[var(--color-foreground)]"
                      aria-label={t("expiresIn", {
                        time: countdownLabel(t, invite.response_due_at),
                      })}
                    >
                      {countdownLabel(t, invite.response_due_at)}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {past.length > 0 ? (
        <details className="rounded-md border border-[var(--color-border)] bg-white">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
            Past ({past.length})
          </summary>
          <ul className="flex flex-col divide-y divide-[var(--color-border)]">
            {past.map((invite) => {
              const event = invite.rfqs?.events;
              const subcategory = invite.rfqs?.categories;
              const isQuoted = invite.status === "quoted";
              return (
                <li
                  key={invite.id}
                  className="flex flex-col gap-1 px-4 py-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/supplier/rfqs/${invite.id}`}
                      className="font-medium hover:underline"
                    >
                      {subcategory?.name_en ?? "RFQ"}
                      {event?.city ? ` · ${event.city}` : ""}
                    </Link>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--color-muted-foreground)]">
                        {t(`status.${invite.status}`)}
                      </span>
                      {isQuoted ? (
                        <Link
                          href={`/supplier/rfqs/${invite.id}/quote`}
                          className="text-xs font-medium text-[var(--color-sevent-green,#0a7)] hover:underline"
                        >
                          {t("revise")}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  {event?.starts_at ? (
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      {formatEventDate(event.starts_at)}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
