import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { requireRole } from "@/lib/supabase/server";
import type {
  SupplierDocStatus,
  SupplierVerificationStatus,
} from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui-ext/EmptyState";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { StatusPill } from "@/components/ui-ext/StatusPill";
import type { StatusPillStatus } from "@/components/ui-ext/StatusPill";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

type SupplierListRow = {
  id: string;
  business_name: string;
  slug: string;
  base_city: string;
  legal_type: string;
  verification_status: SupplierVerificationStatus;
  created_at: string;
  supplier_docs: Array<{
    id: string;
    doc_type: string;
    status: SupplierDocStatus;
  }>;
};

type FilterKey = "all" | "pending" | "approved" | "rejected";

const FILTER_KEYS: FilterKey[] = ["all", "pending", "approved", "rejected"];

function parseFilter(raw: string | undefined): FilterKey {
  const v = (raw ?? "pending").toLowerCase();
  if ((FILTER_KEYS as string[]).includes(v)) return v as FilterKey;
  return "pending";
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function verificationStatusPill(
  status: SupplierVerificationStatus,
): StatusPillStatus {
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  return "pending";
}

type Translator = (key: string) => string;

function legalTypeLabel(raw: string, t: Translator): string {
  const known = ["company", "freelancer", "foreign"];
  if (known.includes(raw)) return t(`legalType.${raw}`);
  return raw;
}

export default async function AdminVerificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; tab?: string; page?: string }>;
}) {
  const t = await getTranslations("admin.verifications");
  const tPag = await getTranslations("pagination");
  const params = await searchParams;
  // Accept both legacy `?tab=` and the new `?filter=` for URL stability.
  const filter = parseFilter(params.filter ?? params.tab);
  const page = parsePage(params.page);

  const gate = await requireRole("admin");
  if (gate.status === "unauthenticated") {
    redirect(`/sign-in?next=${encodeURIComponent("/admin/verifications")}`);
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

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = admin
    .from("suppliers")
    .select(
      "id, business_name, slug, base_city, legal_type, verification_status, created_at, supplier_docs(id, doc_type, status)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filter !== "all") {
    query = query.eq("verification_status", filter);
  }

  const { data, error, count } = await query;
  const suppliers: SupplierListRow[] = (data as SupplierListRow[] | null) ?? [];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {/* URL-controlled filter — rendered as a link group so the page stays
          a pure server component. shadcn Tabs is a client primitive; we want
          crawlable, shareable URLs for the admin queue, so links are better
          here than `<Tabs value onValueChange>`. */}
      <nav
        aria-label={t("title")}
        className="inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-1"
      >
        {FILTER_KEYS.map((key) => {
          const active = key === filter;
          const labelKey =
            key === "all"
              ? "allTab"
              : key === "pending"
                ? "pendingTab"
                : key === "approved"
                  ? "approvedTab"
                  : "rejectedTab";
          return (
            <Link
              key={key}
              href={`/admin/verifications?filter=${key}`}
              className={cn(
                "inline-flex h-7 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              {t(labelKey)}
            </Link>
          );
        })}
      </nav>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-semantic-danger-500/30 bg-semantic-danger-100 px-3 py-2 text-sm text-semantic-danger-500"
        >
          Failed to load suppliers: {error.message}
        </div>
      ) : null}

      {suppliers.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={filter === "all" ? t("list.emptyAll") : t("empty")}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("list.col.business")}</TableHead>
                  <TableHead>{t("list.col.legalType")}</TableHead>
                  <TableHead>{t("list.col.submitted")}</TableHead>
                  <TableHead>{t("list.col.docs")}</TableHead>
                  <TableHead>{t("list.col.status")}</TableHead>
                  <TableHead className="text-end">
                    {t("list.col.action")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s) => {
                  const docCount = s.supplier_docs?.length ?? 0;
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {s.business_name}
                          </span>
                          <code className="text-xs text-muted-foreground">
                            /{s.slug}
                          </code>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {legalTypeLabel(s.legal_type, t)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(s.created_at)}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {t("list.docCount", { count: docCount })}
                      </TableCell>
                      <TableCell>
                        <StatusPill
                          status={verificationStatusPill(s.verification_status)}
                        />
                      </TableCell>
                      <TableCell className="text-end">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/admin/verifications/${s.id}`}>
                            {t("list.review")}
                            <ArrowRight aria-hidden />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {totalPages > 1 ? (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-between gap-3 text-sm"
        >
          {page > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={{
                  pathname: "/admin/verifications",
                  query: { filter, page: page - 1 },
                }}
              >
                {tPag("previous")}
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            {tPag("pageOf", { page, totalPages })}
          </span>
          {page < totalPages ? (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={{
                  pathname: "/admin/verifications",
                  query: { filter, page: page + 1 },
                }}
              >
                {tPag("next")}
              </Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}
