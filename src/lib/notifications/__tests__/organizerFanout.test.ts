/**
 * Unit tests for the organizer notification fan-out (review finding F3).
 *
 * The behaviour under test is the rule that real-time organizer notifications
 * must reach the WHOLE company, not just the teammate whose id happens to sit
 * on the row. These tests pin the semantics against the SQL helper
 * `notify_organizer_party` (migration 20260519110000) that they mirror:
 *
 *   companyId IS NULL → the individual organizer alone
 *   companyId present → every membership with removed_at IS NULL
 *
 * plus the degradation rules that keep a lookup failure from silently
 * swallowing a "a quote arrived" signal.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const createNotification = vi.fn();
const sendEmail = vi.fn();
const resolveRecipientEmailAndLocale = vi.fn();

vi.mock("../inApp", () => ({
  createNotification: (...args: unknown[]) => createNotification(...args),
}));
vi.mock("../email", () => ({
  sendEmail: (...args: unknown[]) => sendEmail(...args),
}));
vi.mock("../recipients", () => ({
  resolveRecipientEmailAndLocale: (...args: unknown[]) =>
    resolveRecipientEmailAndLocale(...args),
}));

const { notifyOrganizerParty, resolveOrganizerPartyRecipients } = await import(
  "../organizerFanout"
);

/**
 * Minimal stand-in for the PostgREST builder chain used by the helper:
 *   admin.from("organizer_memberships").select(...).eq(...).is(...)
 * and the terminal
 *   admin.from("notifications").update(...).eq(...)
 */
