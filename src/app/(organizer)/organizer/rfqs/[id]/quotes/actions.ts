"use server";

/**
 * Sprint 4 Lane 3 — organizer quote acceptance server action.
 *
 * The RPC `public.accept_quote_tx` is the atomic unit: it locks events → rfqs
 * → quotes → suppliers in that order, creates the booking + soft-hold, flips
 * sibling quotes to rejected, and raises structured P000x codes on failure.
 * This action is the thin wrapper: it (1) authenticates the organizer via
 * `requireRole`, (2) parses + invokes the RPC through the service-role client,
 * (3) maps raised Postgres codes to user-visible messages, (4) writes in-app
 * notifications best-effort (never rolling back the RPC), and (5) revalidates
 * the affected paths BEFORE redirecting to the new booking.
 *
 * Ordering note: `revalidatePath` must run before `redirect`. `redirect`
 * throws NEXT_REDIRECT which aborts the remaining action body, so any
 * cache-invalidation work queued after it would silently drop.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccess } from "@/lib/auth/access";
import { createNotification } from "@/lib/notifications/inApp";
import type { ActionState, RfpRequestActionState } from "./action-state";

const acceptSchema = z.object({
  quote_id: z.string().uuid(),
  rfq_id: z.string().uuid(),
});

// 48h soft-hold matches the state-machines.md constant referenced by the RPC.
const SOFT_HOLD_MINUTES = 2880;

type PgError = { code?: string; message?: string } | null | undefined;

/**
 * Map the raise-code prefix carried in `message` (shape: "code:detail") back
 * to a user-facing string. The RPC always uses the `P000x` code slot for the
 * taxonomy, but some codes carry structured detail after the colon — we
 * extract and interpolate that detail (e.g. rfq_not_bookable:<status>) where
 * it's useful, and discard it otherwise.
 */
function messageForError(err: PgError): string {
  if (!err) return "We couldn't accept this quote. Please try again.";
  const code = err.code ?? "";
  const raw = err.message ?? "";

  switch (code) {
    case "P0002":
      return "Quote not found.";
    case "P0003":
      return "This quote has already been accepted.";
    case "P0004":
      return "Quote is no longer in sendable state.";
    case "P0005":
      return "Quote is missing a revision — ask the supplier to re-send.";
    case "P0006":
      return "You are not the organizer of this RFQ.";
    case "P0007":
      return "Supplier no longer available — date conflict.";
    case "P0010": {
      // Message shape: "rfq_not_bookable:<status>"
      const idx = raw.lastIndexOf(":");
      const status = idx >= 0 ? raw.slice(idx + 1).trim() : "";
      return status
        ? `This RFQ is no longer bookable (${status}).`
        : "This RFQ is no longer bookable.";
    }
    case "P0012":
      return "Internal error — invalid soft-hold duration. Contact support.";
    default:
      return "We couldn't accept this quote. Please try again.";
  }
}

