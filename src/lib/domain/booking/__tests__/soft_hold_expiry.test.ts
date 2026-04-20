/**
 * Sprint 4 Lane 5 — soft-hold expiry + manual_block blocking behaviour.
 *
 * Proves two opposing halves of the overlap trigger:
 *   1. An *expired* soft_hold is ignored — the supplier can accept a quote for
 *      a different (overlapping) event because the trigger filters
 *      `(reason <> 'soft_hold' or expires_at > now())`.
 *   2. A manual_block is NEVER ignored — it has no expires_at and blocks any
 *      accept whose event window overlaps, producing P0007 supplier_unavailable.
 *
 * Because sleeping for real expiry is flaky (minimum valid hold is 1 minute)
 * we backdate the soft_hold's expires_at + the booking's confirm_deadline via
 * service-role UPDATE. That exercises the same trigger branch the pg_cron
 * expiry task will hit in prod.
 *
 * Run locally:
 *   pnpm db:start
 *   INTEGRATION=1 pnpm test src/lib/domain/booking/__tests__/soft_hold_expiry.test.ts
 */
import { describe, expect, it } from "vitest";
import {
  classifyAcceptResult,
  codeOf,
  createAuthUser,
  createEvent,
  createRfq,
  createSupplierRow,
  ensureCategory,
  INTEGRATION_ENABLED,
  makeAdminClient,
  seedSentQuote,
  uniqueSuffix,
} from "./_integration-helpers";