function makeAdmin(opts: {
  members?: string[];
  membershipError?: string;
}): { admin: unknown; updates: unknown[] } {
  const updates: unknown[] = [];
  const admin = {
    from(table: string) {
      if (table === "organizer_memberships") {
        const result = opts.membershipError
          ? { data: null, error: { message: opts.membershipError } }
          : {
              data: (opts.members ?? []).map((profile_id) => ({ profile_id })),
              error: null,
            };
        const chain = {
          select: () => chain,
          eq: () => chain,
          is: () => Promise.resolve(result),
        };
        return chain;
      }
      // notifications
      return {
        update(payload: unknown) {
          return {
            eq(_col: string, id: unknown) {
              updates.push({ id, payload });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
  return { admin, updates };
}

beforeEach(() => {
  vi.clearAllMocks();
  createNotification.mockResolvedValue({ ok: true, id: "notif-1" });
  sendEmail.mockResolvedValue({ ok: true, id: "e1", mode: "resend" });
  resolveRecipientEmailAndLocale.mockImplementation(
    async (_admin: unknown, profileId: string) => ({
      email: `${profileId}@test.local`,
      locale: profileId === "ar-user" ? "ar" : "en",
    }),
  );
});

describe("resolveOrganizerPartyRecipients", () => {
  it("returns the individual organizer when there is no company", async () => {
    const { admin } = makeAdmin({});
    const out = await resolveOrganizerPartyRecipients(admin as never, {
      companyId: null,
      organizerId: "solo",
    });
    expect(out.map((r) => r.profileId)).toEqual(["solo"]);
    expect(out[0].isPrimary).toBe(true);
  });

  it("returns every current member when a company owns the row", async () => {
    const { admin } = makeAdmin({ members: ["owner", "admin", "creator"] });
    const out = await resolveOrganizerPartyRecipients(admin as never, {
      companyId: "co-1",
      organizerId: "creator",
    });
    expect(out.map((r) => r.profileId).sort()).toEqual([
      "admin",
      "creator",
      "owner",
    ]);
  });

  it("flags only the row's own organizer as primary", async () => {
    const { admin } = makeAdmin({ members: ["owner", "creator"] });
    const out = await resolveOrganizerPartyRecipients(admin as never, {
      companyId: "co-1",
      organizerId: "creator",
    });
    expect(out.find((r) => r.profileId === "creator")?.isPrimary).toBe(true);
    expect(out.find((r) => r.profileId === "owner")?.isPrimary).toBe(false);
  });

  it("excludes removed members (they are not returned by the query)", async () => {
    // `removed_at IS NULL` is applied in the query; the helper must not
    // re-add the organizer if they are no longer a member.
    const { admin } = makeAdmin({ members: ["owner"] });
    const out = await resolveOrganizerPartyRecipients(admin as never, {
      companyId: "co-1",
      organizerId: "departed",
    });
    expect(out.map((r) => r.profileId)).toEqual(["owner"]);
  });

  it("degrades to the individual organizer when the membership lookup fails", async () => {
    const { admin } = makeAdmin({ membershipError: "boom" });
    const out = await resolveOrganizerPartyRecipients(admin as never, {
      companyId: "co-1",
      organizerId: "creator",
    });
    expect(out.map((r) => r.profileId)).toEqual(["creator"]);
  });

  it("falls back to the organizer when a company has no current members", async () => {
    const { admin } = makeAdmin({ members: [] });
    const out = await resolveOrganizerPartyRecipients(admin as never, {
      companyId: "co-1",
      organizerId: "creator",
    });
    expect(out.map((r) => r.profileId)).toEqual(["creator"]);
  });

  it("returns nothing when there is neither a company nor an organizer", async () => {
    const { admin } = makeAdmin({});
    const out = await resolveOrganizerPartyRecipients(admin as never, {
      companyId: null,
      organizerId: null,
    });
    expect(out).toEqual([]);
  });

  it("de-duplicates a profile id that appears twice", async () => {
    const { admin } = makeAdmin({ members: ["dup", "dup", "other"] });
    const out = await resolveOrganizerPartyRecipients(admin as never, {
      companyId: "co-1",
      organizerId: "dup",
    });
    expect(out.map((r) => r.profileId).sort()).toEqual(["dup", "other"]);
  });
});

describe("notifyOrganizerParty", () => {
  const base = {
    kind: "quote.sent",
    payload: { quote_id: "q1" },
    context: { stage: "test/quote.sent", id: "q1" },
  };

  it("writes one in-app row per company member", async () => {
    const { admin } = makeAdmin({ members: ["owner", "admin", "creator"] });
    const res = await notifyOrganizerParty(admin as never, {
      ...base,
      ref: { companyId: "co-1", organizerId: "creator" },
    });
    expect(res.recipients).toBe(3);
    expect(res.inAppWritten).toBe(3);
    expect(createNotification).toHaveBeenCalledTimes(3);
  });

  it("emails every member, rendering per recipient locale", async () => {
    const { admin } = makeAdmin({ members: ["en-user", "ar-user"] });
    const builder = vi.fn((r: { locale: string }) => ({
      subject: `subject-${r.locale}`,
      react: null as never,
    }));
    const res = await notifyOrganizerParty(admin as never, {
      ...base,
      ref: { companyId: "co-1", organizerId: "en-user" },
      email: builder,
    });
    expect(res.emailsSent).toBe(2);
    const subjects = sendEmail.mock.calls.map((c) => c[0].subject).sort();
    expect(subjects).toEqual(["subject-ar", "subject-en"]);
  });

  it("writes in-app rows only when no email builder is supplied", async () => {
    const { admin } = makeAdmin({ members: ["a", "b"] });
    const res = await notifyOrganizerParty(admin as never, {
      ...base,
      ref: { companyId: "co-1", organizerId: "a" },
    });
    expect(res.inAppWritten).toBe(2);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("records the per-recipient delivery state on the notification row", async () => {
    const { admin, updates } = makeAdmin({ members: ["a"] });
    await notifyOrganizerParty(admin as never, {
      ...base,
      ref: { companyId: "co-1", organizerId: "a" },
      email: () => ({ subject: "s", react: null as never }),
    });
    expect(updates).toHaveLength(1);
    expect(
      (updates[0] as { payload: { payload_jsonb: { email_delivery: string } } })
        .payload.payload_jsonb.email_delivery,
    ).toBe("sent");
  });

  it("skips the email for a recipient with no address but still notifies in-app", async () => {
    resolveRecipientEmailAndLocale.mockImplementation(
      async (_a: unknown, id: string) => ({
        email: id === "no-email" ? null : `${id}@test.local`,
        locale: "en",
      }),
    );
    const { admin } = makeAdmin({ members: ["no-email", "ok"] });
    const res = await notifyOrganizerParty(admin as never, {
      ...base,
      ref: { companyId: "co-1", organizerId: "ok" },
      email: () => ({ subject: "s", react: null as never }),
    });
    expect(res.inAppWritten).toBe(2);
    expect(res.emailsSent).toBe(1);
  });

  it("keeps notifying the rest when one recipient throws", async () => {
    createNotification
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValue({ ok: true, id: "n2" });
    const { admin } = makeAdmin({ members: ["bad", "good"] });
    const res = await notifyOrganizerParty(admin as never, {
      ...base,
      ref: { companyId: "co-1", organizerId: "good" },
    });
    expect(res.recipients).toBe(2);
    expect(res.inAppWritten).toBe(1);
  });

  it("counts a failed email send as not delivered without throwing", async () => {
    sendEmail.mockResolvedValue({ ok: false, error: "smtp down" });
    const { admin } = makeAdmin({ members: ["a"] });
    const res = await notifyOrganizerParty(admin as never, {
      ...base,
      ref: { companyId: "co-1", organizerId: "a" },
      email: () => ({ subject: "s", react: null as never }),
    });
    expect(res.emailsSent).toBe(0);
    expect(res.inAppWritten).toBe(1);
  });

  it("notifies exactly one person for an individual organizer", async () => {
    const { admin } = makeAdmin({});
    const res = await notifyOrganizerParty(admin as never, {
      ...base,
      ref: { companyId: null, organizerId: "solo" },
      email: () => ({ subject: "s", react: null as never }),
    });
    expect(res.recipients).toBe(1);
    expect(res.emailsSent).toBe(1);
  });

  it("is a no-op when there is nobody to notify", async () => {
    const { admin } = makeAdmin({});
    const res = await notifyOrganizerParty(admin as never, {
      ...base,
      ref: { companyId: null, organizerId: null },
    });
    expect(res).toEqual({ recipients: 0, inAppWritten: 0, emailsSent: 0 });
    expect(createNotification).not.toHaveBeenCalled();
  });
});
