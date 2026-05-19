"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAccess } from "@/lib/auth/access";
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
 *
 * Auth: routed through `requireAccess("organizer.onboarding")` so a
 * suspended / banned / wrong-role user is caught at the access-decision
 * layer rather than via a bare profile.role check. Granting the feature
 * is what `organizer.active` + `organizer.no_company` already do; any
 * other state redirects to bestDestination before we touch the RPC.
 */
export async function acceptInviteAction(
  _prev: AcceptInviteState | undefined,
  formData: FormData,
): Promise<AcceptInviteState> {
  // requireAccess throws NEXT_REDIRECT for unauthenticated / unauthorized
  // states; if we get past this call the user is a viable organizer-side
  // identity. The matrix admits `organizer.active` and `organizer.no_company`.
  const { user, admin } = await requireAccess("organizer.onboarding");

  const parsed = InputSchema.safeParse({
    invite_id: formData.get("invite_id") ?? "",
    token: formData.get("token") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", code: "tokenInvalid" };
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
