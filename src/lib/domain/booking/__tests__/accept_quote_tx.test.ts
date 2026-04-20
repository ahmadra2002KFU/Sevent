/**
 * Sprint 4 Lane 5 — accept_quote_tx integration tests.
 *
 * These run against the LIVE local Supabase stack (Postgres 15) via the
 * service-role key. Gate:
 *   - export INTEGRATION=1 to opt in.
 *   - Without INTEGRATION=1 the whole suite skips (describe.skipIf).
 *
 * The whole point of Lane 5 is to prove the soft-hold + RFQ state machine
 * under concurrency. Unit-level mocks would silently hide the plpgsql lock
 * ordering bugs — so we only assert behaviour we can observe against the
 * real DB.
 *
 * Run locally:
 *   pnpm db:start
 *   INTEGRATION=1 pnpm test src/lib/domain/booking/__tests__/accept_quote_tx.test.ts
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

// Each test mints fresh organizer + suppliers so they're fully isolated.
// No cleanup — dev DB is disposable; `pnpm db:reset` is the canonical reset.

describe.skipIf(!INTEGRATION_ENABLED)(
  "accept_quote_tx (integration)",
  () => {
    it("8 parallel accepts on the same RFQ → exactly one wins, others fail with rfq_not_bookable (or quote_not_sendable)", async () => {
      const admin = makeAdminClient();
      const suf = uniqueSuffix();

      // Organizer + event + RFQ + 8 sibling suppliers, each with a 'sent' quote.
      const organizer = await createAuthUser(admin, {
        email: `org-${suf}@sevent.test`,
        role: "organizer",
        fullName: `Org ${suf}`,
      });

      const cat = await ensureCategory(admin, "catering-plated");
      const event = await createEvent(admin, { organizer_id: organizer.id });
      const rfq = await createRfq(admin, {
        event_id: event.id,
        category_id: cat.parent_id,
        subcategory_id: cat.id,
      });

      const quotes: Array<{ quote_id: string; supplier_id: string }> = [];
      for (let i = 0; i < 8; i++) {
        const supUser = await createAuthUser(admin, {
          email: `sup-${suf}-${i}@sevent.test`,
          role: "supplier",
          fullName: `Supplier ${i}`,
        });
        const supplier = await createSupplierRow(admin, {
          profile_id: supUser.id,
          business_name: `Test Supplier ${suf}-${i}`,
        });
        const q = await seedSentQuote(admin, {
          rfq_id: rfq.id,
          supplier_id: supplier.id,
          supplier_profile_id: supUser.id,
          event_id: event.id,
          event_starts_at: event.starts_at,
          event_ends_at: event.ends_at,
        });
        quotes.push({ quote_id: q.quote_id, supplier_id: supplier.id });
      }

      // Fire 8 parallel accepts — each on a DIFFERENT quote but the SAME RFQ.
      // Expected: exactly one succeeds. The winning txn flips rfqs.status to
      // 'booked', so every other txn (which was waiting on SELECT … FOR
      // UPDATE on the rfqs row) wakes up to see a terminal RFQ and raises
      // P0010. A very unlucky timing could also yield P0004
      // (quote_not_sendable:rejected) if sibling's status was flipped
      // between steps 3 and 5, so we accept either.
      const clients = Array.from({ length: 8 }, () => makeAdminClient());
      const results = await Promise.allSettled(
        quotes.map((q, i) =>
          clients[i].rpc("accept_quote_tx", {
            p_quote_id: q.quote_id,
            p_organizer_id: organizer.id,
            p_soft_hold_minutes: 2880,
          }),
        ),
      );

      const outcomes = results.map((r) => {
        if (r.status === "fulfilled") {
          return classifyAcceptResult(r.value.data, r.value.error);
        }
        return classifyAcceptResult(null, r.reason);
      });
      const successes = outcomes.filter((o) => o.kind === "success");
      const failures = outcomes.filter((o) => o.kind === "error");

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(7);

      // Every failure should be a structured P-code that falls within the
      // documented set. We allow P0010 (terminal rfq) and P0004
      // (sibling flipped to rejected mid-flight) — anything else is a bug.
      for (const f of failures) {
        const code = codeOf(f);
        expect(
          code === "P0010" || code === "P0004" || code === "P0003",
          `unexpected failure code: ${code} (${f.kind === "error" ? f.message : ""})`,
        ).toBe(true);
      }

      // Side effects: exactly one booking for this RFQ, status 'awaiting_supplier'.
      const { data: bookingsData, error: bookingsErr } = await admin
        .from("bookings")
        .select("id, confirmation_status, awaiting_since, confirm_deadline, quote_id")
        .eq("rfq_id", rfq.id);
      expect(bookingsErr).toBeNull();
      expect(bookingsData ?? []).toHaveLength(1);
      const booking = (bookingsData ?? [])[0];
      expect(booking.confirmation_status).toBe("awaiting_supplier");
      expect(booking.awaiting_since).toBeTruthy();
      expect(booking.confirm_deadline).toBeTruthy();

      // ≈ now+48h. Accept a generous 5-minute skew window; the test is slow
      // enough that we can't pin exact timestamps.
      const deadline = new Date(booking.confirm_deadline as string).getTime();
      const now = Date.now();
      const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;
      expect(Math.abs(deadline - (now + FORTY_EIGHT_HOURS))).toBeLessThan(
        5 * 60 * 1000,
      );

      // Exactly one soft_hold on the winning supplier for this booking.
      const { data: blocksData } = await admin
        .from("availability_blocks")
        .select("id, reason, booking_id, expires_at")
        .eq("booking_id", booking.id);
      expect(blocksData ?? []).toHaveLength(1);
      expect((blocksData ?? [])[0].reason).toBe("soft_hold");

      // Accepted quote has status 'accepted' + accepted_at.
      const { data: acceptedQuote } = await admin
        .from("quotes")
        .select("id, status, accepted_at")
        .eq("id", booking.quote_id as string)
        .single();
      expect(acceptedQuote?.status).toBe("accepted");
      expect(acceptedQuote?.accepted_at).toBeTruthy();

      // All 7 siblings are 'rejected' with rejected_at set.
      const { data: siblingQuotes } = await admin
        .from("quotes")
        .select("id, status, rejected_at")
        .eq("rfq_id", rfq.id)
        .neq("id", booking.quote_id as string);
      expect(siblingQuotes ?? []).toHaveLength(7);
      for (const sq of siblingQuotes ?? []) {
        expect(sq.status).toBe("rejected");
        expect(sq.rejected_at).toBeTruthy();
      }

      // RFQ flipped to booked.
      const { data: rfqRow } = await admin
        .from("rfqs")
        .select("status")
        .eq("id", rfq.id)
        .single();
      expect(rfqRow?.status).toBe("booked");
    }, 60_000);

    it("same quote accepted twice in parallel → one success, one P0003 quote_already_accepted", async () => {
      const admin = makeAdminClient();
      const suf = uniqueSuffix();

      const organizer = await createAuthUser(admin, {
        email: `org-${suf}@sevent.test`,
        role: "organizer",
        fullName: `Org ${suf}`,
      });
      const cat = await ensureCategory(admin, "catering-plated");
      const event = await createEvent(admin, { organizer_id: organizer.id });
      const rfq = await createRfq(admin, {
        event_id: event.id,
        category_id: cat.parent_id,
        subcategory_id: cat.id,
      });
      const supUser = await createAuthUser(admin, {
        email: `sup-${suf}@sevent.test`,
        role: "supplier",
        fullName: `Supplier ${suf}`,
      });
      const supplier = await createSupplierRow(admin, {
        profile_id: supUser.id,
        business_name: `Test Supplier ${suf}`,
      });
      const q = await seedSentQuote(admin, {
        rfq_id: rfq.id,
        supplier_id: supplier.id,
        supplier_profile_id: supUser.id,
        event_id: event.id,
        event_starts_at: event.starts_at,
        event_ends_at: event.ends_at,
      });

      const clientA = makeAdminClient();
      const clientB = makeAdminClient();
      const [resA, resB] = await Promise.allSettled([
        clientA.rpc("accept_quote_tx", {
          p_quote_id: q.quote_id,
          p_organizer_id: organizer.id,
          p_soft_hold_minutes: 2880,
        }),
        clientB.rpc("accept_quote_tx", {
          p_quote_id: q.quote_id,
          p_organizer_id: organizer.id,
          p_soft_hold_minutes: 2880,
        }),
      ]);

      const outcomes = [resA, resB].map((r) =>
        r.status === "fulfilled"
          ? classifyAcceptResult(r.value.data, r.value.error)
          : classifyAcceptResult(null, r.reason),
      );
      const successes = outcomes.filter((o) => o.kind === "success");
      const failures = outcomes.filter((o) => o.kind === "error");

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      // Once the first txn flips the quote to accepted, the second sees
      // status='accepted' in step 5 and raises P0003. A belt-and-braces
      // fallback: P0010 (rfq became 'booked') is equally valid under heavy
      // load — both outcomes prove the invariant "no double-accept".
      const code = codeOf(failures[0]);
      expect(code === "P0003" || code === "P0010").toBe(true);

      // Exactly one booking.
      const { data: bookings } = await admin
        .from("bookings")
        .select("id")
        .eq("quote_id", q.quote_id);
      expect(bookings ?? []).toHaveLength(1);
    }, 30_000);

    it("RFQ already terminal (status='expired') → P0010 rfq_not_bookable:expired", async () => {
      const admin = makeAdminClient();
      const suf = uniqueSuffix();

      const organizer = await createAuthUser(admin, {
        email: `org-${suf}@sevent.test`,
        role: "organizer",
        fullName: `Org ${suf}`,
      });
      const cat = await ensureCategory(admin, "catering-plated");
      const event = await createEvent(admin, { organizer_id: organizer.id });
      const rfq = await createRfq(admin, {
        event_id: event.id,
        category_id: cat.parent_id,
        subcategory_id: cat.id,
      });
      const supUser = await createAuthUser(admin, {
        email: `sup-${suf}@sevent.test`,
        role: "supplier",
        fullName: `Supplier ${suf}`,
      });
      const supplier = await createSupplierRow(admin, {
        profile_id: supUser.id,
        business_name: `Test Supplier ${suf}`,
      });
      const q = await seedSentQuote(admin, {
        rfq_id: rfq.id,
        supplier_id: supplier.id,
        supplier_profile_id: supUser.id,
        event_id: event.id,
        event_starts_at: event.starts_at,
        event_ends_at: event.ends_at,
      });

      // Flip RFQ to a terminal status BEFORE accepting.
      const { error: flipErr } = await admin
        .from("rfqs")
        .update({ status: "expired" })
        .eq("id", rfq.id);
      expect(flipErr).toBeNull();

      const { data, error } = await admin.rpc("accept_quote_tx", {
        p_quote_id: q.quote_id,
        p_organizer_id: organizer.id,
        p_soft_hold_minutes: 2880,
      });
      const outcome = classifyAcceptResult(data, error);
      expect(outcome.kind).toBe("error");
      expect(codeOf(outcome)).toBe("P0010");
      if (outcome.kind === "error") {
        expect(outcome.message).toContain("expired");
      }

      // No booking row created.
      const { data: bookings } = await admin
        .from("bookings")
        .select("id")
        .eq("rfq_id", rfq.id);
      expect(bookings ?? []).toHaveLength(0);
    }, 20_000);

    it("organizer mismatch → P0006", async () => {
      const admin = makeAdminClient();
      const suf = uniqueSuffix();

      const ownerOrg = await createAuthUser(admin, {
        email: `org-owner-${suf}@sevent.test`,
        role: "organizer",
        fullName: `Owner ${suf}`,
      });
      const otherOrg = await createAuthUser(admin, {
        email: `org-other-${suf}@sevent.test`,
        role: "organizer",
        fullName: `Other ${suf}`,
      });
      const cat = await ensureCategory(admin, "catering-plated");
      const event = await createEvent(admin, { organizer_id: ownerOrg.id });
      const rfq = await createRfq(admin, {
        event_id: event.id,
        category_id: cat.parent_id,
        subcategory_id: cat.id,
      });
      const supUser = await createAuthUser(admin, {
        email: `sup-${suf}@sevent.test`,
        role: "supplier",
        fullName: `Supplier ${suf}`,
      });
      const supplier = await createSupplierRow(admin, {
        profile_id: supUser.id,
        business_name: `Test Supplier ${suf}`,
      });
      const q = await seedSentQuote(admin, {
        rfq_id: rfq.id,
        supplier_id: supplier.id,
        supplier_profile_id: supUser.id,
        event_id: event.id,
        event_starts_at: event.starts_at,
        event_ends_at: event.ends_at,
      });

      // Call with the WRONG organizer — should raise P0006.
      const { data, error } = await admin.rpc("accept_quote_tx", {
        p_quote_id: q.quote_id,
        p_organizer_id: otherOrg.id,
        p_soft_hold_minutes: 2880,
      });
      const outcome = classifyAcceptResult(data, error);
      expect(outcome.kind).toBe("error");
      expect(codeOf(outcome)).toBe("P0006");
    }, 20_000);

    it.each([0, -10, 20161])(
      "invalid soft_hold_minutes=%d → P0012",
      async (bad) => {
        const admin = makeAdminClient();
        const suf = uniqueSuffix();

        const organizer = await createAuthUser(admin, {
          email: `org-${suf}-${bad < 0 ? "neg" : bad}@sevent.test`,
          role: "organizer",
          fullName: `Org ${suf}`,
        });
        const cat = await ensureCategory(admin, "catering-plated");
        const event = await createEvent(admin, { organizer_id: organizer.id });
        const rfq = await createRfq(admin, {
          event_id: event.id,
          category_id: cat.parent_id,
          subcategory_id: cat.id,
        });
        const supUser = await createAuthUser(admin, {
          email: `sup-${suf}-${bad < 0 ? "neg" : bad}@sevent.test`,
          role: "supplier",
          fullName: `Supplier ${suf}`,
        });
        const supplier = await createSupplierRow(admin, {
          profile_id: supUser.id,
          business_name: `Test Supplier ${suf}`,
        });
        const q = await seedSentQuote(admin, {
          rfq_id: rfq.id,
          supplier_id: supplier.id,
          supplier_profile_id: supUser.id,
          event_id: event.id,
          event_starts_at: event.starts_at,
          event_ends_at: event.ends_at,
        });

        const { data, error } = await admin.rpc("accept_quote_tx", {
          p_quote_id: q.quote_id,
          p_organizer_id: organizer.id,
          p_soft_hold_minutes: bad,
        });
        const outcome = classifyAcceptResult(data, error);
        expect(outcome.kind).toBe("error");
        expect(codeOf(outcome)).toBe("P0012");
      },
      20_000,
    );
  },
);
