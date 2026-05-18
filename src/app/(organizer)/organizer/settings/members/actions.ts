"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccess } from "@/lib/auth/access";

export type MemberMutationErrorCode =
  | "notAdmin"
  | "companyMissing"
  | "memberNotFound"
  | "cannotChangeOwner"
  | "cannotRemoveSoleOwner"
  | "invalidRole"
  | "selfTransfer"
  | "transferTargetMissing"
  | "mutationFailed";

export type MemberMutationState =
  | { status: "idle" }
  | { status: "success"; action: "role" | "remove" | "transfer" }
  | { status: "error"; code: MemberMutationErrorCode };

const RoleSchema = z.enum(["admin", "member"]);

const ChangeRoleSchema = z.object({
  profile_id: z.string().uuid(),
  new_role: RoleSchema,
});

const RemoveSchema = z.object({
  profile_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

const TransferSchema = z.object({
  profile_id: z.string().uuid(),
});

function isAdminLike(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Promote/demote between admin <-> member. Owner moves require the
 * dedicated transfer flow.
 */
export async function changeMemberRoleAction(
  _prev: MemberMutationState | undefined,
  formData: FormData,
): Promise<MemberMutationState> {
  const { user, admin, decision } = await requireAccess("organizer.settings");
  const companyId = decision.activeCompanyId;

  if (!companyId) {
    return { status: "error", code: "companyMissing" };
  }
  if (!isAdminLike(decision.companyRole)) {
    return { status: "error", code: "notAdmin" };
  }

  const parsed = ChangeRoleSchema.safeParse({
    profile_id: formData.get("profile_id") ?? "",
    new_role: formData.get("new_role") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", code: "invalidRole" };
  }

  const { error } = await admin.rpc("change_member_role_tx", {
    p_company_id: companyId,
    p_actor_profile_id: user.id,
    p_target_profile_id: parsed.data.profile_id,
    p_new_role: parsed.data.new_role,
  });

  if (error) {
    const code = (error as { code?: string }).code ?? null;
    if (code === "P0051") return { status: "error", code: "notAdmin" };
    if (code === "P0055") return { status: "error", code: "memberNotFound" };
    if (code === "P0056") {
      return { status: "error", code: "cannotChangeOwner" };
    }
    console.error("[changeMemberRoleAction] RPC failed", {
      code,
      message: error.message,
    });
    return { status: "error", code: "mutationFailed" };
  }

  revalidatePath("/organizer/settings/members");
  return { status: "success", action: "role" };
}

/**
 * Soft-delete a membership row. The RPC enforces the sole-owner guard and
 * the admin precondition.
 */
export async function removeMemberAction(
  _prev: MemberMutationState | undefined,
  formData: FormData,
): Promise<MemberMutationState> {
  const { user, admin, decision } = await requireAccess("organizer.settings");
  const companyId = decision.activeCompanyId;

  if (!companyId) {
    return { status: "error", code: "companyMissing" };
  }

  const parsed = RemoveSchema.safeParse({
    profile_id: formData.get("profile_id") ?? "",
    reason: formData.get("reason") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", code: "memberNotFound" };
  }

  // Self-removal is always allowed regardless of role (RPC mirrors that
  // rule); admin/owner can remove others.
  const isSelf = parsed.data.profile_id === user.id;
  if (!isSelf && !isAdminLike(decision.companyRole)) {
    return { status: "error", code: "notAdmin" };
  }

  const { error } = await admin.rpc("remove_company_member_tx", {
    p_company_id: companyId,
    p_actor_profile_id: user.id,
    p_target_profile_id: parsed.data.profile_id,
    p_reason: parsed.data.reason ?? null,
  });

  if (error) {
    const code = (error as { code?: string }).code ?? null;
    if (code === "P0045") return { status: "error", code: "notAdmin" };
    if (code === "P0049") return { status: "error", code: "memberNotFound" };
    if (code === "P0044") {
      return { status: "error", code: "cannotRemoveSoleOwner" };
    }
    console.error("[removeMemberAction] RPC failed", {
      code,
      message: error.message,
    });
    return { status: "error", code: "mutationFailed" };
  }

  revalidatePath("/organizer/settings/members");
  return { status: "success", action: "remove" };
}

/**
 * Transfer ownership. Only callable by the current owner; the target must
 * be a current admin/member. After the transfer the former owner becomes
 * an admin.
 */
export async function transferOwnershipAction(
  _prev: MemberMutationState | undefined,
  formData: FormData,
): Promise<MemberMutationState> {
  const { user, admin, decision } = await requireAccess("organizer.settings");
  const companyId = decision.activeCompanyId;

  if (!companyId) {
    return { status: "error", code: "companyMissing" };
  }
  if (decision.companyRole !== "owner") {
    return { status: "error", code: "notAdmin" };
  }

  const parsed = TransferSchema.safeParse({
    profile_id: formData.get("profile_id") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", code: "transferTargetMissing" };
  }
  if (parsed.data.profile_id === user.id) {
    return { status: "error", code: "selfTransfer" };
  }

  const { error } = await admin.rpc("transfer_company_ownership_tx", {
    p_company_id: companyId,
    p_from_profile_id: user.id,
    p_to_profile_id: parsed.data.profile_id,
  });

  if (error) {
    const code = (error as { code?: string }).code ?? null;
    if (code === "P0041") return { status: "error", code: "notAdmin" };
    if (code === "P0042") {
      return { status: "error", code: "transferTargetMissing" };
    }
    console.error("[transferOwnershipAction] RPC failed", {
      code,
      message: error.message,
    });
    return { status: "error", code: "mutationFailed" };
  }

  revalidatePath("/organizer/settings/members");
  return { status: "success", action: "transfer" };
}