export async function acceptQuoteAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  // 1. Gate.
  const gate = await requireAccess("organizer.rfqs");

  // 2. Parse inputs.
  const parse = acceptSchema.safeParse({
    quote_id: formData.get("quote_id"),
    rfq_id: formData.get("rfq_id"),
  });
  if (!parse.success) {
    return { status: "error", message: "Invalid quote id." };
  }
  const { quote_id, rfq_id } = parse.data;

  // 3. Invoke the atomic RPC. Passes `p_organizer_id = gate.user.id` — the RPC
  //    re-checks this against events.organizer_id so a spoofed claim would be
  //    caught as P0006 rather than silently creating a booking for someone else.
  const { data: rpcData, error: rpcError } = await gate.admin.rpc(
    "accept_quote_tx",
    {
      p_quote_id: quote_id,
      p_organizer_id: gate.user.id,
      p_soft_hold_minutes: SOFT_HOLD_MINUTES,
    },
  );

  if (rpcError) {
    return { status: "error", message: messageForError(rpcError) };
  }

  // The RPC returns `table(booking_id uuid, block_id uuid)` — supabase-js
  // surfaces this as an array of rows. Defensive shape check: if the RPC ever
  // returns empty (shouldn't, but mistakes happen), refuse to redirect.
  const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  const booking_id: string | undefined = row?.booking_id;
  if (!booking_id) {
    return {
      status: "error",
      message: "Booking created but no id returned — contact support.",
    };
  }

  // 4. Resolve notification context. Service-role read; ownership was enforced
  //    by the RPC already, so this is just pulling supplier + sibling rows.
  const { data: acceptedQuote } = await gate.admin
    .from("quotes")
    .select("id, supplier_id, rfq_id, accepted_at")
    .eq("id", quote_id)
    .maybeSingle();

  const supplierId = (acceptedQuote as { supplier_id?: string } | null)?.supplier_id;

  // Supplier profile_id (suppliers.profile_id → profiles.id). We need the
  // notification to land on the supplier user's profile row, not the supplier
  // entity id.
  let supplierProfileId: string | null = null;
  if (supplierId) {
    const { data: s } = await gate.admin
      .from("suppliers")
      .select("profile_id")
      .eq("id", supplierId)
      .maybeSingle();
    supplierProfileId = (s as { profile_id?: string } | null)?.profile_id ?? null;
  }

  // Siblings: quotes the RPC auto-rejected in the same transaction.
  const { data: rejectedSiblingsRaw } = await gate.admin
    .from("quotes")
    .select("id, supplier_id, suppliers:suppliers!quotes_supplier_id_fkey ( profile_id )")
    .eq("rfq_id", rfq_id)
    .eq("status", "rejected")
    .neq("id", quote_id);

  type SiblingRow = {
    id: string;
    supplier_id: string;
    suppliers: { profile_id: string | null } | { profile_id: string | null }[] | null;
  };
  const rejectedSiblings = (rejectedSiblingsRaw ?? []) as unknown as SiblingRow[];

  // Look up confirm_deadline from the new booking so the supplier sees the
  // same countdown in the notification payload as they will on the dashboard.
  const { data: bookingRow } = await gate.admin
    .from("bookings")
    .select("confirm_deadline")
    .eq("id", booking_id)
    .maybeSingle();
  const confirmDeadline =
    (bookingRow as { confirm_deadline?: string | null } | null)?.confirm_deadline ?? null;

  // 5. Write notifications in parallel. Each one is wrapped in its own
  //    try/catch so a flaky insert cannot cascade — the DB transaction is
  //    already committed at this point; we just want best-effort delivery.
  const notifyTasks: Promise<unknown>[] = [];

  if (supplierProfileId) {
    notifyTasks.push(
      (async () => {
        try {
          await createNotification({
            supabase: gate.admin,
            user_id: supplierProfileId,
            kind: "quote.accepted",
            payload: {
              quote_id,
              rfq_id,
              booking_id,
            },
          });
        } catch (e) {
          console.error("[acceptQuoteAction] notify quote.accepted failed", e);
        }
      })(),
      (async () => {
        try {
          await createNotification({
            supabase: gate.admin,
            user_id: supplierProfileId,
            kind: "booking.awaiting_supplier",
            payload: {
              booking_id,
              rfq_id,
              confirm_deadline: confirmDeadline,
            },
          });
        } catch (e) {
          console.error(
            "[acceptQuoteAction] notify booking.awaiting_supplier failed",
            e,
          );
        }
      })(),
    );
  }

  // Self-notify the organizer.
  notifyTasks.push(
    (async () => {
      try {
        await createNotification({
          supabase: gate.admin,
          user_id: gate.user.id,
          kind: "booking.created",
          payload: {
            booking_id,
            rfq_id,
            quote_id,
          },
        });
      } catch (e) {
        console.error("[acceptQuoteAction] notify booking.created failed", e);
      }
    })(),
  );

  // Notify each auto-rejected sibling supplier. Supabase surfaces the
  // one-to-one join as either an object or a single-element array depending on
  // the version; handle both.
  for (const sib of rejectedSiblings) {
    const sibProfileId = Array.isArray(sib.suppliers)
      ? sib.suppliers[0]?.profile_id ?? null
      : sib.suppliers?.profile_id ?? null;
    if (!sibProfileId) continue;
    notifyTasks.push(
      (async () => {
        try {
          await createNotification({
            supabase: gate.admin,
            user_id: sibProfileId,
            kind: "quote.rejected",
            payload: {
              quote_id: sib.id,
              rfq_id,
              reason: "another_quote_accepted",
            },
          });
        } catch (e) {
          console.error(
            "[acceptQuoteAction] notify quote.rejected failed",
            { sibling_id: sib.id, error: e },
          );
        }
      })(),
    );
  }

  await Promise.all(notifyTasks);

  // 6. Revalidate BEFORE redirect. `redirect()` throws NEXT_REDIRECT which
  //    aborts everything after it, so if we reversed this order the cache
  //    would stay stale and the organizer would see the un-rejected siblings.
  revalidatePath(`/organizer/rfqs/${rfq_id}/quotes`);
  revalidatePath("/organizer/bookings");
  revalidatePath("/supplier/bookings");

  redirect(`/organizer/bookings/${booking_id}`);
}

