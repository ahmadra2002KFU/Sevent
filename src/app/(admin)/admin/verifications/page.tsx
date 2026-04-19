import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/supabase/server";
import type {
  SupplierDocStatus,
  SupplierVerificationStatus,
} from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

const TAB_TO_STATUS: Record<string, SupplierVerificationStatus> = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
};

function tabLabel(tab: string): string {
  switch (tab) {
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return "Pending";
  }
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

function legalTypeLabel(value: string): string {
  switch (value) {
    case "company":
      return "Company";
    case "freelancer":
      return "Freelancer";
    case "foreign":
      return "Foreign entity";
    default:
      return value;
  }
}

function docTypeLabel(value: string): string {
  switch (value) {
    case "cr":
      return "CR";
    case "vat":
      return "VAT";
    case "id":
      return "ID";
    case "gea_permit":
      return "GEA permit";
    case "certification":
      return "Cert";
    default:
      return value;
  }
}

function StatusPill({ status }: { status: SupplierDocStatus }) {
  const styles: Record<SupplierDocStatus, string> = {
    pending:
      "bg-[var(--color-muted)] text-[var(--color-muted-foreground)] border-[var(--color-border)]",
    approved: "bg-[#E2F4EA] text-[var(--color-sevent-green)] border-[#BDE3CB]",
    rejected: "bg-[#FCE9E9] text-[#9F1A1A] border-[#F2C2C2]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        styles[status],
      )}
    >
      {status}
    </span>
  );
}

export default async function AdminVerificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tabRaw = (params.tab ?? "pending").toLowerCase();
  const status = TAB_TO_STATUS[tabRaw] ?? "pending";

  const gate = await requireRole("admin");
  if (gate.status === "unauthenticated") {
    redirect(`/sign-in?next=${encodeURIComponent("/admin/verifications")}`);
  }
  if (gate.status === "forbidden") {
    return (
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">Verifications queue</h1>
        <p className="text-sm text-[#9F1A1A]">
          Admin role required to view this page.
        </p>
      </section>
    );
  }
  const { admin } = gate;

  const { data, error } = await admin
    .from("suppliers")
    .select(
      "id, business_name, slug, base_city, legal_type, verification_status, created_at, supplier_docs(id, doc_type, status)",
    )
    .eq("verification_status", status)
    .order("created_at", { ascending: false });

  const suppliers: SupplierListRow[] = (data as SupplierListRow[] | null) ?? [];

  const tabs: Array<keyof typeof TAB_TO_STATUS> = [
    "pending",
    "approved",
    "rejected",
  ];

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Verifications queue</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Review supplier documents, approve or reject each application, and
          notify the supplier by email.
        </p>
      </header>

      <nav className="flex items-center gap-1 border-b border-[var(--color-border)]">
        {tabs.map((t) => {
          const active = t === tabRaw || (t === "pending" && status === "pending" && tabRaw !== "approved" && tabRaw !== "rejected");
          return (
            <Link
              key={t}
              href={`/admin/verifications?tab=${t}`}
              className={cn(
                "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-[var(--color-sevent-green)] text-[var(--color-sevent-green)]"
                  : "border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]",
              )}
            >
              {tabLabel(t)}
            </Link>
          );
        })}
      </nav>

      {error ? (
        <p className="rounded-md border border-[#F2C2C2] bg-[#FCE9E9] px-3 py-2 text-sm text-[#9F1A1A]">
          Failed to load suppliers: {error.message}
        </p>
      ) : null}

      {suppliers.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--color-border)] bg-white px-4 py-8 text-center text-sm text-[var(--color-muted-foreground)]">
          No suppliers in this tab.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {suppliers.map((s) => {
            const pendingDocs = s.supplier_docs?.filter(
              (d) => d.status === "pending",
            ) ?? [];
            return (
              <li
                key={s.id}
                className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <Link
                      href={`/admin/verifications/${s.id}`}
                      className="text-base font-semibold text-[var(--color-sevent-dark)] hover:text-[var(--color-sevent-green)]"
                    >
                      {s.business_name}
                    </Link>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      {s.base_city} · {legalTypeLabel(s.legal_type)} ·
                      submitted {formatDate(s.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {pendingDocs.length === 0 ? (
                      <span className="text-xs text-[var(--color-muted-foreground)]">
                        {s.supplier_docs?.length
                          ? "All docs reviewed"
                          : "No docs uploaded"}
                      </span>
                    ) : (
                      pendingDocs.map((d) => (
                        <span
                          key={d.id}
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--color-sevent-gold)]/40 bg-[#FFF4DD] px-2 py-0.5 text-[11px] font-medium text-[#7A5A18]"
                        >
                          {docTypeLabel(d.doc_type)}
                          <StatusPill status={d.status} />
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <code className="text-[11px] text-[var(--color-muted-foreground)]">
                    /{s.slug}
                  </code>
                  <Link
                    href={`/admin/verifications/${s.id}`}
                    className="text-sm font-medium text-[var(--color-sevent-green)] hover:underline"
                  >
                    Open review →
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
