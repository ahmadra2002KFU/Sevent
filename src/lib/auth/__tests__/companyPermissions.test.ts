import { describe, expect, it } from "vitest";
import {
  canChangeMemberRole,
  canInviteAtRole,
  canRemoveMember,
  type MemberSubject,
} from "../companyPermissions";

const other = (role: MemberSubject["role"]): MemberSubject => ({
  role,
  isSelf: false,
});
const self = (role: MemberSubject["role"]): MemberSubject => ({
  role,
  isSelf: true,
});

describe("canChangeMemberRole", () => {
  it("lets an owner change admins and members", () => {
    expect(canChangeMemberRole("owner", other("admin"))).toBe(true);
    expect(canChangeMemberRole("owner", other("member"))).toBe(true);
  });

  it("never exposes a role control on an owner row", () => {
    // change_member_role_tx raises P0056 for owner targets, both directions.
    expect(canChangeMemberRole("owner", other("owner"))).toBe(false);
    expect(canChangeMemberRole("owner", self("owner"))).toBe(false);
    expect(canChangeMemberRole("admin", other("owner"))).toBe(false);
  });

  it("blocks admin -> sibling admin (P0058)", () => {
    expect(canChangeMemberRole("admin", other("admin"))).toBe(false);
  });

  it("allows an admin to demote themselves", () => {
    // The RPC exempts actor = target from the admin/admin guard.
    expect(canChangeMemberRole("admin", self("admin"))).toBe(true);
  });

  it("allows an admin to manage plain members", () => {
    expect(canChangeMemberRole("admin", other("member"))).toBe(true);
  });

  it("denies plain members and non-members outright", () => {
    expect(canChangeMemberRole("member", other("member"))).toBe(false);
    expect(canChangeMemberRole("member", self("member"))).toBe(false);
    expect(canChangeMemberRole(null, other("member"))).toBe(false);
  });
});

describe("canRemoveMember", () => {
  it("lets an owner remove admins and members", () => {
    expect(canRemoveMember("owner", other("admin"))).toBe(true);
    expect(canRemoveMember("owner", other("member"))).toBe(true);
  });

  it("never exposes remove on an owner row (transfer first)", () => {
    // remove_company_member_tx raises P0044 for the sole owner; the UI hides
    // the control on every owner row rather than guessing at owner count.
    expect(canRemoveMember("owner", self("owner"))).toBe(false);
    expect(canRemoveMember("owner", other("owner"))).toBe(false);
  });

  it("blocks admin -> sibling admin (P0059)", () => {
    expect(canRemoveMember("admin", other("admin"))).toBe(false);
  });

  it("lets any non-owner leave on their own row", () => {
    expect(canRemoveMember("admin", self("admin"))).toBe(true);
    expect(canRemoveMember("member", self("member"))).toBe(true);
  });

  it("lets an admin remove plain members", () => {
    expect(canRemoveMember("admin", other("member"))).toBe(true);
  });

  it("denies a plain member acting on anyone else", () => {
    expect(canRemoveMember("member", other("member"))).toBe(false);
    expect(canRemoveMember("member", other("admin"))).toBe(false);
    expect(canRemoveMember(null, other("member"))).toBe(false);
  });
});

describe("canInviteAtRole", () => {
  it("lets only owners mint admins (P0061)", () => {
    expect(canInviteAtRole("owner", "admin")).toBe(true);
    expect(canInviteAtRole("admin", "admin")).toBe(false);
  });

  it("lets owners and admins invite members", () => {
    expect(canInviteAtRole("owner", "member")).toBe(true);
    expect(canInviteAtRole("admin", "member")).toBe(true);
  });

  it("denies plain members and non-members", () => {
    expect(canInviteAtRole("member", "member")).toBe(false);
    expect(canInviteAtRole("member", "admin")).toBe(false);
    expect(canInviteAtRole(null, "member")).toBe(false);
  });
});
