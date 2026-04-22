"use server";

/**
 * Organizer-side server actions for the booking detail page.
 *
 * Scope so far: handing an organizer a short-lived signed URL to the
 * supplier's company-profile PDF. Per plan decision 6, this PDF is no longer
 * published on the supplier's public `/s/[slug]` page — it unlocks once the
 * organizer has accepted the supplier's quote, to reduce doc-scraping by
 * anonymous visitors.
 *
 * Security posture:
 *  - Verify the caller is the organizer who owns the booking.
 *  - Verify the booking is in a post-acceptance state (confirmed or later).
 *    We use `confirmation_status === 'confirmed'` for the pilot; payment +
 *    completion states are not yet represented on `bookings` and will be
 *    folded in as that schema grows.
 *  - Read the supplier_docs row via service-role (RLS on the `supplier-docs`
 *    bucket is owner+admin only, so the service-role client is required to
 *    mint a signed URL on the organizer's behalf).
 *  - The returned URL is signed for 1 hour — enough to click through once,
 *    short enough that link leaks don't become long-lived exfiltration.
 */

import { requireRole } from "@/lib/supabase/server";
import type { ConfirmationStatus } from "@/lib/domain/booking";

const ACCEPTED_CONFIRMATION_STATUSES: ConfirmationStatus[] = ["confirmed"];

export async function getCompanyProfileUrlAction(
  bookingId: string,
): Promise<{ url?: string; error?: string }> {
  const gate = await requireRole("organizer");
  if (gate.status === "unauthenticated") return { error: "unauthenticated" };
  if (gate.status === "forbidden") return { error: "forbidden" };
  const { user, admin } = gate;

  // 1. Verify this organizer owns the booking and it's in an accepted state.
  const { data: booking } = await admin
    .from("bookings")
    .select("id, organizer_id, supplier_id, confirmation_status")
    .eq("id", bookingId)
    .eq("organizer_id", user.id)
    .maybeSingle();
  if (!booking) return { error: "not_found" };
  const row = booking as {
    id: string;
    organizer_id: string;
    supplier_id: string;
    confirmation_status: ConfirmationStatus;
  };
  if (!ACCEPTED_CONFIRMATION_STATUSES.includes(row.confirmation_status)) {
    return { error: "not_ready" };
  }

  // 2. Look up the most recent approved company_profile doc for the supplier.
  //    Rows are ordered desc by created_at so re-uploads supersede old ones.
  const { data: doc } = await admin
    .from("supplier_docs")
    .select("file_path")
    .eq("supplier_id", row.supplier_id)
    .eq("doc_type", "company_profile")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const path = (doc as { file_path: string } | null)?.file_path ?? null;
  if (!path) return { error: "missing" };

  // 3. Mint a short-lived signed URL via service-role (bucket is non-public).
  const { data: signed, error } = await admin.storage
    .from("supplier-docs")
    .createSignedUrl(path, 60 * 60);
  if (error || !signed?.signedUrl) {
    return { error: "sign_failed" };
  }
  return { url: signed.signedUrl };
}
