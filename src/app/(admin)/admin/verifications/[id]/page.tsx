import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui-ext/PageHeader";
import { StatusPill } from "@/components/ui-ext/StatusPill";
import { SupplierActions } from "../_components/SupplierActions";
import { SupplierProfileSnapshot } from "@/components/admin/profile/SupplierProfileSnapshot";
import { SupplierDocumentList } from "@/components/admin/profile/SupplierDocumentList";
import {
  SupplierLogo,
  fmtDate,
  verificationStatusPill,
  type SupplierDetail,
  type SupplierDoc,
} from "@/components/admin/profile/shared";

export const dynamic = "force-dynamic";

export default async function AdminVerificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("admin.verifications");
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
        <PageHeader title={t("title")} />
        <p className="text-sm text-semantic-danger-500">
          {t("errorAdminRequired")}
        </p>
      </section>
    );
  }
  const { admin } = gate;

  const { data: supplierRow, error: supplierErr } = await admin
    .from("suppliers")
    .select(
      "id, business_name, slug, legal_type, cr_number, national_id, base_city, service_area_cities, languages, capacity, concurrent_event_limit, bio, is_published, verification_status, verification_notes, verified_at, created_at, profile_id, logo_path, works_with_segments",
    )
    .eq("id", id)
    .maybeSingle();
  if (supplierErr) {
    return (
      <section className="flex flex-col gap-3">
        <PageHeader title={t("title")} />
        <p className="text-sm text-semantic-danger-500">
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

  // Sign-up email — pulled from auth.users via service-role, since profiles
  // doesn't store email. Failing this lookup must not break the page.
  let signupEmail: string | null = null;
  try {
    const { data: authUser } = await admin.auth.admin.getUserById(
      supplier.profile_id,
    );
    signupEmail = authUser?.user?.email ?? null;
  } catch {
    signupEmail = null;
  }

  // Logo + doc previews are served via dedicated route handlers that re-sign
  // on every request (./logo and ./doc/[docId]/preview), so URLs can't go
  // stale between page render and admin click.
  const logoUrl = supplier.logo_path
    ? `/admin/verifications/${supplier.id}/logo`
    : null;
  const previewHrefBase = `/admin/verifications/${supplier.id}/doc`;

  const businessInitial =
    supplier.business_name.trim().charAt(0).toUpperCase() || "?";

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button asChild variant="link" size="sm" className="w-fit px-0">
          <Link href="/admin/verifications">
            <ArrowLeft aria-hidden />
            {t("back")}
          </Link>
        </Button>
        <div className="flex items-start gap-4">
          <SupplierLogo
            logoUrl={logoUrl}
            initial={businessInitial}
            missingLabel={t("logo.missing")}
            headingLabel={t("logo.heading")}
          />
          <div className="flex-1 min-w-0">
            <PageHeader
              title={supplier.business_name}
              description={`${t("submitted")} ${fmtDate(supplier.created_at)} · /${supplier.slug}`}
              actions={
                <StatusPill
                  status={verificationStatusPill(supplier.verification_status)}
                />
              }
            />
          </div>
        </div>
      </div>

      {docsErr ? (
        <div
          role="alert"
          className="rounded-md border border-semantic-danger-500/30 bg-semantic-danger-100 px-3 py-2 text-sm text-semantic-danger-500"
        >
          Failed to load documents: {docsErr.message}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <SupplierProfileSnapshot supplier={supplier} signupEmail={signupEmail} />
          <SupplierDocumentList
            supplierId={supplier.id}
            docs={docs}
            previewHrefBase={previewHrefBase}
          />
        </div>

        <aside className="flex flex-col gap-4">
          <SupplierActions
            supplierId={supplier.id}
            defaultNotes={supplier.verification_notes}
            currentStatus={supplier.verification_status}
          />
          <Card size="sm">
            <CardContent className="text-xs text-muted-foreground">
              <p>{t("approveSummary")}</p>
              <p className="mt-2">{t("rejectSummary")}</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </section>
  );
}
