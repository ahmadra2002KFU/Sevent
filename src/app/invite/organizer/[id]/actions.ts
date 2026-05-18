"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createSupabaseServiceRoleClient,
  getCurrentUser,
} from "@/lib/supabase/server";
import { setActiveCompanyCookie } from "@/lib/auth/activeCompany";

export type AcceptInviteErrorCode =
  | "unauthenticated"
  | "wrongRole"
  | "tokenInvalid"
  | "notFound"
  | "expired"
  | "revoked"
  | "alreadyMember"
  | "acceptFailed";

export type AcceptInviteState =
  | { status: "idle" }
  | { status: "error"; code: AcceptInviteErrorCode };

const InputSchema = z.object({
  invite_id: z.string().uuid(),
  token: z.string().min(1).max(2048),
});

/**
 * Accept the invite via accept_organizer_invite_tx. The page already
 * validated invite status + token presence client-side, but the RPC is
 * the security boundary — it re-verifies the sha256(token) against the
 * stored hash under a FOR UPDATE lock.
 */
export async function acceptInviteAction(
  _prev: AcceptInviteState | undefined,
  formData: FormData,
): Promise<AcceptInviteState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", code: "unauthenticated" };
  }

  const parsed = InputSchema.safeParse({
    invite_id: formData.get("invite_id") ?? "",
    token: formData.get("token") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", code: "tokenInvalid" };
  }

  const admin = createSupabaseServiceRoleClient();

  // Role compatibility check — the page renders an early-out for this
  // case, but a determined caller could POST directly to the action.
  const { data: profileRow } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const profileRole = (profileRow as { role?: string } | null)?.role ?? null;
  if (profileRole && profileRole !== "organizer" && profileRole !== "agency") {
    return { status: "error", code: "wrongRole" };
  }

  const { data: rpcData, error } = await admin.rpc(
    "accept_organizer_invite_tx",
    {
      p_invite_id: parsed.data.invite_id,
      p_token: parsed.data.token,
      p_profile_id: user.id,
    },
  );

  if (error) {
    const code = (error as { code?: string }).code ?? null;
    if (code === "P0043") return { status: "error", code: "notFound" };
    if (code === "P0046") return { status: "error", code: "tokenInvalid" };
    if (code === "P0047") return { status: "error", code: "expired" };
    if (code === "P0048") return { status: "error", code: "alreadyMember" };
    console.error("[acceptInviteAction] RPC failed", {
      code,
      message: error.message,
    });
    return { status: "error", code: "acceptFailed" };
  }

  const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  const companyId = (row as { out_company_id?: string } | null)?.out_company_id;
  if (!companyId) {
    return { status: "error", code: "acceptFailed" };
  }

  // Persist active-company cookie so the next navigation lands inside the
  // company surface. accept_organizer_invite_tx already wrote
  // last_active_company_id; the cookie is the fast-path signal.
  await setActiveCompanyCookie(companyId);

  redirect("/organizer/dashboard");
}
