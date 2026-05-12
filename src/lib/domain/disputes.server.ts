/**
 * Shared server-only dispute context resolvers.
 *
 * Two paths share authorization + state lookup:
 *   - opening a dispute (organizer + supplier action files)
 *   - submitting evidence and reading evidence (organizer + supplier +
 *     admin)
 *
 * Centralising the logic here avoids divergent auth between near-identical
 * action files, per opencode plan review §3 (same rationale as
 * `reviews.server.ts`).
 */

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServiceStatus } from "./booking";
import {
  DISPUTE_FILING_WINDOW_DAYS,
  disputeFilingWindowEndsAt,
  isDisputeFilingWindowOpen,
  type DisputeStatus,
} from "./disputes";

export type DisputeRole = "organizer" | "supplier";

/**
 * Result of `resolveOpenDisputeContext` — used by the open-dispute server
 * action and by the page-level "can open dispute" gate.
 */
export type ResolveOpenDisputeContextOk = {
  ok: true;
  booking: {
    id: string;
    organizer_id: string;
    supplier_id: string;
    supplier_profile_id: string;
    service_status: ServiceStatus;
    completed_at: string | null;
  };
  role: DisputeRole;
  raiser_profile_id: string;
  other_party_profile_id: string;
  window_closes_at: Date;
  existing_open_dispute_by_viewer: { id: string } | null;
};

export type ResolveOpenDisputeContextErr = {
  ok: false;
  reason:
    | "not_found"
    | "not_party"
    | "not_completed"
    | "missing_completed_at"
    | "window_closed"
    | "already_open_by_viewer";
};

export type ResolveOpenDisputeContextResult =
  | ResolveOpenDisputeContextOk
  | ResolveOpenDisputeContextErr;

export type ResolveOpenDisputeContextInput = {
  admin: SupabaseClient;
  bookingId: string;
  viewerProfileId: string;
  now?: Date;
};

/**
 * Loads booking + viewer's role + viewer's existing open/investigating
 * dispute (if any). Returns a discriminated union — `ok: true` carries
 * everything the action needs to INSERT; `ok: false` carries a stable
 * reason code the UI can translate.
 */
export async function resolveOpenDisputeContext(
  input: ResolveOpenDisputeContextInput,
): Promise<ResolveOpenDisputeContextResult> {
  const { admin, bookingId, viewerProfileId, now = new Date() } = input;

  const { data: bookingRow } = await admin
    .from("bookings")
    .select(
      `id, organizer_id, supplier_id, service_status, completed_at,
       suppliers ( id, profile_id )`,
    )
    .eq("id", bookingId)
    .maybeSingle();

  type Row = {
    id: string;
    organizer_id: string;
    supplier_id: string;
    service_status: ServiceStatus;
    completed_at: string | null;
    suppliers: { id: string; profile_id: string } | null;
  };
  const row = bookingRow as unknown as Row | null;
  if (!row || !row.suppliers) return { ok: false, reason: "not_found" };

  const supplierProfileId = row.suppliers.profile_id;

  let role: DisputeRole;
  if (row.organizer_id === viewerProfileId) {
    role = "organizer";
  } else if (supplierProfileId === viewerProfileId) {
    role = "supplier";
  } else {
    return { ok: false, reason: "not_party" };
  }

  if (
    row.service_status !== "completed" &&
    row.service_status !== "disputed"
  ) {
    return { ok: false, reason: "not_completed" };
  }
  if (!row.completed_at) {
    return { ok: false, reason: "missing_completed_at" };
  }
  if (!isDisputeFilingWindowOpen(row.service_status, row.completed_at, now)) {
    return { ok: false, reason: "window_closed" };
  }

  const window_closes_at = disputeFilingWindowEndsAt(row.completed_at);
  if (!window_closes_at) {
    return { ok: false, reason: "missing_completed_at" };
  }

  // One open/investigating dispute per viewer per booking. Multiple
  // disputes on the same booking are allowed in schema (e.g. organizer and
  // supplier both file), but the same viewer can't open two simultaneously.
  const { data: existingRow } = await admin
    .from("disputes")
    .select("id")
    .eq("booking_id", row.id)
    .eq("raised_by", viewerProfileId)
    .in("status", ["open", "investigating"])
    .maybeSingle();
  const existing_open =
    (existingRow as { id: string } | null) ?? null;
  if (existing_open) {
    return { ok: false, reason: "already_open_by_viewer" };
  }

  return {
    ok: true,
    booking: {
      id: row.id,
      organizer_id: row.organizer_id,
      supplier_id: row.supplier_id,
      supplier_profile_id: supplierProfileId,
      service_status: row.service_status,
      completed_at: row.completed_at,
    },
    role,
    raiser_profile_id: viewerProfileId,
    other_party_profile_id:
      role === "organizer" ? supplierProfileId : row.organizer_id,
    window_closes_at,
    existing_open_dispute_by_viewer: null,
  };
}