// ===========================================================================
// Proposal-request flow (organizer-initiated RFP).
// See migration 20260504080000_quote_proposal_requests.sql.
// ===========================================================================

const requestProposalSchema = z.object({
  quote_id: z.string().uuid(),
  rfq_id: z.string().uuid(),
  message: z
    .string()
    .max(1024, "Message must be 1024 characters or fewer.")
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
});

const cancelProposalSchema = z.object({
  request_id: z.string().uuid(),
  rfq_id: z.string().uuid(),
});

/**
 * Server action — organizer asks a supplier for a technical proposal.
 *
 * Idempotent under the unique partial index on (quote_id) where status =
 * 'pending'. Re-clicking the button while a request is open returns a
 * descriptive error instead of duplicating the row.
 */
export async function requestProposalAction(
  _prev: RfpRequestActionState | undefined,
  formData: FormData,
): Promise<RfpRequestActionState> {
  const gate = await requireAccess("organizer.rfqs");

  const parse = requestProposalSchema.safeParse({
    quote_id: formData.get("quote_id"),
    rfq_id: formData.get("rfq_id"),
    message: formData.get("message") ?? undefined,
  });
  if (!parse.success) {
    return { status: "error", message: "Invalid request." };
  }
  const { quote_id, rfq_id, message } = parse.data;

  // Defense-in-depth ownership check. RLS would also gate this, but the
  // service-role client bypasses RLS — so we re-prove the caller owns the
  // RFQ before mutating.
  const { data: ownership } = await gate.admin
    .from("quotes")
    .select(
      `id, supplier_id, rfq_id,
       suppliers ( profile_id ),
       rfqs ( id, events ( organizer_id ) )`,
    )
    .eq("id", quote_id)
    .eq("rfq_id", rfq_id)
    .maybeSingle();

  type OwnershipRow = {
    id: string;
    supplier_id: string;
    suppliers:
      | { profile_id: string | null }
      | { profile_id: string | null }[]
      | null;
    rfqs:
      | {
          events:
            | { organizer_id: string | null }
            | { organizer_id: string | null }[]
            | null;
        }
      | {
          events:
            | { organizer_id: string | null }
            | { organizer_id: string | null }[]
            | null;
        }[]
      | null;
  };
  const row = ownership as unknown as OwnershipRow | null;
  if (!row) {
    return { status: "error", message: "Quote not found." };
  }
  const rfqsJoin = Array.isArray(row.rfqs) ? row.rfqs[0] ?? null : row.rfqs;
  const eventsJoin = Array.isArray(rfqsJoin?.events)
    ? rfqsJoin?.events[0] ?? null
    : rfqsJoin?.events ?? null;
  const organizerId = eventsJoin?.organizer_id ?? null;
  if (organizerId !== gate.user.id) {
    return {
      status: "error",
      message: "You are not the organizer of this RFQ.",
    };
  }

  // Insert the row. If a pending request already exists, the unique partial
  // index trips with code 23505.
  const { error: insertErr } = await gate.admin
    .from("quote_proposal_requests")
    .insert({
      quote_id,
      requested_by: gate.user.id,
      message,
      status: "pending",
    });

  if (insertErr) {
    if ((insertErr as { code?: string }).code === "23505") {
      return {
        status: "error",
        message: "A proposal request is already pending for this supplier.",
      };
    }
    console.error("[requestProposalAction] insert failed", insertErr);
    return {
      status: "error",
      message: "We couldn't send the request. Please try again.",
    };
  }

  // Best-effort notification to supplier. Find profile id off the join.
  const supplierProfileId = Array.isArray(row.suppliers)
    ? row.suppliers[0]?.profile_id ?? null
    : row.suppliers?.profile_id ?? null;
  if (supplierProfileId) {
    // Look up the supplier's invite id so the inbox can deep-link directly
    // to /supplier/rfqs/{invite_id} (the supplier-side route is keyed by
    // invite, not rfq). If the lookup fails or returns nothing the inbox
    // gracefully falls back to /supplier/rfqs.
    let inviteId: string | null = null;
    try {
      const { data: invite } = await gate.admin
        .from("rfq_invites")
        .select("id")
        .eq("rfq_id", rfq_id)
        .eq("supplier_id", row.supplier_id)
        .limit(1)
        .maybeSingle();
      inviteId = (invite as { id?: string } | null)?.id ?? null;
    } catch (e) {
      console.error("[requestProposalAction] invite lookup failed", e);
    }

    try {
      await createNotification({
        supabase: gate.admin,
        user_id: supplierProfileId,
        kind: "quote.proposal_requested",
        payload: {
          quote_id,
          rfq_id,
          message,
          ...(inviteId ? { invite_id: inviteId } : {}),
        },
      });
    } catch (e) {
      console.error("[requestProposalAction] notify failed", e);
    }
  }

  revalidatePath(`/organizer/rfqs/${rfq_id}/quotes`);
  revalidatePath(`/organizer/rfqs/${rfq_id}/quotes/${quote_id}`);
  // Supplier-side path is keyed by invite id, not quote id — revalidate the
  // tag-like prefix so the supplier inbox refresh on next visit picks up the
  // new request even though we don't know their invite id here.
  revalidatePath("/supplier/rfqs", "layout");

  return {
    status: "success",
    message: "Proposal request sent to the supplier.",
  };
}

