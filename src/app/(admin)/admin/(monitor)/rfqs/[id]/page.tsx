import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, FileText, Inbox, MessageSquare } from "lucide-react";
import { requireRole } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { StatusPill } from "@/components/ui-ext/StatusPill";
import type { StatusPillStatus } from "@/components/ui-ext/StatusPill";
import {
  fmtDate as fmtDateHelper,
  fmtDateTime as fmtDateTimeHelper,
  type SupportedLocale,
} from "@/lib/domain/formatDate";
import { segmentNameFor } from "@/lib/domain/segments";
import { cityNameFor } from "@/lib/domain/cities";
import { categoryName } from "@/lib/domain/taxonomy";
import {
  RfqExtension,
  inviteDisplayStatus,
  type RfqInviteSource,
  type RfqInviteStatus,
} from "@/lib/domain/rfq";
import { formatMoney } from "@/lib/domain/money";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage";

export const dynamic = "force-dynamic";

type RfqDetailRow = {
  id: string;
  status: string;
  is_published_to_marketplace: boolean | null;
  sent_at: string | null;
  expires_at: string | null;
  created_at: string;
  requirements_jsonb: unknown;
  event_id: string;
  events: {
    id: string;
    city: string;
    event_type: string;
    starts_at: string;
    organizer_id: string;
    guest_count: number | null;
    budget_range_min_halalas: number | string | null;
    budget_range_max_halalas: number | string | null;
  } | null;
  cat: { id: string; name_en: string; name_ar: string | null } | null;
  sub: { id: string; name_en: string; name_ar: string | null } | null;
};

type InviteRow = {
  id: string;
  supplier_id: string;
  source: string;
  status: string;
  sent_at: string | null;
  response_due_at: string | null;
  responded_at: string | null;
  suppliers: {
    id: string;
    business_name: string;
    base_city: string | null;
    verification_status: string;
    slug: string | null;
  } | null;
};

type QuoteRow = {
  id: string;
  supplier_id: string;
  status: string;
  current_revision_id: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  suppliers: { id: string; business_name: string } | null;
};

type RevisionRow = {
  id: string;
  quote_id: string;
  version: number;
  content_hash: string | null;
  created_at: string;
};

type ProposalRequestRow = {
  id: string;
  quote_id: string;
  requested_by: string;
  message: string | null;
  response_file_path: string | null;
  status: string;
  requested_at: string;
  responded_at: string | null;
};

type BookingRow = {
  id: string;
  rfq_id: string;
  quote_id: string;
  accepted_quote_revision_id: string;
  supplier_id: string;
  confirmation_status: string;
  payment_status: string;
  service_status: string;
  created_at: string;
};

function rfqStatusPill(status: string): StatusPillStatus {
  switch (status) {
    case "draft":
    case "pending":
    case "sent":
    case "quoted":
    case "expired":
    case "booked":
    case "cancelled":
    case "accepted":
    case "rejected":
    case "withdrawn":
    case "invited":
    case "applied":
    case "declined":
    case "confirmed":
    case "completed":
    case "paid":
    case "awaiting_supplier":
    case "approved":
      return status as StatusPillStatus;
    default:
      return "pending";
  }
}

