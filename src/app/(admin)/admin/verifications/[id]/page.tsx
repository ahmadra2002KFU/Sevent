import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/supabase/server";
import {
  STORAGE_BUCKETS,
  createSignedPreviewUrl,
} from "@/lib/supabase/storage";
import type {
  SupplierDocStatus,
  SupplierVerificationStatus,
} from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { DocActions } from "../_components/DocActions";
import { SupplierActions } from "../_components/SupplierActions";

export const dynamic = "force-dynamic";

type SupplierDetail = {
  id: string;
  business_name: string;
  slug: string;
  legal_type: string;
  cr_number: string | null;
  national_id: string | null;
  base_city: string;
  service_area_cities: string[];
  languages: string[];
  capacity: number | null;
  concurrent_event_limit: number;
  bio: string | null;
  is_published: boolean;
  verification_status: SupplierVerificationStatus;
  verification_notes: string | null;
  verified_at: string | null;
  created_at: string;
  profile_id: string;
};

type SupplierDoc = {
  id: string;
  doc_type: string;
  file_path: string;
  status: SupplierDocStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
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

function docTypeLabel(value: string): string {
  switch (value) {
    case "cr":
      return "Commercial Registration (CR)";
    case "vat":
      return "VAT certificate";
    case "id":
      return "National ID";
    case "gea_permit":
      return "GEA permit";
    case "certification":
      return "Certification";
    default:
      return value;
  }
}

function statusBadge(status: SupplierDocStatus | SupplierVerificationStatus) {
  const s = status.toString();
  const styles: Record<string, string> = {
    pending:
      "bg-[var(--color-muted)] text-[var(--color-muted-foreground)] border-[var(--color-border)]",
    approved: "bg-[#E2F4EA] text-[var(--color-sevent-green)] border-[#BDE3CB]",
    rejected: "bg-[#FCE9E9] text-[#9F1A1A] border-[#F2C2C2]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        styles[s] ?? styles.pending,
      )}
    >
      {s}
    </span>
  );
}

