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
import { getSegmentBySlug } from "@/lib/domain/segments";
import { createNotification } from "@/lib/notifications/inApp";
import { sendEmail } from "@/lib/notifications/email";
import { resolveRecipientEmailAndLocale } from "@/lib/notifications/recipients";
import QuoteAccepted from "@/lib/notifications/templates/supplier/QuoteAccepted";
import { strings as quoteAcceptedStrings } from "@/lib/notifications/templates/supplier/QuoteAccepted.strings";
import BookingCreated from "@/lib/notifications/templates/organizer/BookingCreated";
import { strings as bookingCreatedStrings } from "@/lib/notifications/templates/organizer/BookingCreated.strings";
import { env } from "@/lib/env";
import type { ActionState, RfpRequestActionState } from "./action-state";

type EmailDelivery = "sent" | "console" | "failed" | "skipped";

function appUrl(): string {
  return env?.APP_URL ?? process.env.APP_URL ?? "http://localhost:3000";
}

async function sendLifecycleEmail(args: {
  to: string;
  subject: string;
  react: Parameters<typeof sendEmail>[0]["react"];
  context: { stage: string; id: string };
}): Promise<EmailDelivery> {
  try {
    const result = await sendEmail({
      to: args.to,
      subject: args.subject,
      react: args.react,
    });
    if (!result.ok) {
      console.warn("[" + args.context.stage + "] email send failed", {
        id: args.context.id,
        error: result.error,
      });
      return "failed";
    }
    return result.mode === "resend" ? "sent" : "console";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[" + args.context.stage + "] email send threw", {
      id: args.context.id,
      message,
    });
    return "failed";
  }
}

const acceptSchema = z.object({
  quote_id: z.string().uuid(),
  rfq_id: z.string().uuid(),
});

// 48h soft-hold matches the state-machines.md constant referenced by the RPC.
const SOFT_HOLD_MINUTES = 2880;

type PgError = { code?: string; message?: string } | null | undefined;

/**
 * Map the structured `P000x` raise code (and the detail carried after the
 * colon in `message`, shape "code:detail") to a stable error-code key under
 * `organizer.quote.*` plus any interpolation params. The render boundary
 * (QuoteComparisonGrid) turns this into localized copy — server actions never
 * return user-facing prose or leak raw `error.message`.
 */