// ============================================================================
// Dispute-level context (evidence routes)
// ============================================================================

export type ResolveDisputeContextOk = {
  ok: true;
  dispute: {
    id: string;
    booking_id: string;
    raised_by: string;
    reason_code: string;
    description: string;
    status: DisputeStatus;
    opened_at: string;
    resolved_at: string | null;
  };
  booking: {
    id: string;
    organizer_id: string;
    supplier_id: string;
    supplier_profile_id: string;
    service_status: ServiceStatus;
    completed_at: string | null;
  };
  role: DisputeRole | "admin";
  other_party_profile_id: string;
};

export type ResolveDisputeContextErr = {
  ok: false;
  reason: "not_found" | "not_party";
};

export type ResolveDisputeContextResult =
  | ResolveDisputeContextOk
  | ResolveDisputeContextErr;

export type ResolveDisputeContextInput = {
  admin: SupabaseClient;
  disputeId: string;
  viewerProfileId: string;
  isAdmin?: boolean;
};

/**
 * Loads a dispute + parent booking + viewer's role for the dispute detail
 * + evidence flows. Admin viewers are granted access regardless of party
 * membership.
 */
export async function resolveDisputeContext(
  input: ResolveDisputeContextInput,
): Promise<ResolveDisputeContextResult> {
  const { admin, disputeId, viewerProfileId, isAdmin = false } = input;

  const { data: disputeRow } = await admin
    .from("disputes")
    .select(
      `id, booking_id, raised_by, reason_code, description, status,
       opened_at, resolved_at,
       bookings (
         id, organizer_id, supplier_id, service_status, completed_at,
         suppliers ( id, profile_id )
       )`,
    )
    .eq("id", disputeId)
    .maybeSingle();

  type Row = {
    id: string;
    booking_id: string;
    raised_by: string;
    reason_code: string;
    description: string;
    status: DisputeStatus;
    opened_at: string;
    resolved_at: string | null;
    bookings: {
      id: string;
      organizer_id: string;
      supplier_id: string;
      service_status: ServiceStatus;
      completed_at: string | null;
      suppliers: { id: string; profile_id: string } | null;
    } | null;
  };
  const row = disputeRow as unknown as Row | null;
  if (!row || !row.bookings || !row.bookings.suppliers) {
    return { ok: false, reason: "not_found" };
  }

  const supplierProfileId = row.bookings.suppliers.profile_id;

  let role: DisputeRole | "admin";
  if (isAdmin) {
    role = "admin";
  } else if (row.bookings.organizer_id === viewerProfileId) {
    role = "organizer";
  } else if (supplierProfileId === viewerProfileId) {
    role = "supplier";
  } else {
    return { ok: false, reason: "not_party" };
  }

  const other_party_profile_id =
    role === "organizer"
      ? supplierProfileId
      : role === "supplier"
        ? row.bookings.organizer_id
        : // admin viewer — return the organizer as a sensible default
          row.bookings.organizer_id;

  return {
    ok: true,
    dispute: {
      id: row.id,
      booking_id: row.booking_id,
      raised_by: row.raised_by,
      reason_code: row.reason_code,
      description: row.description,
      status: row.status,
      opened_at: row.opened_at,
      resolved_at: row.resolved_at,
    },
    booking: {
      id: row.bookings.id,
      organizer_id: row.bookings.organizer_id,
      supplier_id: row.bookings.supplier_id,
      supplier_profile_id: supplierProfileId,
      service_status: row.bookings.service_status,
      completed_at: row.bookings.completed_at,
    },
    role,
    other_party_profile_id,
  };
}

export { DISPUTE_FILING_WINDOW_DAYS };