function toNumberOrNull(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default async function AdminRfqDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations("admin.rfqs");
  const tDetail = await getTranslations("admin.rfqs.detail");
  const tProposalStatus = await getTranslations("admin.proposals.status");
  const tBooking = await getTranslations("bookingStatus");

  const gate = await requireRole("admin");
  if (gate.status === "unauthenticated") {
    redirect(`/sign-in?next=${encodeURIComponent(`/admin/rfqs/${id}`)}`);
  }
  if (gate.status === "forbidden") {
    return (
      <section className="flex flex-col gap-3">
        <PageHeader title={t("title")} />
        <p className="text-sm text-semantic-danger-500">
          {t("errorAdminRequired")}
        </p>
      </section>
    );
  }
  const { admin } = gate;

  const fmtDate = (iso: string | null): string =>
    fmtDateHelper(iso, locale) || "—";
  const fmtDateTime = (iso: string | null): string =>
    fmtDateTimeHelper(iso, locale) || "—";

  // ---------------------------------------------------------------------------
  // First-wave reads: RFQ + invites + quotes + booking, all independent.
  // ---------------------------------------------------------------------------
  const [rfqRes, invitesRes, quotesRes, bookingRes] = await Promise.all([
    admin
      .from("rfqs")
      .select(
        `id, status, is_published_to_marketplace, sent_at, expires_at, created_at,
         requirements_jsonb, event_id,
         events ( id, city, event_type, starts_at, organizer_id, guest_count,
                  budget_range_min_halalas, budget_range_max_halalas ),
         cat:categories!rfqs_category_id_fkey ( id, name_en, name_ar ),
         sub:categories!rfqs_subcategory_id_fkey ( id, name_en, name_ar )`,
      )
      .eq("id", id)
      .maybeSingle(),
    admin
      .from("rfq_invites")
      .select(
        `id, supplier_id, source, status, sent_at, response_due_at, responded_at,
         suppliers ( id, business_name, base_city, verification_status, slug )`,
      )
      .eq("rfq_id", id)
      .order("sent_at", { ascending: false, nullsFirst: false }),
    admin
      .from("quotes")
      .select(
        `id, supplier_id, status, current_revision_id, sent_at, accepted_at,
         suppliers ( id, business_name )`,
      )
      .eq("rfq_id", id)
      .order("sent_at", { ascending: false, nullsFirst: false }),
    admin
      .from("bookings")
      .select(
        `id, rfq_id, quote_id, accepted_quote_revision_id, supplier_id,
         confirmation_status, payment_status, service_status, created_at`,
      )
      .eq("rfq_id", id)
      .maybeSingle(),
  ]);

  const rfq = rfqRes.data as RfqDetailRow | null;
  if (!rfq) {
    notFound();
  }
  const invites = (invitesRes.data ?? []) as unknown as InviteRow[];
  const quotes = (quotesRes.data ?? []) as unknown as QuoteRow[];
  const booking = bookingRes.data as BookingRow | null;

  // ---------------------------------------------------------------------------
  // Second-wave reads: keyed on the quote IDs we just resolved.
  // ---------------------------------------------------------------------------
  const quoteIds = quotes.map((q) => q.id);
  const [revisionsRes, proposalRequestsRes, organizerRes] = await Promise.all([
    quoteIds.length > 0
      ? admin
          .from("quote_revisions")
          .select("id, quote_id, version, content_hash, created_at")
          .in("quote_id", quoteIds)
          .order("version", { ascending: false })
      : Promise.resolve({ data: [] }),
    quoteIds.length > 0
      ? admin
          .from("quote_proposal_requests")
          .select(
            `id, quote_id, requested_by, message, response_file_path, status,
             requested_at, responded_at`,
          )
          .in("quote_id", quoteIds)
          .order("requested_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    rfq.events?.organizer_id
      ? admin
          .from("profiles")
          .select("id, full_name")
          .eq("id", rfq.events.organizer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const revisions = ((revisionsRes.data ?? []) as RevisionRow[]).slice();
  const proposalRequests = ((proposalRequestsRes.data ?? []) as
    ProposalRequestRow[]).slice();
  const organizer = organizerRes.data as
    | { id: string; full_name: string | null }
    | null;

  // ---------------------------------------------------------------------------
  // Signed-URL minting for fulfilled proposal PDFs.
  // ---------------------------------------------------------------------------
  // Per `supabase/migrations/20260504080000_quote_proposal_requests.sql`:
  // response_file_path points into the `supplier-docs` bucket under
  // `{supplier_id}/proposal-responses/...`. The supplier action that uploads
  // these files writes to STORAGE_BUCKETS.docs (see
  // src/app/(supplier)/supplier/rfqs/[id]/proposal-upload/actions.ts:140).
  const proposalUrlByRequestId = new Map<string, string>();
  const fulfilled = proposalRequests.filter(
    (r) => r.status === "fulfilled" && r.response_file_path,
  );
  if (fulfilled.length > 0) {
    const results = await Promise.all(
      fulfilled.map(async (r) => {
        try {
          const { data } = await admin.storage
            .from(STORAGE_BUCKETS.docs)
            .createSignedUrl(r.response_file_path as string, 300);
          return { id: r.id, url: data?.signedUrl ?? null };
        } catch {
          return { id: r.id, url: null };
        }
      }),
    );
    for (const r of results) {
      if (r.url) proposalUrlByRequestId.set(r.id, r.url);
    }
  }

  // Group revisions by quote for the per-quote disclosure.
  const revisionsByQuote = new Map<string, RevisionRow[]>();
  for (const r of revisions) {
    const list = revisionsByQuote.get(r.quote_id) ?? [];
    list.push(r);
    revisionsByQuote.set(r.quote_id, list);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const event = rfq.events;
  const eventType = event?.event_type
    ? segmentNameFor(event.event_type, locale)
    : "—";
  const city = event?.city ? cityNameFor(event.city, locale) : "—";
  const category = categoryName(rfq.cat, locale) || "—";
  const subcategory = categoryName(rfq.sub, locale) || "—";
  const minBudget = toNumberOrNull(event?.budget_range_min_halalas ?? null);
  const maxBudget = toNumberOrNull(event?.budget_range_max_halalas ?? null);
  const budgetLabel =
    minBudget == null && maxBudget == null
      ? "—"
      : `${minBudget != null ? formatMoney(minBudget, locale) : "—"} – ${
          maxBudget != null ? formatMoney(maxBudget, locale) : "—"
        }`;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/rfqs" className="gap-2">
            <ArrowLeft aria-hidden className="rtl:-scale-x-100 size-4" />
            {tDetail("back")}
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`${eventType} · ${city}`}
        description={`${category} · ${subcategory}`}
      />

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {tDetail("summary.heading")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <SummaryItem label={tDetail("summary.status")}>
            <StatusPill
              status={rfqStatusPill(rfq.status)}
              label={t(`status.${rfq.status}` as never)}
            />
          </SummaryItem>
          <SummaryItem label={tDetail("summary.marketplace")}>
            {rfq.is_published_to_marketplace
              ? tDetail("summary.marketplaceYes")
              : tDetail("summary.marketplaceNo")}
          </SummaryItem>
          <SummaryItem label={tDetail("summary.organizer")}>
            {organizer?.full_name || t("list.organizerUnknown")}
          </SummaryItem>
          <SummaryItem label={tDetail("summary.event")}>
            {event?.starts_at ? fmtDate(event.starts_at) : "—"}
          </SummaryItem>
          <SummaryItem label={tDetail("summary.guestCount")}>
            {event?.guest_count ?? "—"}
          </SummaryItem>
          <SummaryItem label={tDetail("summary.budget")}>
            {budgetLabel}
          </SummaryItem>
          <SummaryItem label={tDetail("summary.created")}>
            {fmtDateTime(rfq.created_at)}
          </SummaryItem>
          <SummaryItem label={tDetail("summary.sent")}>
            {fmtDateTime(rfq.sent_at)}
          </SummaryItem>
          <SummaryItem label={tDetail("summary.expires")}>
            {fmtDateTime(rfq.expires_at)}
          </SummaryItem>
        </CardContent>
      </Card>

      {/* Requirements */}
      <RequirementsSection payload={rfq.requirements_jsonb} />

      {/* Invites */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tDetail("invites.heading")}</CardTitle>
          <CardDescription>
            {tDetail("invites.col.supplier")} · {invites.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {invites.length === 0 ? (
            <EmptyState icon={Inbox} title={tDetail("invites.empty")} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tDetail("invites.col.supplier")}</TableHead>
                  <TableHead>{tDetail("invites.col.source")}</TableHead>
                  <TableHead>{tDetail("invites.col.status")}</TableHead>
                  <TableHead>{tDetail("invites.col.sent")}</TableHead>
                  <TableHead>{tDetail("invites.col.due")}</TableHead>
                  <TableHead>{tDetail("invites.col.responded")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {inv.suppliers?.business_name ?? "—"}
                        </span>
                        {inv.suppliers?.base_city ? (
                          <span className="text-xs text-muted-foreground">
                            {cityNameFor(inv.suppliers.base_city, locale)}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {tDetail(
                        `invites.source.${inv.source as never}` as never,
                      )}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const displayStatus = inviteDisplayStatus(
                          inv.status as RfqInviteStatus,
                          inv.source as RfqInviteSource,
                        );
                        return (
                          <StatusPill
                            status={rfqStatusPill(displayStatus)}
                            label={t(`inviteStatus.${displayStatus}` as never)}
                          />
                        );
                      })()}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {fmtDateTime(inv.sent_at)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {fmtDateTime(inv.response_due_at)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {fmtDateTime(inv.responded_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Quotes + revisions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tDetail("quotes.heading")}</CardTitle>
          <CardDescription>
            {tDetail("quotes.col.supplier")} · {quotes.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {quotes.length === 0 ? (
            <EmptyState icon={Inbox} title={tDetail("quotes.empty")} />
          ) : (
            <ul className="divide-y divide-border">
              {quotes.map((q) => {
                const qRevs = revisionsByQuote.get(q.id) ?? [];
                const latestVersion = qRevs[0]?.version ?? null;
                return (
                  <li key={q.id} id={`quote-${q.id}`} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {q.suppliers?.business_name ?? "—"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {tDetail("quotes.col.sent")}:{" "}
                          {fmtDateTime(q.sent_at)}
                          {q.accepted_at ? (
                            <>
                              {" · "}
                              {tDetail("quotes.col.accepted")}:{" "}
                              {fmtDateTime(q.accepted_at)}
                            </>
                          ) : null}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          v{latestVersion ?? "—"}
                        </span>
                        <StatusPill
                          status={rfqStatusPill(q.status)}
                          label={t(`quoteStatus.${q.status}` as never)}
                        />
                      </div>
                    </div>

                    {qRevs.length > 0 ? (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs text-brand-cobalt-500 hover:underline">
                          {tDetail("quotes.revisions.toggle")} ({qRevs.length})
                        </summary>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>
                                {tDetail("quotes.revisions.col.version")}
                              </TableHead>
                              <TableHead>
                                {tDetail("quotes.revisions.col.created")}
                              </TableHead>
                              <TableHead>
                                {tDetail("quotes.revisions.col.hash")}
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {qRevs.map((rev) => (
                              <TableRow key={rev.id}>
                                <TableCell className="tabular-nums">
                                  v{rev.version}
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                  {fmtDateTime(rev.created_at)}
                                </TableCell>
                                <TableCell>
                                  <code className="text-xs text-muted-foreground">
                                    {rev.content_hash
                                      ? rev.content_hash.slice(0, 12)
                                      : "—"}
                                  </code>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </details>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Proposal requests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {tDetail("proposalRequests.heading")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {proposalRequests.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={tDetail("proposalRequests.empty")}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {tDetail("proposalRequests.col.supplier")}
                  </TableHead>
                  <TableHead>
                    {tDetail("proposalRequests.col.status")}
                  </TableHead>
                  <TableHead>
                    {tDetail("proposalRequests.col.requested")}
                  </TableHead>
                  <TableHead>
                    {tDetail("proposalRequests.col.responded")}
                  </TableHead>
                  <TableHead>{tDetail("proposalRequests.col.file")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposalRequests.map((p) => {
                  const supplier = quotes.find(
                    (q) => q.id === p.quote_id,
                  )?.suppliers;
                  const url = proposalUrlByRequestId.get(p.id) ?? null;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-foreground">
                        {supplier?.business_name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <StatusPill
                          status={
                            p.status === "fulfilled"
                              ? "completed"
                              : rfqStatusPill(p.status)
                          }
                          label={tProposalStatus(p.status as never)}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {fmtDateTime(p.requested_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {fmtDateTime(p.responded_at)}
                      </TableCell>
                      <TableCell>
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-brand-cobalt-500 hover:underline"
                          >
                            {tDetail("proposalRequests.openFile")}
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {tDetail("proposalRequests.noFile")}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Booking */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare aria-hidden className="size-4" />
            {tDetail("booking.heading")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!booking ? (
            <p className="text-sm text-muted-foreground">
              {tDetail("booking.none")}
            </p>
          ) : (
            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <SummaryItem label={tDetail("booking.confirmation")}>
                <StatusPill
                  status={rfqStatusPill(booking.confirmation_status)}
                  label={tBooking(`confirmation.${booking.confirmation_status}`)}
                />
              </SummaryItem>
              <SummaryItem label={tDetail("booking.payment")}>
                <StatusPill
                  status={rfqStatusPill(booking.payment_status)}
                  label={tBooking(`payment.${booking.payment_status}`)}
                />
              </SummaryItem>
              <SummaryItem label={tDetail("booking.service")}>
                <StatusPill
                  status={rfqStatusPill(booking.service_status)}
                  label={tBooking(`service.${booking.service_status}`)}
                />
              </SummaryItem>
              <SummaryItem label={tDetail("summary.created")}>
                {fmtDateTime(booking.created_at)}
              </SummaryItem>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function SummaryItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  );
}

async function RequirementsSection({ payload }: { payload: unknown }) {
  const t = await getTranslations("admin.rfqs.detail.requirements");
  const tValues = await getTranslations("requirementValues");

  const parsed = RfqExtension.safeParse(payload);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("heading")}</CardTitle>
      </CardHeader>
      <CardContent>
        {!parsed.success ? (
          <>
            <p className="mb-2 text-xs text-muted-foreground">
              {t("unknownKind")}
            </p>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </>
        ) : (
          <RequirementsBody value={parsed.data} t={t} tValues={tValues} />
        )}
      </CardContent>
    </Card>
  );
}

function RequirementsBody({
  value,
  t,
  tValues,
}: {
  value: import("@/lib/domain/rfq").RfqExtension;
  t: Awaited<ReturnType<typeof getTranslations>>;
  tValues: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const yn = (b: boolean) => (b ? t("yes") : t("no"));
  const fields: Array<{ label: string; node: React.ReactNode }> = [
    { label: t("field.kind"), node: tValues(`kind.${value.kind}`) },
  ];
  switch (value.kind) {
    case "venues":
      fields.push(
        {
          label: t("field.seating_style"),
          node: tValues(`seating_style.${value.seating_style}`),
        },
        {
          label: t("field.indoor_outdoor"),
          node: tValues(`indoor_outdoor.${value.indoor_outdoor}`),
        },
        { label: t("field.needs_parking"), node: yn(value.needs_parking) },
        { label: t("field.needs_kitchen"), node: yn(value.needs_kitchen) },
      );
      break;
    case "catering":
      fields.push(
        {
          label: t("field.meal_type"),
          node: tValues(`meal_type.${value.meal_type}`),
        },
        {
          label: t("field.dietary"),
          node:
            value.dietary.length > 0
              ? value.dietary
                  .map((d) => tValues(`dietary.${d}`))
                  .join(", ")
              : "—",
        },
        {
          label: t("field.service_style"),
          node: tValues(`service_style.${value.service_style}`),
        },
      );
      break;
    case "photography":
      fields.push(
        { label: t("field.coverage_hours"), node: value.coverage_hours },
        {
          label: t("field.deliverables"),
          node: value.deliverables
            .map((d) => tValues(`deliverables.${d}`))
            .join(", "),
        },
        { label: t("field.crew_size"), node: value.crew_size },
      );
      break;
    case "generic":
      fields.push(
        { label: t("field.qty"), node: value.qty ?? "—" },
        {
          label: t("field.notes"),
          node: value.notes ? (
            <span className="whitespace-pre-wrap text-foreground">
              {value.notes}
            </span>
          ) : (
            "—"
          ),
        },
      );
      break;
  }
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((f, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">{f.label}</dt>
          <dd className="text-sm text-foreground">{f.node}</dd>
        </div>
      ))}
    </dl>
  );
}
