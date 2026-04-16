import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatHalalas } from "@/lib/domain/money";
import { declineInviteAction } from "../actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

type DetailRow = {
  id: string;
  supplier_id: string;
  status: "invited" | "declined" | "quoted" | "withdrawn";
  sent_at: string;
  response_due_at: string;
  responded_at: string | null;
  decline_reason_code: string | null;
  rfqs: {
    id: string;
    subcategory_id: string;
    requirements_jsonb: unknown;
    events: {
      id: string;
      city: string;
      venue_address: string | null;
      starts_at: string;
      ends_at: string;
      guest_count: number | null;
      budget_range_min_halalas: number | null;
      budget_range_max_halalas: number | null;
      notes: string | null;
    } | null;
    categories: {
      id: string;
      slug: string;
      name_en: string;
    } | null;
  } | null;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
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

function formatBudget(
  min: number | null | undefined,
  max: number | null | undefined,
): string {
  if (min == null && max == null) return "—";
  if (min != null && max != null) return `${formatHalalas(min)} – ${formatHalalas(max)}`;
  if (min != null) return `≥ ${formatHalalas(min)}`;
  if (max != null) return `≤ ${formatHalalas(max)}`;
  return "—";
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </dt>
      <dd className="text-sm text-[var(--color-foreground)]">{value}</dd>
    </div>
  );
}

function RequirementsBlock({ requirements }: { requirements: unknown }) {
  if (!requirements || typeof requirements !== "object") {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        No structured requirements.
      </p>
    );
  }
  const r = requirements as { kind?: string } & Record<string, unknown>;
  const rows: Array<{ label: string; value: string }> = [];

  switch (r.kind) {
    case "venues": {
      const seating = r.seating_style as string | undefined;
      const io = r.indoor_outdoor as string | undefined;
      const parking = r.needs_parking as boolean | undefined;
      const kitchen = r.needs_kitchen as boolean | undefined;
      if (seating) rows.push({ label: "Seating style", value: seating });
      if (io) rows.push({ label: "Indoor / outdoor", value: io });
      rows.push({ label: "Needs parking", value: parking ? "Yes" : "No" });
      rows.push({ label: "Needs kitchen", value: kitchen ? "Yes" : "No" });
      break;
    }
    case "catering": {
      const meal = r.meal_type as string | undefined;
      const dietary = r.dietary as string[] | undefined;
      const style = r.service_style as string | undefined;
      if (meal) rows.push({ label: "Meal type", value: meal });
      if (dietary && dietary.length > 0)
        rows.push({ label: "Dietary", value: dietary.join(", ") });
      if (style) rows.push({ label: "Service style", value: style });
      break;
    }
    case "photography": {
      const hours = r.coverage_hours as number | undefined;
      const deliverables = r.deliverables as string[] | undefined;
      const crew = r.crew_size as number | undefined;
      if (hours != null) rows.push({ label: "Coverage hours", value: String(hours) });
      if (deliverables && deliverables.length > 0)
        rows.push({ label: "Deliverables", value: deliverables.join(", ") });
      if (crew != null) rows.push({ label: "Crew size", value: String(crew) });
      break;
    }
    case "generic": {
      const notes = r.notes as string | undefined;
      if (notes) rows.push({ label: "Notes", value: notes });
      break;
    }
    default:
      return (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Requirements payload kind not recognized.
        </p>
      );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        No requirements provided.
      </p>
    );
  }

  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {rows.map((row) => (
        <Field key={row.label} label={row.label} value={row.value} />
      ))}
    </dl>
  );
}

export default async function SupplierRfqDetailPage({ params }: PageProps) {
  const { id } = await params;
  const t = await getTranslations("supplier.rfqInbox");
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: supplierRow } = await supabase
    .from("suppliers")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!supplierRow) notFound();

  const { data: inviteData } = await supabase
    .from("rfq_invites")
    .select(
      `id, supplier_id, status, sent_at, response_due_at, responded_at, decline_reason_code,
       rfqs (
         id, subcategory_id, requirements_jsonb,
         events (
           id, city, venue_address, starts_at, ends_at, guest_count,
           budget_range_min_halalas, budget_range_max_halalas, notes
         ),
         categories!rfqs_subcategory_id_fkey ( id, slug, name_en )
       )`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!inviteData) notFound();
  const invite = inviteData as unknown as DetailRow;

  // Belt-and-suspenders — RLS should already scope this, but make the server
  // action flow fail closed when any UI fetches a sibling invite by id.
  if (invite.supplier_id !== (supplierRow as { id: string }).id) notFound();

  const rfq = invite.rfqs;
  const event = rfq?.events ?? null;
  const subcategory = rfq?.categories ?? null;

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">
          {subcategory?.name_en ?? "RFQ"}
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {t("subtitle")}
        </p>
      </header>

      <article className="rounded-lg border border-[var(--color-border)] bg-white p-6">
        <h2 className="text-lg font-semibold">Event snapshot</h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="City" value={event?.city ?? "—"} />
          <Field
            label="Venue address"
            value={event?.venue_address ?? "—"}
          />
          <Field label="Starts" value={formatDate(event?.starts_at)} />
          <Field label="Ends" value={formatDate(event?.ends_at)} />
          <Field
            label="Guest count"
            value={event?.guest_count != null ? event.guest_count : "—"}
          />
          <Field
            label="Budget range"
            value={formatBudget(
              event?.budget_range_min_halalas,
              event?.budget_range_max_halalas,
            )}
          />
          {event?.notes ? (
            <div className="sm:col-span-2">
              <Field label="Organizer notes" value={event.notes} />
            </div>
          ) : null}
        </dl>
      </article>

      <article className="rounded-lg border border-[var(--color-border)] bg-white p-6">
        <h2 className="text-lg font-semibold">Requirements</h2>
        <div className="mt-4">
          <RequirementsBlock requirements={rfq?.requirements_jsonb} />
        </div>
      </article>

      <article className="rounded-lg border border-[var(--color-border)] bg-white p-6">
        <h2 className="text-lg font-semibold">Respond</h2>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Due by {formatDate(invite.response_due_at)}
        </p>

        <div className="mt-4 flex flex-col gap-6 lg:flex-row">
          <form
            action={declineInviteAction}
            className="flex flex-1 flex-col gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-4"
          >
            <input type="hidden" name="invite_id" value={invite.id} />
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t("declineReasonLabel")}</span>
              <select
                name="decline_reason_code"
                required
                className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              >
                <option value="too_busy">{t("declineReason.too_busy")}</option>
                <option value="out_of_area">
                  {t("declineReason.out_of_area")}
                </option>
                <option value="price_mismatch">
                  {t("declineReason.price_mismatch")}
                </option>
                <option value="other">{t("declineReason.other")}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Note (optional)</span>
              <textarea
                name="note"
                rows={3}
                maxLength={500}
                className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              className="self-start rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              {t("decline")}
            </button>
          </form>

          <div className="flex flex-1 flex-col gap-3 rounded-md border border-dashed border-[var(--color-border)] p-4">
            <button
              type="button"
              disabled
              title="Coming in Sprint 4"
              className="self-start rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2 text-sm font-medium text-[var(--color-muted-foreground)]"
            >
              {t("quoteLater")}
            </button>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Quoting unlocks in Sprint 4. For now, decline or let the deadline
              pass.
            </p>
          </div>
        </div>
      </article>
    </section>
  );
}