export default async function AdminVerificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const gate = await requireRole("admin");
  if (gate.status === "unauthenticated") {
    redirect(
      `/sign-in?next=${encodeURIComponent(`/admin/verifications/${id}`)}`,
    );
  }
  if (gate.status === "forbidden") {
    return (
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">Verification</h1>
        <p className="text-sm text-[#9F1A1A]">
          Admin role required to view this page.
        </p>
      </section>
    );
  }
  const { admin } = gate;

  const { data: supplierRow, error: supplierErr } = await admin
    .from("suppliers")
    .select(
      "id, business_name, slug, legal_type, cr_number, national_id, base_city, service_area_cities, languages, capacity, concurrent_event_limit, bio, is_published, verification_status, verification_notes, verified_at, created_at, profile_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (supplierErr) {
    return (
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">Verification</h1>
        <p className="text-sm text-[#9F1A1A]">
          Failed to load supplier: {supplierErr.message}
        </p>
      </section>
    );
  }
  if (!supplierRow) notFound();
  const supplier = supplierRow as SupplierDetail;

  const { data: docRows, error: docsErr } = await admin
    .from("supplier_docs")
    .select(
      "id, doc_type, file_path, status, reviewed_by, reviewed_at, notes, created_at",
    )
    .eq("supplier_id", id)
    .order("created_at", { ascending: true });
  const docs: SupplierDoc[] = (docRows as SupplierDoc[] | null) ?? [];

  // Mint signed preview URLs server-side. Use service-role here so the admin
  // never has to depend on a per-object storage policy lookup beyond the
  // `is_admin()` SELECT policy on `supplier-docs` (we already verified role
  // above). Failing to sign one URL must not break the page.
  let signedDocs: Array<SupplierDoc & { signedUrl: string | null; signError: string | null }> = docs.map((d) => ({
    ...d,
    signedUrl: null,
    signError: null,
  }));
  signedDocs = await Promise.all(
    docs.map(async (d) => {
      try {
        const url = await createSignedPreviewUrl(
          admin,
          STORAGE_BUCKETS.docs,
          d.file_path,
        );
        return { ...d, signedUrl: url, signError: null };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ...d, signedUrl: null, signError: message };
      }
    }),
  );

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/admin/verifications"
          className="text-sm text-[var(--color-sevent-green)] hover:underline"
        >
          ← Back to queue
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{supplier.business_name}</h1>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Submitted {fmtDate(supplier.created_at)} · /{supplier.slug}
            </p>
          </div>
          {statusBadge(supplier.verification_status)}
        </div>
      </div>

      {docsErr ? (
        <p className="rounded-md border border-[#F2C2C2] bg-[#FCE9E9] px-3 py-2 text-sm text-[#9F1A1A]">
          Failed to load documents: {docsErr.message}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <article className="rounded-lg border border-[var(--color-border)] bg-white p-5">
            <h2 className="text-base font-semibold">Profile snapshot</h2>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[11px] uppercase text-[var(--color-muted-foreground)]">
                  Legal type
                </dt>
                <dd>{supplier.legal_type}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-[var(--color-muted-foreground)]">
                  Base city
                </dt>
                <dd>{supplier.base_city}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-[var(--color-muted-foreground)]">
                  CR number
                </dt>
                <dd>{supplier.cr_number ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-[var(--color-muted-foreground)]">
                  National ID
                </dt>
                <dd>{supplier.national_id ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-[var(--color-muted-foreground)]">
                  Service area
                </dt>
                <dd>
                  {supplier.service_area_cities?.length
                    ? supplier.service_area_cities.join(", ")
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-[var(--color-muted-foreground)]">
                  Languages
                </dt>
                <dd>
                  {supplier.languages?.length
                    ? supplier.languages.join(", ")
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-[var(--color-muted-foreground)]">
                  Capacity
                </dt>
                <dd>{supplier.capacity ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-[var(--color-muted-foreground)]">
                  Concurrent events
                </dt>
                <dd>{supplier.concurrent_event_limit}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-[var(--color-muted-foreground)]">
                  Published
                </dt>
                <dd>{supplier.is_published ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-[var(--color-muted-foreground)]">
                  Verified at
                </dt>
                <dd>{fmtDate(supplier.verified_at)}</dd>
              </div>
            </dl>
            {supplier.bio ? (
              <div className="mt-4">
                <h3 className="text-[11px] uppercase text-[var(--color-muted-foreground)]">
                  Bio
                </h3>
                <p className="mt-1 whitespace-pre-wrap text-sm">{supplier.bio}</p>
              </div>
            ) : null}
            {supplier.verification_notes ? (
              <div className="mt-4 rounded-md border border-[#F2C2C2] bg-[#FCE9E9] p-3">
                <h3 className="text-[11px] uppercase text-[#9F1A1A]">
                  Last reviewer notes
                </h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-[#9F1A1A]">
                  {supplier.verification_notes}
                </p>
              </div>
            ) : null}
          </article>

          <article className="rounded-lg border border-[var(--color-border)] bg-white p-5">
            <h2 className="text-base font-semibold">Documents ({docs.length})</h2>
            {docs.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
                No documents uploaded yet.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col divide-y divide-[var(--color-border)]">
                {signedDocs.map((d) => (
                  <li key={d.id} className="flex flex-col gap-2 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {docTypeLabel(d.doc_type)}
                        </span>
                        {statusBadge(d.status)}
                      </div>
                      <span className="text-[11px] text-[var(--color-muted-foreground)]">
                        Uploaded {fmtDate(d.created_at)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
                      {d.signedUrl ? (
                        <a
                          href={d.signedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--color-sevent-green)] hover:underline"
                        >
                          Open preview
                        </a>
                      ) : d.signError ? (
                        <span className="text-[#9F1A1A]">
                          Preview unavailable: {d.signError}
                        </span>
                      ) : (
                        <span>Preview unavailable</span>
                      )}
                      {d.reviewed_at ? (
                        <span>· Reviewed {fmtDate(d.reviewed_at)}</span>
                      ) : null}
                    </div>
                    {d.notes ? (
                      <p className="rounded-md bg-[var(--color-muted)] p-2 text-xs text-[var(--color-muted-foreground)]">
                        Notes: {d.notes}
                      </p>
                    ) : null}
                    <DocActions
                      docId={d.id}
                      supplierId={supplier.id}
                      currentStatus={d.status}
                      currentNotes={d.notes}
                    />
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>

        <aside className="flex flex-col gap-4">
          <SupplierActions
            supplierId={supplier.id}
            defaultNotes={supplier.verification_notes}
          />
          <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-muted)] p-4 text-xs text-[var(--color-muted-foreground)]">
            <p>
              Approving sets <code>verification_status=approved</code>,{" "}
              <code>is_published=true</code>, marks all non-rejected documents
              as approved, sends the welcome email and writes a{" "}
              <code>supplier.approved</code> notification.
            </p>
            <p className="mt-2">
              Rejecting sets <code>verification_status=rejected</code>, hides
              the listing, marks every non-approved document as rejected with
              the notes you provide, and emails the supplier the next steps.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
