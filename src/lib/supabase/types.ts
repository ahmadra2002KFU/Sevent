/**
 * Hand-curated DB types for Sprint 2 tables. Generated types (supabase gen types)
 * deferred to Sprint 6 hardening. Keep these narrow to what lanes actually use;
 * full DB types add noise without benefit at this stage.
 */

export type SeventRole = "organizer" | "supplier" | "admin" | "agency";

export type SupplierLegalType = "company" | "freelancer" | "foreign";

export type SupplierVerificationStatus = "pending" | "approved" | "rejected";

export type SupplierDocType =
  | "cr"
  | "vat"
  | "id"
  | "gea_permit"
  | "certification"
  | "other";

export type SupplierDocStatus = "pending" | "approved" | "rejected";

export type SupplierMediaKind = "photo" | "video";

export type PackageUnit = "event" | "hour" | "day" | "person" | "unit";

export type PricingRuleType =
  | "qty_tier_all_units"
  | "qty_tier_incremental"
  | "distance_fee"
  | "date_surcharge"
  | "duration_multiplier";

export type AvailabilityReason = "manual_block" | "soft_hold" | "booked";

export type ProfileRow = {
  id: string;
  role: SeventRole;
  full_name: string | null;
  phone: string | null;
  language: "en" | "ar";
  created_at: string;
  updated_at: string;
};

export type SupplierRow = {
  id: string;
  profile_id: string;
  business_name: string;
  slug: string;
  legal_type: SupplierLegalType;
  cr_number: string | null;
  national_id: string | null;
  verification_status: SupplierVerificationStatus;
  verification_notes: string | null;
  verified_at: string | null;
  verified_by: string | null;
  base_city: string;
  base_location: unknown | null; // PostGIS geography; serialize via PostGIS helpers
  service_area_cities: string[];
  languages: string[];
  capacity: number | null;
  concurrent_event_limit: number;
  bio: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type CategoryRow = {
  id: string;
  parent_id: string | null;
  slug: string;
  name_en: string;
  name_ar: string | null;
  sort_order: number;
};

export type SupplierDocRow = {
  id: string;
  supplier_id: string;
  doc_type: SupplierDocType;
  file_path: string;
  status: SupplierDocStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
};

export type SupplierMediaRow = {
  id: string;
  supplier_id: string;
  kind: SupplierMediaKind;
  file_path: string;
  title: string | null;
  sort_order: number;
  created_at: string;
};

export type PackageRow = {
  id: string;
  supplier_id: string;
  subcategory_id: string;
  name: string;
  description: string | null;
  base_price_halalas: number;
  currency: string;
  unit: PackageUnit;
  min_qty: number;
  max_qty: number | null;
  from_price_visible: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PricingRuleRow = {
  id: string;
  supplier_id: string;
  package_id: string | null;
  rule_type: PricingRuleType;
  config_jsonb: unknown;
  priority: number;
  version: number;
  is_active: boolean;
  valid_from: string | null;
  valid_to: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
};

export type AvailabilityBlockRow = {
  id: string;
  supplier_id: string;
  starts_at: string;
  ends_at: string;
  reason: AvailabilityReason;
  booking_id: string | null;
  quote_revision_id: string | null;
  expires_at: string | null;
  released_at: string | null;
  created_by: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Sprint 3 — events, rfqs, rfq_invites, quotes
// ---------------------------------------------------------------------------

export type EventType =
  | "wedding"
  | "corporate"
  | "government"
  | "exhibition"
  | "birthday"
  | "private"
  | "other";

export type RfqStatus =
  | "draft"
  | "sent"
  | "quoted"
  | "expired"
  | "booked"
  | "cancelled";

export type RfqInviteSource = "auto_match" | "organizer_picked";

export type RfqInviteStatus = "invited" | "declined" | "quoted" | "withdrawn";

export type QuoteStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired"
  | "withdrawn";

export type QuoteSource = "rule_engine" | "free_form" | "mixed";

export type BookingConfirmationStatus =
  | "awaiting_supplier"
  | "confirmed"
  | "cancelled";

export type EventRow = {
  id: string;
  organizer_id: string;
  client_name: string | null;
  event_type: EventType;
  city: string;
  venue_address: string | null;
  venue_location: unknown | null; // PostGIS geography(point, 4326)
  starts_at: string;
  ends_at: string;
  guest_count: number | null;
  budget_range_min_halalas: number | null;
  budget_range_max_halalas: number | null;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RfqRow = {
  id: string;
  event_id: string;
  category_id: string;
  subcategory_id: string;
  status: RfqStatus;
  requirements_jsonb: unknown;
  expires_at: string | null;
  sent_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  created_at: string;
  updated_at: string;
};

export type RfqInviteRow = {
  id: string;
  rfq_id: string;
  supplier_id: string;
  source: RfqInviteSource;
  status: RfqInviteStatus;
  sent_at: string;
  response_due_at: string;
  responded_at: string | null;
  decline_reason_code: string | null;
};

export type QuoteRow = {
  id: string;
  rfq_id: string;
  supplier_id: string;
  quoted_package_id: string | null;
  source: QuoteSource;
  status: QuoteStatus;
  currency: string;
  current_revision_id: string | null;
  supplier_response_deadline: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};