function errorForRpc(err: PgError): {
  code: string;
  params?: Record<string, string | number>;
} {
  if (!err) return { code: "acceptErrorUnknown" };
  const code = err.code ?? "";
  const raw = err.message ?? "";

  switch (code) {
    case "P0002":
      return { code: "acceptErrorNotFound" };
    case "P0003":
      return { code: "acceptErrorAlreadyAccepted" };
    case "P0004":
      return { code: "acceptErrorNotSendable" };
    case "P0005":
      return { code: "acceptErrorMissingRevision" };
    case "P0006":
      return { code: "acceptErrorOrganizerMismatch" };
    case "P0007":
      return { code: "acceptErrorSupplierUnavailable" };
    case "P0010": {
      // Message shape: "rfq_not_bookable:<status>"
      const idx = raw.lastIndexOf(":");
      const status = idx >= 0 ? raw.slice(idx + 1).trim() : "";
      return {
        code: "acceptErrorRfqTerminal",
        params: { status: status || "—" },
      };
    }
    default:
      return { code: "acceptErrorUnknown" };
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
    return { status: "error", code: "acceptErrorUnknown" };
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
    return { status: "error", ...errorForRpc(rpcError) };
  }

  // The RPC returns `table(booking_id uuid, block_id uuid)` — supabase-js
  // surfaces this as an array of rows. Defensive shape check: if the RPC ever
  // returns empty (shouldn't, but mistakes happen), refuse to redirect.
  const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  const booking_id: string | undefined = row?.booking_id;
  if (!booking_id) {
    return { status: "error", code: "acceptErrorUnknown" };
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
  // entity id. Also pull business_name so the email templates can address the
  // supplier by their business name.
  let supplierProfileId: string | null = null;
  let supplierBusinessName: string | null = null;
  if (supplierId) {
    const { data: s } = await gate.admin
      .from("suppliers")
      .select("profile_id, business_name")
      .eq("id", supplierId)
      .maybeSingle();
    supplierProfileId =
      (s as { profile_id?: string } | null)?.profile_id ?? null;
    supplierBusinessName =
      (s as { business_name?: string } | null)?.business_name ?? null;
  }

  // Event type — fallback for the event "name" referenced in email templates,
  // since rfqs has no title column and events.name is not always populated.
  // Also pull the organizer's full_name for greeting copy in the BookingCreated
  // email and the supplier's profile row for the QuoteAccepted greeting.
  const { data: rfqEventRow } = await gate.admin
    .from("rfqs")
    .select("id, events ( event_type )")
    .eq("id", rfq_id)
    .maybeSingle();
  type RfqEventShape = {
    id: string;
    events:
      | { event_type: string | null }
      | { event_type: string | null }[]
      | null;
  };
  const rfqEvent = rfqEventRow as unknown as RfqEventShape | null;
  const eventsNode = Array.isArray(rfqEvent?.events)
    ? rfqEvent?.events[0] ?? null
    : rfqEvent?.events ?? null;
  // Resolve the event_type SLUG (e.g. `private_occasions`) to a localized
  // display name per recipient locale below. Passing the raw slug to the
  // notification template would surface text like "private_occasions" in the
  // email body. Falls back to a localized "your event" / "فعاليتك" when no
  // segment matches.
  const eventTypeSlug = eventsNode?.event_type ?? null;
  const eventSegment = eventTypeSlug ? getSegmentBySlug(eventTypeSlug) : null;
  const localizedEventName = (locale: "en" | "ar"): string => {
    if (eventSegment) {
      return locale === "ar" ? eventSegment.name_ar : eventSegment.name_en;
    }
    return locale === "ar" ? "فعاليتك" : "your event";
  };

  const { data: organizerProfileRow } = await gate.admin
    .from("profiles")
    .select("full_name")
    .eq("id", gate.user.id)
    .maybeSingle();
  const organizerName =
    (organizerProfileRow as { full_name?: string | null } | null)?.full_name ??
    null;

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

  // Capture the local copy so the closures below can keep narrowing without
  // re-checking on each access.
  const supplierProfileIdLocal = supplierProfileId;
  if (supplierProfileIdLocal) {
    notifyTasks.push(
      (async () => {
        try {
          // 1) Resolve recipient (email + locale). This is the sanctioned path
          //    even when the in-app row is the source of truth; it sidesteps
          //    the auth.users vs profiles.language gotcha documented in
          //    recipients.ts.
          const recipient = await resolveRecipientEmailAndLocale(
            gate.admin,
            supplierProfileIdLocal,
          );

          // 2) Write the in-app notification FIRST (source of truth) with the
          //    delivery state as `pending`. We update it after the send.
          const basePayload = {
            quote_id,
            rfq_id,
            booking_id,
          };
          const inApp = await createNotification({
            supabase: gate.admin,
            user_id: supplierProfileIdLocal,
            kind: "quote.accepted",
            payload: { ...basePayload, email_delivery: "pending" },
          });

          // 3) Best-effort email send. The DB writes are committed; on failure
          //    we just record the outcome on the notification payload.
          let emailDelivery: EmailDelivery = "skipped";
          if (recipient.email && confirmDeadline) {
            const localEventName = localizedEventName(recipient.locale);
            emailDelivery = await sendLifecycleEmail({
              to: recipient.email,
              subject: quoteAcceptedStrings[recipient.locale].preview(localEventName),
              react: QuoteAccepted({
                locale: recipient.locale,
                supplierBusinessName: supplierBusinessName ?? "your business",
                eventName: localEventName,
                organizerName: organizerName ?? "the organizer",
                bookingUrl: `${appUrl()}/supplier/bookings/${booking_id}`,
                expiresAtIso: confirmDeadline,
              }),
              context: { stage: "acceptQuote/quote.accepted", id: quote_id },
            });
          } else if (!recipient.email) {
            console.warn(
              "[acceptQuoteAction] supplier has no email; skipping QuoteAccepted send",
              { supplierProfileId: supplierProfileIdLocal },
            );
            emailDelivery = "skipped";
          } else {
            // Missing confirm_deadline — the email template requires an ISO
            // string for the deadline section. Record as skipped so we can
            // alert on this in observability if it ever happens.
            console.warn(
              "[acceptQuoteAction] confirm_deadline missing; skipping QuoteAccepted send",
              { booking_id },
            );
            emailDelivery = "skipped";
          }

          // 4) Persist the final email_delivery state on the notification row.
          if (inApp.ok) {
            await gate.admin
              .from("notifications")
              .update({
                payload_jsonb: { ...basePayload, email_delivery: emailDelivery },
              })
              .eq("id", inApp.id);
          }
        } catch (e) {
          console.error("[acceptQuoteAction] notify quote.accepted failed", e);
        }
      })(),
      (async () => {
        try {
          await createNotification({
            supabase: gate.admin,
            user_id: supplierProfileIdLocal,
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

  // Self-notify the organizer (in-app + email).
  notifyTasks.push(
    (async () => {
      try {
        const recipient = await resolveRecipientEmailAndLocale(
          gate.admin,
          gate.user.id,
        );
        const basePayload = {
          booking_id,
          rfq_id,
          quote_id,
        };
        const inApp = await createNotification({
          supabase: gate.admin,
          user_id: gate.user.id,
          kind: "booking.created",
          payload: { ...basePayload, email_delivery: "pending" },
        });

        let emailDelivery: EmailDelivery = "skipped";
        if (recipient.email && confirmDeadline) {
          const localEventName = localizedEventName(recipient.locale);
          emailDelivery = await sendLifecycleEmail({
            to: recipient.email,
            subject: bookingCreatedStrings[recipient.locale].preview(
              supplierBusinessName ?? "the supplier",
              localEventName,
            ),
            react: BookingCreated({
              locale: recipient.locale,
              organizerName,
              supplierBusinessName: supplierBusinessName ?? "the supplier",
              eventName: localEventName,
              supplierConfirmDeadlineIso: confirmDeadline,
              bookingUrl: `${appUrl()}/organizer/bookings/${booking_id}`,
            }),
            context: { stage: "acceptQuote/booking.created", id: booking_id },
          });
        } else if (!recipient.email) {
          console.warn(
            "[acceptQuoteAction] organizer has no email; skipping BookingCreated send",
            { organizerId: gate.user.id },
          );
        } else {
          console.warn(
            "[acceptQuoteAction] confirm_deadline missing; skipping BookingCreated send",
            { booking_id },
          );
        }

        if (inApp.ok) {
          await gate.admin
            .from("notifications")
            .update({
              payload_jsonb: { ...basePayload, email_delivery: emailDelivery },
            })
            .eq("id", inApp.id);
        }
      } catch (e) {
        console.error("[acceptQuoteAction] notify booking.created failed", e);
      }
    })(),
  );

  // Notify each auto-rejected sibling supplier. Supabase surfaces the
  // one-to-one join as either an object or a single-element array depending on
  // the version; handle both.
  //
  // The supplier-side RFQ route is keyed by the supplier's invite id, not the
  // rfq id — so batch-resolve supplier_id → invite id once before the loop and
  // build a lookup map. Skip the query entirely when there are no siblings.
  const inviteMap = new Map<string, string>();
  if (rejectedSiblings.length > 0) {
    const { data: siblingInvites } = await gate.admin
      .from("rfq_invites")
      .select("id, supplier_id")
      .eq("rfq_id", rfq_id)
      .in(
        "supplier_id",
        rejectedSiblings.map((sib) => sib.supplier_id),
      );
    for (const inv of (siblingInvites ?? []) as {
      id: string;
      supplier_id: string;
    }[]) {
      if (inv.supplier_id && inv.id) inviteMap.set(inv.supplier_id, inv.id);
    }
  }

  for (const sib of rejectedSiblings) {
    const sibProfileId = Array.isArray(sib.suppliers)
      ? sib.suppliers[0]?.profile_id ?? null
      : sib.suppliers?.profile_id ?? null;
    if (!sibProfileId) continue;
    const inviteId = inviteMap.get(sib.supplier_id) ?? null;
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
              // Pass the event_type SLUG (not the resolved name) so the
              // QuoteRejected template can render the supplier-locale label.
              event_type: eventTypeSlug ?? "",
              rfq_url: inviteId
                ? `${appUrl()}/supplier/rfqs/${inviteId}`
                : `${appUrl()}/supplier/rfqs`,
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
    return { status: "error", code: "invalidRequest" };
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
       rfqs ( id, events ( organizer_id, event_type ) )`,
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
            | { organizer_id: string | null; event_type: string | null }
            | { organizer_id: string | null; event_type: string | null }[]
            | null;
        }
      | {
          events:
            | { organizer_id: string | null; event_type: string | null }
            | { organizer_id: string | null; event_type: string | null }[]
            | null;
        }[]
      | null;
  };
  const row = ownership as unknown as OwnershipRow | null;
  if (!row) {
    return { status: "error", code: "quoteNotFound" };
  }
  const rfqsJoin = Array.isArray(row.rfqs) ? row.rfqs[0] ?? null : row.rfqs;
  const eventsJoin = Array.isArray(rfqsJoin?.events)
    ? rfqsJoin?.events[0] ?? null
    : rfqsJoin?.events ?? null;
  const organizerId = eventsJoin?.organizer_id ?? null;
  // Pass the SLUG to QuoteProposalRequested — the template resolves it to a
  // recipient-locale display name (with a localized "your event" fallback)
  // so the email never leaks an English literal into Arabic.
  const eventType = eventsJoin?.event_type ?? "";
  if (organizerId !== gate.user.id) {
    return { status: "error", code: "organizerMismatch" };
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
      return { status: "error", code: "alreadyPending" };
    }
    console.error("[requestProposalAction] insert failed", insertErr);
    return { status: "error", code: "sendFailed" };
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
          event_type: eventType,
          quote_url: inviteId
            ? `${appUrl()}/supplier/rfqs/${inviteId}`
            : `${appUrl()}/supplier/rfqs`,
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
    return { status: "error", code: "invalidRequest" };
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
    return { status: "error", code: "requestNotFound" };
  }
  if (r.status !== "pending") {
    return { status: "error", code: "requestNotPending" };
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
    return { status: "error", code: "organizerMismatch" };
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
    return { status: "error", code: "cancelFailed" };
  }
  if (!updRows || updRows.length !== 1) {
    return { status: "error", code: "cancelRaced" };
  }

  revalidatePath(`/organizer/rfqs/${rfq_id}/quotes`);
  revalidatePath(`/organizer/rfqs/${rfq_id}/quotes/${r.quote_id}`);
  revalidatePath("/supplier/rfqs", "layout");

  return { status: "success", message: "Proposal request cancelled." };
}
