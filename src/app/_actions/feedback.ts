"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccess } from "@/lib/auth/access";
import type { AppRole } from "@/lib/supabase/server";

// Keep these aligned with the feedback_category / feedback_status enums in
// supabase/migrations/20260428000000_app_feedback.sql. If a new category or
// status is added there, mirror it here AND in the i18n message bundle.
const FEEDBACK_CATEGORIES = [
  "bug",
  "feature",
  "confusing",
  "praise",
  "other",
] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

const FEEDBACK_STATUSES = ["new", "triaged", "resolved"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

// Stringified `console_errors` payload size cap. Schema doesn't enforce this
// at the DB level (jsonb) so we gate it here before insert. Matches the
// client-side ring buffer (last 10 × 500 chars ≈ 5 KB) with headroom.
const CONSOLE_ERRORS_MAX_BYTES = 10_000;

// Screenshot upload caps. Bucket has its own 3 MB ceiling + MIME allowlist
// (see migration 20260428010000); these are the action-level guards.
const SCREENSHOT_MAX_BYTES = 3 * 1024 * 1024; // 3 MB
const SCREENSHOT_MIME_ALLOWLIST = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const SCREENSHOT_BUCKET = "feedback-screenshots";

function extensionForMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

const SubmitFeedbackSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORIES),
  message: z
    .string()
    .trim()
    .min(1, "feedback_required")
    .max(5000, "feedback_too_long"),
  page_url: z.string().max(2048).optional().nullable(),
  locale: z.enum(["en", "ar"]).optional().nullable(),
  viewport_w: z.coerce.number().int().positive().max(16384).optional().nullable(),
  viewport_h: z.coerce.number().int().positive().max(16384).optional().nullable(),
  user_agent: z.string().max(500).optional().nullable(),
  console_errors: z
    .string()
    .max(CONSOLE_ERRORS_MAX_BYTES, "console_errors_too_large")
    .optional()
    .nullable(),
});

export type SubmitFeedbackState = {
  ok: boolean;
  code?:
    | "unauthenticated"
    | "invalid"
    | "screenshot_too_large"
    | "screenshot_invalid_type"
    | "screenshot_upload_failed"
    | "db_error";
  message?: string;
};

/**
 * Submit a feedback row. Any signed-in user (any role, any state) can call
 * this. The user_id and role are resolved server-side from the auth cookie —
 * never trust client-supplied identity.
 */
export async function submitFeedbackAction(
  _prev: SubmitFeedbackState | undefined,
  formData: FormData,
): Promise<SubmitFeedbackState> {
  const { decision, admin } = await requireAccess("feedback.submit");
  if (!decision.userId) {
    return { ok: false, code: "unauthenticated" };
  }

  const parsed = SubmitFeedbackSchema.safeParse({
    category: formData.get("category"),
    message: formData.get("message"),
    page_url: formData.get("page_url"),
    locale: formData.get("locale"),
    viewport_w: formData.get("viewport_w"),
    viewport_h: formData.get("viewport_h"),
    user_agent: formData.get("user_agent"),
    console_errors: formData.get("console_errors"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid",
      message: parsed.error.issues[0]?.message ?? "invalid",
    };
  }

  // Resolve role server-side — denormalized at submit time so the admin queue
  // can filter without a profiles join. `decision.role` is already loaded by
  // requireAccess but profiles.role is the source of truth.
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", decision.userId)
    .maybeSingle();
  const role: AppRole = ((profile as { role: AppRole } | null)?.role ??
    decision.role ??
    "organizer") as AppRole;

  let consoleErrors: unknown = null;
  if (parsed.data.console_errors) {
    try {
      consoleErrors = JSON.parse(parsed.data.console_errors);
    } catch {
      // Malformed payload — drop silently rather than failing the whole
      // submission. The message text is what matters.
      consoleErrors = null;
    }
  }

  // Screenshot is optional. When the client ticks the "include screenshot"
  // checkbox, the widget captures the viewport with html2canvas, encodes a
  // JPEG, and appends it as a Blob under the `screenshot` field. We validate
  // size + MIME, upload via the service-role admin client (the storage RLS
  // policy also enforces "owner only" as defense in depth), and persist the
  // resulting path on the row.
  const screenshotEntry = formData.get("screenshot");
  let screenshotPath: string | null = null;
  if (screenshotEntry instanceof File && screenshotEntry.size > 0) {
    if (screenshotEntry.size > SCREENSHOT_MAX_BYTES) {
      return {
        ok: false,
        code: "screenshot_too_large",
        message: `screenshot exceeds ${SCREENSHOT_MAX_BYTES} bytes`,
      };
    }
    const mime = screenshotEntry.type;
    if (!SCREENSHOT_MIME_ALLOWLIST.has(mime)) {
      return {
        ok: false,
        code: "screenshot_invalid_type",
        message: `unsupported mime: ${mime || "<empty>"}`,
      };
    }
    const ext = extensionForMime(mime);
    const objectPath = `${decision.userId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from(SCREENSHOT_BUCKET)
      .upload(objectPath, screenshotEntry, {
        contentType: mime,
        cacheControl: "private, max-age=31536000, immutable",
        upsert: false,
      });
    if (uploadError) {
      return {
        ok: false,
        code: "screenshot_upload_failed",
        message: uploadError.message,
      };
    }
    screenshotPath = objectPath;
  }

  const { error } = await admin.from("app_feedback").insert({
    user_id: decision.userId,
    role,
    category: parsed.data.category,
    message: parsed.data.message,
    page_url: parsed.data.page_url ?? null,
    locale: parsed.data.locale ?? null,
    viewport_w: parsed.data.viewport_w ?? null,
    viewport_h: parsed.data.viewport_h ?? null,
    user_agent: parsed.data.user_agent ?? null,
    console_errors: consoleErrors,
    screenshot_path: screenshotPath,
  });
  if (error) {
    // Best-effort: if the insert failed but we already uploaded a screenshot,
    // remove it so we don't accumulate orphan blobs in the bucket.
    if (screenshotPath) {
      await admin.storage.from(SCREENSHOT_BUCKET).remove([screenshotPath]);
    }
    return { ok: false, code: "db_error", message: error.message };
  }

  // Revalidate the admin queue so a refresh shows the new row.
  revalidatePath("/admin/feedback");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Admin: update feedback status / notes
// ---------------------------------------------------------------------------

const UpdateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(FEEDBACK_STATUSES),
  admin_notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type UpdateFeedbackStatusState = {
  ok: boolean;
  code?: "invalid" | "db_error";
  message?: string;
};

export async function updateFeedbackStatusAction(
  _prev: UpdateFeedbackStatusState | undefined,
  formData: FormData,
): Promise<UpdateFeedbackStatusState> {
  const { admin } = await requireAccess("feedback.admin.write");

  const parsed = UpdateStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    admin_notes: formData.get("admin_notes"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid",
      message: parsed.error.issues[0]?.message ?? "invalid",
    };
  }

  const { error } = await admin
    .from("app_feedback")
    .update({
      status: parsed.data.status,
      admin_notes: parsed.data.admin_notes,
      // resolved_at flips on/off in lockstep with status: only set when
      // moving to resolved, cleared on any other status (including re-open).
      resolved_at:
        parsed.data.status === "resolved" ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.id);
  if (error) {
    return { ok: false, code: "db_error", message: error.message };
  }

  revalidatePath("/admin/feedback");
  return { ok: true };
}