/**
 * Server action — organizer cancels their own pending proposal request.
 * Only flips status pending → cancelled. RLS + the with-check policy keep us
 * honest if the service-role check ever drifts.
 */
export async function cancelProposalRequestAction(
  _prev: RfpRequestActionState | undefined,
  formData: FormData,
): Promise<RfpRequestActionState> {
  const gate = await requireAccess("organizer.rfqs");

  const parse = cancelProposalSchema.safeParse({
    request_id: formData.get("request_id"),
    rfq_id: formData.get("rfq_id"),
  });
  if (!parse.success) {
    return { status: "error", message: "Invalid request." };
  }
  const { request_id, rfq_id } = parse.data;

  // Verify the request belongs to a quote on an RFQ this organizer owns.
  const { data: reqRow } = await gate.admin
    .from("quote_proposal_requests")
    .select(
      `id, quote_id, status,
       quotes!inner ( id, rfqs!inner ( id, events!inner ( organizer_id ) ) )`,
    )
    .eq("id", request_id)
    .maybeSingle();

  type ReqOwnership = {
    id: string;
    quote_id: string;
    status: "pending" | "fulfilled" | "cancelled";
    quotes:
      | {
          rfqs:
            | { events: { organizer_id: string } | { organizer_id: string }[] }
            | { events: { organizer_id: string } | { organizer_id: string }[] }[];
        }
      | {
          rfqs:
            | { events: { organizer_id: string } | { organizer_id: string }[] }
            | { events: { organizer_id: string } | { organizer_id: string }[] }[];
        }[];
  };
  const r = reqRow as unknown as ReqOwnership | null;
  if (!r) {
    return { status: "error", message: "Request not found." };
  }
  if (r.status !== "pending") {
    return {
      status: "error",
      message: "This request is no longer pending.",
    };
  }
  const quotesNode = Array.isArray(r.quotes) ? r.quotes[0] : r.quotes;
  const rfqsNode = Array.isArray(quotesNode?.rfqs)
    ? quotesNode?.rfqs[0]
    : quotesNode?.rfqs;
  const eventsNode = Array.isArray(rfqsNode?.events)
    ? rfqsNode?.events[0]
    : rfqsNode?.events;
  const organizerId = eventsNode?.organizer_id ?? null;
  if (organizerId !== gate.user.id) {
    return {
      status: "error",
      message: "You are not the organizer of this RFQ.",
    };
  }

  // `.select("id")` so a 0-row UPDATE (e.g. another organizer tab cancelled or
  // the supplier fulfilled it between our read and write) doesn't read as
  // success and emit a misleading toast.
  const { data: updRows, error: updErr } = await gate.admin
    .from("quote_proposal_requests")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", request_id)
    .eq("status", "pending")
    .select("id");

  if (updErr) {
    console.error("[cancelProposalRequestAction] update failed", updErr);
    return {
      status: "error",
      message: "We couldn't cancel the request. Please try again.",
    };
  }
  if (!updRows || updRows.length !== 1) {
    return {
      status: "error",
      message: "This request is no longer pending. Please refresh.",
    };
  }

  revalidatePath(`/organizer/rfqs/${rfq_id}/quotes`);
  revalidatePath(`/organizer/rfqs/${rfq_id}/quotes/${r.quote_id}`);
  revalidatePath("/supplier/rfqs", "layout");

  return { status: "success", message: "Proposal request cancelled." };
}