describe.skipIf(!INTEGRATION_ENABLED)(
  "soft-hold expiry + manual_block (integration)",
  () => {
    it("expired soft_hold is ignored — same supplier can be re-accepted on a different overlapping event", async () => {
      const admin = makeAdminClient();
      const suf = uniqueSuffix();

      const organizer = await createAuthUser(admin, {
        email: `org-${suf}@sevent.test`,
        role: "organizer",
        fullName: `Org ${suf}`,
      });
      const supUser = await createAuthUser(admin, {
        email: `sup-${suf}@sevent.test`,
        role: "supplier",
        fullName: `Sup ${suf}`,
      });
      const supplier = await createSupplierRow(admin, {
        profile_id: supUser.id,
        business_name: `Test Supplier ${suf}`,
      });
      const cat = await ensureCategory(admin, "catering-plated");

      // --- Event A — organizer accepts quote-A with a 1-minute soft hold. ---
      const eventA = await createEvent(admin, {
        organizer_id: organizer.id,
      });
      const rfqA = await createRfq(admin, {
        event_id: eventA.id,
        category_id: cat.parent_id,
        subcategory_id: cat.id,
      });
      const quoteA = await seedSentQuote(admin, {
        rfq_id: rfqA.id,
        supplier_id: supplier.id,
        supplier_profile_id: supUser.id,
        event_id: eventA.id,
        event_starts_at: eventA.starts_at,
        event_ends_at: eventA.ends_at,
      });

      const { data: acceptDataA, error: acceptErrA } = await admin.rpc(
        "accept_quote_tx",
        {
          p_quote_id: quoteA.quote_id,
          p_organizer_id: organizer.id,
          p_soft_hold_minutes: 1, // minimum valid — we'll backdate below.
        },
      );
      const outA = classifyAcceptResult(acceptDataA, acceptErrA);
      expect(outA.kind).toBe("success");
      if (outA.kind !== "success") return;

      // --- Backdate the hold + confirm_deadline so the trigger treats it as expired. ---
      const pastIso = new Date(Date.now() - 60 * 1000).toISOString();
      const { error: expireBlockErr } = await admin
        .from("availability_blocks")
        .update({ expires_at: pastIso })
        .eq("id", outA.row.block_id);
      expect(expireBlockErr).toBeNull();

      const { error: expireBookingErr } = await admin
        .from("bookings")
        .update({ confirm_deadline: pastIso })
        .eq("id", outA.row.booking_id);
      expect(expireBookingErr).toBeNull();

      // --- Event B — same supplier, different event that OVERLAPS event A. ---
      //
      // We make event B's window intersect event A's window to prove the
      // overlap check itself would have fired if the hold were still live.
      const overlapStart = new Date(eventA.starts_at);
      // Start 1 hour after eventA.starts — still inside the 4-hour window.
      overlapStart.setUTCHours(overlapStart.getUTCHours() + 1);
      const overlapEnd = new Date(eventA.ends_at);
      overlapEnd.setUTCHours(overlapEnd.getUTCHours() + 1);

      const eventB = await createEvent(admin, {
        organizer_id: organizer.id,
        starts_at: overlapStart.toISOString(),
        ends_at: overlapEnd.toISOString(),
      });
      const rfqB = await createRfq(admin, {
        event_id: eventB.id,
        category_id: cat.parent_id,
        subcategory_id: cat.id,
      });
      const quoteB = await seedSentQuote(admin, {
        rfq_id: rfqB.id,
        supplier_id: supplier.id,
        supplier_profile_id: supUser.id,
        event_id: eventB.id,
        event_starts_at: eventB.starts_at,
        event_ends_at: eventB.ends_at,
      });

      const { data: acceptDataB, error: acceptErrB } = await admin.rpc(
        "accept_quote_tx",
        {
          p_quote_id: quoteB.quote_id,
          p_organizer_id: organizer.id,
          p_soft_hold_minutes: 2880,
        },
      );
      const outB = classifyAcceptResult(acceptDataB, acceptErrB);
      expect(
        outB.kind,
        `expected success after backdating hold; got ${JSON.stringify(outB)}`,
      ).toBe("success");
    }, 45_000);

    it("a manual_block always wins — accept_quote_tx returns P0007 when event window overlaps", async () => {
      const admin = makeAdminClient();
      const suf = uniqueSuffix();

      const organizer = await createAuthUser(admin, {
        email: `org-${suf}@sevent.test`,
        role: "organizer",
        fullName: `Org ${suf}`,
      });
      const supUser = await createAuthUser(admin, {
        email: `sup-${suf}@sevent.test`,
        role: "supplier",
        fullName: `Sup ${suf}`,
      });
      const supplier = await createSupplierRow(admin, {
        profile_id: supUser.id,
        business_name: `Test Supplier ${suf}`,
      });
      const cat = await ensureCategory(admin, "catering-plated");

      const event = await createEvent(admin, { organizer_id: organizer.id });
      const rfq = await createRfq(admin, {
        event_id: event.id,
        category_id: cat.parent_id,
        subcategory_id: cat.id,
      });
      const quote = await seedSentQuote(admin, {
        rfq_id: rfq.id,
        supplier_id: supplier.id,
        supplier_profile_id: supUser.id,
        event_id: event.id,
        event_starts_at: event.starts_at,
        event_ends_at: event.ends_at,
      });

      // Insert a manual_block that covers the event window. manual_block has
      // no expires_at so the trigger's `(reason <> 'soft_hold' or expires_at
      // > now())` branch always keeps it in scope.
      const blockStart = new Date(event.starts_at);
      blockStart.setUTCHours(blockStart.getUTCHours() - 1);
      const blockEnd = new Date(event.ends_at);
      blockEnd.setUTCHours(blockEnd.getUTCHours() + 1);

      const { error: blockErr } = await admin
        .from("availability_blocks")
        .insert({
          supplier_id: supplier.id,
          starts_at: blockStart.toISOString(),
          ends_at: blockEnd.toISOString(),
          reason: "manual_block",
          created_by: supUser.id,
        });
      expect(blockErr).toBeNull();

      const { data, error } = await admin.rpc("accept_quote_tx", {
        p_quote_id: quote.quote_id,
        p_organizer_id: organizer.id,
        p_soft_hold_minutes: 2880,
      });
      const outcome = classifyAcceptResult(data, error);
      expect(outcome.kind).toBe("error");
      expect(codeOf(outcome)).toBe("P0007");
      if (outcome.kind === "error") {
        expect(outcome.message).toContain("supplier_unavailable");
      }

      // Booking row must NOT exist — accept_quote_tx rolled back.
      const { data: bookings } = await admin
        .from("bookings")
        .select("id")
        .eq("quote_id", quote.quote_id);
      expect(bookings ?? []).toHaveLength(0);
    }, 30_000);
  },
);
