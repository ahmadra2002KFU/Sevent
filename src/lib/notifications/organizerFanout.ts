import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification, type NotificationKind } from "./inApp";
import { sendEmail } from "./email";
import {
  resolveRecipientEmailAndLocale,
  type RecipientLocale,
} from "./recipients";

/**
 * Application-layer fan-out for organizer-facing notifications.
 *
 * Review finding F3: migration 20260519110000 added the SQL helper
 * `notify_organizer_party(company_id, organizer_id, kind, payload)` so a
 * company's whole team hears about booking lifecycle events — but only the
 * three pg_cron functions ever called it. Every REAL-TIME notification (a
 * supplier sends a quote, uploads a proposal, confirms or cancels a booking)
 * still wrote a single row keyed to `bookings.organizer_id` /
 * `events.organizer_id`. The result: only the teammate who happened to create
 * the RFQ heard anything, in-app *and* by email. An owner watching the
 * company's pipeline got nothing.
 *
 * This module is the TypeScript counterpart of that SQL helper, and
 * deliberately mirrors its semantics exactly:
 *
 *   companyId IS NULL  → notify `organizerId` alone (individual organizer)
 *   companyId present  → notify every CURRENT member (removed_at IS NULL)
 *
 * Note the second rule means a teammate who has since left the company stops
 * receiving notifications about work they created. That is intentional and
 * matches the SQL helper; access to the underlying row is gone too.
 *
 * Emails are rendered per recipient because members can have different
 * locales — an Arabic-speaking owner and an English-speaking member on the
 * same company must each get their own language.
 */

type AdminClient = SupabaseClient;

export type OrganizerRecipient = {
  profileId: string;
  email: string | null;
  locale: RecipientLocale;
  /**
   * True for the individual the source row is keyed to (`organizer_id`) —
   * the teammate who actually raised the RFQ or made the booking. Callers can
   * use this to vary copy ("your RFQ" vs "your company's RFQ") if they want;
   * nothing depends on it today.
   */
  isPrimary: boolean;
};

export type OrganizerPartyRef = {
  /** `events.company_id` / `bookings.company_id`. Null for individuals. */
  companyId: string | null | undefined;
  /** `events.organizer_id` / `bookings.organizer_id`. */
  organizerId: string | null | undefined;
};

/**
 * Resolve the set of profiles that should hear about an organizer-side event,
 * each with their own email + locale already looked up.
 *
 * Returns an empty array when there is nothing to notify (no company and no
 * organizer id), so callers can treat it uniformly.
 */
export async function resolveOrganizerPartyRecipients(
  admin: AdminClient,
  ref: OrganizerPartyRef,
): Promise<OrganizerRecipient[]> {
  const { companyId, organizerId } = ref;

  let profileIds: string[];

  if (!companyId) {
    if (!organizerId) return [];
    profileIds = [organizerId];
  } else {
    const { data, error } = await admin
      .from("organizer_memberships")
      .select("profile_id")
      .eq("company_id", companyId)
      .is("removed_at", null);

    if (error) {
      // Degrade to the individual organizer rather than dropping the
      // notification entirely — a membership lookup failure must not lose the
      // "a quote arrived" signal for the person who raised the RFQ.
      console.error("[organizerFanout] membership lookup failed", {
        companyId,
        message: error.message,
      });
      profileIds = organizerId ? [organizerId] : [];
    } else {
      profileIds = (data ?? []).map(
        (r) => (r as { profile_id: string }).profile_id,
      );
      if (profileIds.length === 0 && organizerId) {
        // Company with no current members (every seat removed). Fall back so
        // the notification is not silently dropped.
        profileIds = [organizerId];
      }
    }
  }

  const unique = Array.from(new Set(profileIds));

  return Promise.all(
    unique.map(async (profileId) => {
      const { email, locale } = await resolveRecipientEmailAndLocale(
        admin,
        profileId,
      );
      return {
        profileId,
        email,
        locale,
        isPrimary: profileId === organizerId,
      } satisfies OrganizerRecipient;
    }),
  );
}

export type LifecycleEmailDelivery = "sent" | "console" | "failed" | "skipped";

