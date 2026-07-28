/**
 * Client-safe mirrors of the company-membership guard rails enforced by the
 * `*_tx` RPCs.
 *
 * These predicates exist so the settings UI never renders a control the server
 * will reject (review finding F4 — an admin was shown a role dropdown and a
 * Remove button on a sibling admin's row, and an "Admin" option in the invite
 * form, all three of which raise). The server remains the security boundary;
 * this module only decides what to *show*.
 *
 * Every rule below is transcribed from a migration. If you change one, change
 * the matching RPC and the tests in `__tests__/companyPermissions.test.ts`:
 *
 *   change_member_role_tx     (20260519120000) → P0056 owner rows, P0058 admin↔admin
 *   remove_company_member_tx  (20260728120000) → P0044 sole owner, P0059 admin↔admin
 *   create_organizer_invite_tx(20260519120000) → P0052 owner role, P0061 admin↔admin
 */

import type { CompanyRole } from "./activeCompany";

/** The subset of a member row these predicates need. */
export type MemberSubject = {
  role: CompanyRole;
  /** True when this row is the viewer's own membership. */
  isSelf: boolean;
};

function isAdminLike(viewerRole: CompanyRole | null): boolean {
  return viewerRole === "owner" || viewerRole === "admin";
}

/**
 * May the viewer change this member's role (admin ⇄ member)?
 *
 * Owner rows are never editable here — ownership moves only through
 * `transfer_company_ownership_tx`. An admin may manage members and may step
 * themselves down from admin to member, but may not demote a sibling admin.
 */
export function canChangeMemberRole(
  viewerRole: CompanyRole | null,
  member: MemberSubject,
): boolean {
  if (member.role === "owner") return false;
  if (!isAdminLike(viewerRole)) return false;
  if (viewerRole === "owner") return true;
  return member.role === "member" || member.isSelf;
}

/**
 * May the viewer remove this member (or leave, when it's their own row)?
 *
 * Anyone non-owner may leave of their own accord. Owners must transfer
 * ownership first, so owner rows never show a remove control. An admin may
 * remove members but not a sibling admin.
 */
export function canRemoveMember(
  viewerRole: CompanyRole | null,
  member: MemberSubject,
): boolean {
  if (member.role === "owner") return false;
  if (member.isSelf) return true;
  if (!isAdminLike(viewerRole)) return false;
  if (viewerRole === "owner") return true;
  return member.role === "member";
}

/**
 * May the viewer issue an invite at `admin` role? Only owners may mint admins
 * (P0061). `owner`-role invites are rejected outright by the RPC and are not
 * offered anywhere in the UI.
 */
export function canInviteAtRole(
  viewerRole: CompanyRole | null,
  role: "admin" | "member",
): boolean {
  if (!isAdminLike(viewerRole)) return false;
  if (role === "admin") return viewerRole === "owner";
  return true;
}
