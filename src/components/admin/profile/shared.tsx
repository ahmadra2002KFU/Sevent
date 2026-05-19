import type { ReactNode } from "react";
import {
  Award,
  BadgeCheck,
  FileBadge,
  FileText,
  IdCard,
  Landmark,
  MapPin,
  ReceiptText,
  type LucideIcon,
} from "lucide-react";
import type {
  EventType,
  SupplierDocStatus,
  SupplierDocType,
  SupplierVerificationStatus,
} from "@/lib/supabase/types";
import type { StatusPillStatus } from "@/components/ui-ext/StatusPill";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type SupplierDetail = {
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
  logo_path: string | null;
  works_with_segments: EventType[];
  /** Set by the trigger on `supplier_docs`. Only the Sheet view fetches this;
   * the initial-approval verifications page leaves it undefined because the
   * "papers updated since last review" callout doesn't apply pre-approval. */
  papers_changed_at?: string | null;
};

export type SupplierDoc = {
  id: string;
  doc_type: string;
  file_path: string;
  status: SupplierDocStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
};

export type OrganizerCompany = {
  id: string;
  name: string;
  name_ar: string | null;
  slug: string;
  cr_number: string | null;
  vat_number: string | null;
  billing_email: string | null;
  logo_path: string | null;
  default_language: "en" | "ar";
};

export type BaseProfileSummary = {
  id: string;
  full_name: string | null;
  phone: string | null;
  language: "en" | "ar";
  role: "supplier" | "organizer" | "admin" | "agency";
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function fmtDate(iso: string | null): string {
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

export function docStatusPill(status: SupplierDocStatus): StatusPillStatus {
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  return "pending";
}

export function verificationStatusPill(
  status: SupplierVerificationStatus,
): StatusPillStatus {
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  return "pending";
}

export type Translator = (key: string) => string;

export function legalTypeLabel(raw: string, t: Translator): string {
  if (["company", "freelancer", "foreign"].includes(raw))
    return t(`legalType.${raw}`);
  return raw;
}

export const KNOWN_DOC_TYPES: ReadonlyArray<SupplierDocType> = [
  "cr",
  "vat",
  "id",
  "gea_permit",
  "certification",
  "iban_certificate",
  "company_profile",
  "national_address",
  "other",
];

export function docTypeLabel(raw: string, t: Translator): string {
  if ((KNOWN_DOC_TYPES as ReadonlyArray<string>).includes(raw))
    return t(`docType.${raw}`);
  return raw;
}

export const DOC_TYPE_ICONS: Record<SupplierDocType, LucideIcon> = {
  cr: FileBadge,
  vat: ReceiptText,
  id: IdCard,
  gea_permit: BadgeCheck,
  certification: Award,
  iban_certificate: Landmark,
  company_profile: FileText,
  national_address: MapPin,
  other: FileText,
};

export function docTypeIcon(raw: string): LucideIcon {
  if ((KNOWN_DOC_TYPES as ReadonlyArray<string>).includes(raw)) {
    return DOC_TYPE_ICONS[raw as SupplierDocType];
  }
  return FileText;
}

/** Returns true when the supplier has uploaded papers AFTER the last full
 * verification — drives the "papers updated since last review" callout. */
export function hasStaleApproval(
  papersChangedAt: string | null | undefined,
  verifiedAt: string | null | undefined,
): boolean {
  if (!papersChangedAt || !verifiedAt) return false;
  return new Date(papersChangedAt).getTime() > new Date(verifiedAt).getTime();
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

export function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

/** Square logo tile with dashed-border initial fallback. Same 96px footprint
 * as the original verifications page; the Sheet uses a smaller variant via
 * the `size` prop. */
export function SupplierLogo({
  logoUrl,
  initial,
  missingLabel,
  headingLabel,
  size = "size-24",
}: {
  logoUrl: string | null;
  initial: string;
  missingLabel: string;
  headingLabel: string;
  size?: "size-12" | "size-16" | "size-20" | "size-24";
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={headingLabel}
        width={96}
        height={96}
        className={`${size} rounded-lg border border-border object-cover bg-muted`}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={missingLabel}
      className={`${size} flex items-center justify-center rounded-lg border border-dashed border-border bg-muted text-3xl font-semibold text-muted-foreground`}
    >
      {initial}
    </div>
  );
}
