"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { requireAccess } from "@/lib/auth/access";
import { enqueueEmail, makeDedupKey } from "@/lib/notifications/outbox";
import { env } from "@/lib/env";

export type InviteMutationErrorCode =
  | "notAdmin"
  | "companyMissing"
  | "emailInvalid"
  | "roleInvalid"
  | "alreadyPending"
  | "inviteNotFound"
  | "inviteResolved"
  | "mutationFailed";

export type InviteMutationState =
  | { status: "idle" }
  | { status: "success"; action: "create" | "revoke" | "resend" }
  | { status: "error"; code: InviteMutationErrorCode };

const InviteRoleSchema = z.enum(["admin", "member"]);

const CreateSchema = z.object({
  email: z.string().trim().email("emailInvalid").max(255),
  role: InviteRoleSchema,
});

const InviteIdSchema = z.object({
  invite_id: z.string().uuid(),
});

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isAdminLike(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

function generateInviteToken(): string {
  // 32 bytes → 43 chars base64url. Big enough to make brute-force vs the
  // sha256 hash infeasible while still fitting comfortably in a query string.
  return randomBytes(32)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildInviteUrl(inviteId: string, token: string): string {
  const base = (env?.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  // The `t` query param holds the plaintext token; the server matches it
  // against organizer_invites.token_hash on accept. Plaintext is delivered
  // only once via email — we never store or echo it after this point.
  return `${base}/invite/organizer/${encodeURIComponent(inviteId)}?t=${encodeURIComponent(token)}`;
}

async function enqueueInviteEmail(opts: {
  admin: ReturnType<
    typeof import("@/lib/supabase/server").createSupabaseServiceRoleClient
  >;
  companyId: string;
  inviteId: string;
  email: string;
  role: "admin" | "member";
  expiresAt: string;
  url: string;
  inviterName: string | null;
  companyName: string;
  locale: "en" | "ar";
}): Promise<void> {
  const payload = {
    locale: opts.locale,
    company_name: opts.companyName,
    company_id: opts.companyId,
    role: opts.role,
    invite_url: opts.url,
    expires_at: opts.expiresAt,
    inviter_name: opts.inviterName ?? null,
  };
  const dedupKey = makeDedupKey("organizer.invite_sent", opts.inviteId, payload);
  const result = await enqueueEmail(opts.admin, {
    recipientProfileId: null,
    recipientEmail: opts.email,
    templateKind: "organizer.invite_sent",
    locale: opts.locale,
    payload,
    dedupKey,
  });
  if (!result.ok) {
    // Log but do not throw — the invite row is the durable record. Admins
    // can resend if the email failed to enqueue.
    console.error("[invites/enqueueInviteEmail] outbox enqueue failed", {
      inviteId: opts.inviteId,
      error: result.error,
    });
  }
}

async function loadInviterContext(
  admin: ReturnType<
    typeof import("@/lib/supabase/server").createSupabaseServiceRoleClient
  >,
  inviterId: string,
  companyId: string,
): Promise<{ inviterName: string | null; companyName: string }> {
  const [inviterRes, companyRes] = await Promise.all([
    admin
      .from("profiles")
      .select("full_name")
      .eq("id", inviterId)
      .maybeSingle(),
    admin
      .from("organizer_companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle(),
  ]);
  return {
    inviterName:
      (inviterRes.data as { full_name?: string | null } | null)?.full_name ??
      null,
    companyName:
      (companyRes.data as { name?: string } | null)?.name ?? "",
  };
}

/**
 * Issue a single-use invite. Token is generated server-side, hashed inside
 * the RPC, and embedded in the URL that goes out by email. Plaintext is
 * never persisted nor returned to the browser.
 */
export async function createInviteAction(
  _prev: InviteMutationState | undefined,
  formData: FormData,
): Promise<InviteMutationState> {
  const { user, admin, decision } = await requireAccess("organizer.settings");
  const companyId = decision.activeCompanyId;

  if (!companyId) {
    return { status: "error", code: "companyMissing" };
  }
  if (!isAdminLike(decision.companyRole)) {
    return { status: "error", code: "notAdmin" };
  }

  const parsed = CreateSchema.safeParse({
    email: formData.get("email") ?? "",
    role: formData.get("role") ?? "",
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "emailInvalid";
    return {
      status: "error",
      code:
        first === "emailInvalid" || first === "roleInvalid"
          ? (first as InviteMutationErrorCode)
          : "emailInvalid",
    };
  }

  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

  const { data: rpcData, error } = await admin.rpc(
    "create_organizer_invite_tx",
    {
      p_company_id: companyId,
      p_actor_profile_id: user.id,
      p_email: parsed.data.email,
      p_role: parsed.data.role,
      p_token: token,
      p_expires_at: expiresAt,
    },
  );

  if (error) {
    const code = (error as { code?: string }).code ?? null;
    if (code === "P0050") return { status: "error", code: "alreadyPending" };
    if (code === "P0051") return { status: "error", code: "notAdmin" };
    if (code === "P0052") return { status: "error", code: "roleInvalid" };
    console.error("[createInviteAction] RPC failed", {
      code,
      message: error.message,
    });
    return { status: "error", code: "mutationFailed" };
  }

  const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  const inviteId = (row as { out_invite_id?: string } | null)?.out_invite_id;
  if (!inviteId) {
    return { status: "error", code: "mutationFailed" };
  }

  const locale = ((await getLocale()) === "ar" ? "ar" : "en") as "en" | "ar";
  const { inviterName, companyName } = await loadInviterContext(
    admin,
    user.id,
    companyId,
  );
  await enqueueInviteEmail({
    admin,
    companyId,
    inviteId,
    email: parsed.data.email,
    role: parsed.data.role,
    expiresAt,
    url: buildInviteUrl(inviteId, token),
    inviterName,
    companyName,
    locale,
  });

  revalidatePath("/organizer/settings/invites");
  return { status: "success", action: "create" };
}

/**
 * Cancel a pending invite. Idempotent only for terminal statuses — already-
 * revoked/expired/accepted invites raise so the UI can tell the user.
 */
export async function revokeInviteAction(
  _prev: InviteMutationState | undefined,
  formData: FormData,
): Promise<InviteMutationState> {
  const { user, admin, decision } = await requireAccess("organizer.settings");
  const companyId = decision.activeCompanyId;

  if (!companyId) {
    return { status: "error", code: "companyMissing" };
  }
  if (!isAdminLike(decision.companyRole)) {
    return { status: "error", code: "notAdmin" };
  }

  const parsed = InviteIdSchema.safeParse({
    invite_id: formData.get("invite_id") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", code: "inviteNotFound" };
  }

  const { error } = await admin.rpc("revoke_organizer_invite_tx", {
    p_invite_id: parsed.data.invite_id,
    p_actor_profile_id: user.id,
    p_reason: null,
  });

  if (error) {
    const code = (error as { code?: string }).code ?? null;
    if (code === "P0051") return { status: "error", code: "notAdmin" };
    if (code === "P0053") return { status: "error", code: "inviteNotFound" };
    if (code === "P0054") return { status: "error", code: "inviteResolved" };
    console.error("[revokeInviteAction] RPC failed", {
      code,
      message: error.message,
    });
    return { status: "error", code: "mutationFailed" };
  }

  revalidatePath("/organizer/settings/invites");
  return { status: "success", action: "revoke" };
}

/**
 * Resend = revoke existing pending invite + create a new one with the same
 * (email, role). Two-step is acceptable because the partial unique index
 * ((company_id, lower(email)) where status='pending') guarantees we never
 * end up with two pending invites for the same address, and if the
 * second step fails the admin can simply create a fresh invite from the
 * form.
 */
export async function resendInviteAction(
  _prev: InviteMutationState | undefined,
  formData: FormData,
): Promise<InviteMutationState> {
  const { user, admin, decision } = await requireAccess("organizer.settings");
  const companyId = decision.activeCompanyId;

  if (!companyId) {
    return { status: "error", code: "companyMissing" };
  }
  if (!isAdminLike(decision.companyRole)) {
    return { status: "error", code: "notAdmin" };
  }

  const parsed = InviteIdSchema.safeParse({
    invite_id: formData.get("invite_id") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", code: "inviteNotFound" };
  }

  // Look up the existing row so we can replay (email, role) onto a fresh
  // token. We need the company_id match here so a malicious admin in a
  // different company can't operate on someone else's invite — service_role
  // bypasses RLS, so the .eq(company_id) is the guard.
  const { data: existing } = await admin
    .from("organizer_invites")
    .select("email, role, status")
    .eq("id", parsed.data.invite_id)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!existing) {
    return { status: "error", code: "inviteNotFound" };
  }
  const row = existing as {
    email: string;
    role: "admin" | "member";
    status: string;
  };
  if (row.status !== "pending") {
    return { status: "error", code: "inviteResolved" };
  }

  // Step 1: revoke the old row.
  const { error: revokeError } = await admin.rpc("revoke_organizer_invite_tx", {
    p_invite_id: parsed.data.invite_id,
    p_actor_profile_id: user.id,
    p_reason: "resend",
  });
  if (revokeError) {
    const code = (revokeError as { code?: string }).code ?? null;
    if (code === "P0051") return { status: "error", code: "notAdmin" };
    if (code === "P0053") return { status: "error", code: "inviteNotFound" };
    if (code === "P0054") return { status: "error", code: "inviteResolved" };
    console.error("[resendInviteAction] revoke failed", {
      code,
      message: revokeError.message,
    });
    return { status: "error", code: "mutationFailed" };
  }

  // Step 2: fresh invite with new token + expiry.
  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
  const { data: rpcData, error: createError } = await admin.rpc(
    "create_organizer_invite_tx",
    {
      p_company_id: companyId,
      p_actor_profile_id: user.id,
      p_email: row.email,
      p_role: row.role,
      p_token: token,
      p_expires_at: expiresAt,
    },
  );

  if (createError) {
    const code = (createError as { code?: string }).code ?? null;
    console.error("[resendInviteAction] create failed", {
      code,
      message: createError.message,
    });
    return { status: "error", code: "mutationFailed" };
  }

  const newRow = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  const newInviteId = (newRow as { out_invite_id?: string } | null)
    ?.out_invite_id;
  if (!newInviteId) {
    return { status: "error", code: "mutationFailed" };
  }

  const locale = ((await getLocale()) === "ar" ? "ar" : "en") as "en" | "ar";
  const { inviterName, companyName } = await loadInviterContext(
    admin,
    user.id,
    companyId,
  );
  await enqueueInviteEmail({
    admin,
    companyId,
    inviteId: newInviteId,
    email: row.email,
    role: row.role,
    expiresAt,
    url: buildInviteUrl(newInviteId, token),
    inviterName,
    companyName,
    locale,
  });

  revalidatePath("/organizer/settings/invites");
  return { status: "success", action: "resend" };
}