/** Per-recipient email content. Return null to skip the email for that person. */
export type OrganizerEmailBuilder = (recipient: OrganizerRecipient) => {
  subject: string;
  react: Parameters<typeof sendEmail>[0]["react"];
} | null;

export type NotifyOrganizerPartyArgs = {
  ref: OrganizerPartyRef;
  kind: NotificationKind | string;
  /** Base payload; `email_delivery` is managed by this function. */
  payload: Record<string, unknown>;
  /** Omit to write in-app rows only. */
  email?: OrganizerEmailBuilder;
  /** Log context, e.g. `{ stage: "sendQuote/quote.sent", id: quoteId }`. */
  context: { stage: string; id: string };
};

export type NotifyOrganizerPartyResult = {
  recipients: number;
  inAppWritten: number;
  emailsSent: number;
};

/**
 * Write the in-app notification and send the lifecycle email to every member
 * of the organizer party, recording the per-recipient delivery state on each
 * notification row (the same `email_delivery` contract the single-recipient
 * call sites already used).
 *
 * Never throws: a failure for one recipient is logged and the rest continue.
 * Lifecycle emails are best-effort by design — the DB writes that matter are
 * already committed by the time this runs.
 */
export async function notifyOrganizerParty(
  admin: AdminClient,
  args: NotifyOrganizerPartyArgs,
): Promise<NotifyOrganizerPartyResult> {
  const { ref, kind, payload, email, context } = args;

  let recipients: OrganizerRecipient[] = [];
  try {
    recipients = await resolveOrganizerPartyRecipients(admin, ref);
  } catch (err) {
    console.error(`[${context.stage}] recipient resolution threw`, {
      id: context.id,
      message: err instanceof Error ? err.message : String(err),
    });
    return { recipients: 0, inAppWritten: 0, emailsSent: 0 };
  }

  if (recipients.length === 0) {
    console.warn(`[${context.stage}] no organizer recipients resolved`, {
      id: context.id,
      companyId: ref.companyId ?? null,
      organizerId: ref.organizerId ?? null,
    });
    return { recipients: 0, inAppWritten: 0, emailsSent: 0 };
  }

  const outcomes = await Promise.all(
    recipients.map(async (recipient) => {
      try {
        const inApp = await createNotification({
          supabase: admin,
          user_id: recipient.profileId,
          kind,
          payload: { ...payload, email_delivery: "pending" },
        });

        let delivery: LifecycleEmailDelivery = "skipped";
        const content = email ? email(recipient) : null;

        if (content && recipient.email) {
          delivery = await sendOne(recipient.email, content, context);
        } else if (content && !recipient.email) {
          console.warn(`[${context.stage}] recipient has no email; skipping`, {
            id: context.id,
            profileId: recipient.profileId,
          });
        }

        if (inApp.ok) {
          await admin
            .from("notifications")
            .update({ payload_jsonb: { ...payload, email_delivery: delivery } })
            .eq("id", inApp.id);
        }

        return {
          inApp: inApp.ok,
          emailed: delivery === "sent" || delivery === "console",
        };
      } catch (err) {
        console.error(`[${context.stage}] notify failed for recipient`, {
          id: context.id,
          profileId: recipient.profileId,
          message: err instanceof Error ? err.message : String(err),
        });
        return { inApp: false, emailed: false };
      }
    }),
  );

  return {
    recipients: recipients.length,
    inAppWritten: outcomes.filter((o) => o.inApp).length,
    emailsSent: outcomes.filter((o) => o.emailed).length,
  };
}

async function sendOne(
  to: string,
  content: { subject: string; react: Parameters<typeof sendEmail>[0]["react"] },
  context: { stage: string; id: string },
): Promise<LifecycleEmailDelivery> {
  try {
    const result = await sendEmail({
      to,
      subject: content.subject,
      react: content.react,
    });
    if (!result.ok) {
      console.warn(`[${context.stage}] email send failed`, {
        id: context.id,
        error: result.error,
      });
      return "failed";
    }
    return result.mode === "resend" ? "sent" : "console";
  } catch (err) {
    console.error(`[${context.stage}] email send threw`, {
      id: context.id,
      message: err instanceof Error ? err.message : String(err),
    });
    return "failed";
  }
}
