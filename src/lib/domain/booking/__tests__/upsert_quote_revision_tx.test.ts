/**
 * Sprint 4 Lane 5 — upsert_quote_revision_tx integration tests.
 *
 * Proves the append-only revision semantics + the FOR-UPDATE serialisation
 * that lets us drop the retry loop the Sprint 4 plan originally carried:
 *
 *   - Consecutive calls for the same (rfq, supplier) return version 1, 2, 3, …
 *   - current_revision_id always points at the latest revision.
 *   - A quote that's already in a terminal status (accepted/rejected/…)
 *     cannot be re-opened — P0011 quote_revision_not_editable:<status>.
 *   - 5 parallel upserts for the same (rfq, supplier) ALL succeed, with
 *     contiguous versions 1..5 (no gaps, no duplicates). This is the
 *     concurrency-correctness claim in the plan.
 *
 * Run locally:
 *   pnpm db:start
 *   INTEGRATION=1 pnpm test src/lib/domain/booking/__tests__/upsert_quote_revision_tx.test.ts
 */
import { describe, expect, it } from "vitest";
import {
  createAuthUser,
  createEvent,
  createRfq,
  createSupplierRow,
  ensureCategory,
  INTEGRATION_ENABLED,
  makeAdminClient,
  makeMinimalSnapshot,
  uniqueSuffix,
} from "./_integration-helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

type UpsertSuccess = { quote_id: string; revision_id: string; version: number };

/** Thin wrapper around the RPC call so each test stays readable. */
async function callUpsert(
  client: SupabaseClient,
  params: {
    rfq_id: string;
    supplier_id: string;
    author_id: string;
    event_id: string;
    event_starts_at: string;
    event_ends_at: string;
    notes?: string; // forces a different content_hash per call
  },
): Promise<
  | { kind: "success"; row: UpsertSuccess }
  | { kind: "error"; code: string | null; message: string }
> {
  const { snapshot, content_hash } = makeMinimalSnapshot({
    event_id: params.event_id,
    event_starts_at: params.event_starts_at,
    event_ends_at: params.event_ends_at,
  });
  // Attach a unique `notes` field via a modified snapshot so each revision's
  // content_hash differs. (The RPC stores content_hash verbatim.)
  const uniqueSnapshot = { ...snapshot, notes: params.notes ?? null };

  const { data, error } = await client.rpc("upsert_quote_revision_tx", {
    p_rfq_id: params.rfq_id,
    p_supplier_id: params.supplier_id,
    p_author_id: params.author_id,
    p_snapshot: uniqueSnapshot,
    p_content_hash: content_hash,
    p_source: "free_form",
  });

  if (error) {
    const err = error as { code?: string; message?: string };
    let code = err.code ?? null;
    if (!code && typeof err.message === "string") {
      const m = err.message.match(/P\d{4}/);
      if (m) code = m[0];
    }
    return { kind: "error", code, message: err.message ?? String(error) };
  }
  if (Array.isArray(data) && data.length === 1) {
    const r = data[0] as UpsertSuccess;
    return { kind: "success", row: r };
  }
  return {
    kind: "error",
    code: null,
    message: `unexpected RPC shape: ${JSON.stringify(data)}`,
  };
}

describe.skipIf(!INTEGRATION_ENABLED)(
  "upsert_quote_revision_tx (integration)",
  () => {
    it("sequential calls for same (rfq, supplier) increment version and flip current_revision_id", async () => {
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

      const r1 = await callUpsert(admin, {
        rfq_id: rfq.id,
        supplier_id: supplier.id,
        author_id: supUser.id,
        event_id: event.id,
        event_starts_at: event.starts_at,
        event_ends_at: event.ends_at,
        notes: "rev1",
      });
      expect(r1.kind).toBe("success");
      if (r1.kind !== "success") return;
      expect(r1.row.version).toBe(1);

      const r2 = await callUpsert(admin, {
        rfq_id: rfq.id,
        supplier_id: supplier.id,
        author_id: supUser.id,
        event_id: event.id,
        event_starts_at: event.starts_at,
        event_ends_at: event.ends_at,
        notes: "rev2",
      });
      expect(r2.kind).toBe("success");
      if (r2.kind !== "success") return;
      expect(r2.row.version).toBe(2);
      expect(r2.row.quote_id).toBe(r1.row.quote_id);

      // current_revision_id points at v2.
      const { data: quote } = await admin
        .from("quotes")
        .select("id, current_revision_id, status")
        .eq("id", r1.row.quote_id)
        .single();
      expect(quote?.current_revision_id).toBe(r2.row.revision_id);
      expect(quote?.status).toBe("sent");
    }, 20_000);

    it("a quote manually flipped to 'accepted' cannot be further revised → P0011", async () => {
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

      const r1 = await callUpsert(admin, {
        rfq_id: rfq.id,
        supplier_id: supplier.id,
        author_id: supUser.id,
        event_id: event.id,
        event_starts_at: event.starts_at,
        event_ends_at: event.ends_at,
      });
      expect(r1.kind).toBe("success");
      if (r1.kind !== "success") return;

      // Force-flip the quote to 'accepted'. In real flow this happens via
      // accept_quote_tx; we short-circuit with a direct service-role update
      // so the test doesn't need to seed the rest of that pipeline.
      const { error: flipErr } = await admin
        .from("quotes")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("id", r1.row.quote_id);
      expect(flipErr).toBeNull();

      const r2 = await callUpsert(admin, {
        rfq_id: rfq.id,
        supplier_id: supplier.id,
        author_id: supUser.id,
        event_id: event.id,
        event_starts_at: event.starts_at,
        event_ends_at: event.ends_at,
        notes: "should-be-rejected",
      });
      expect(r2.kind).toBe("error");
      if (r2.kind !== "error") return;
      expect(r2.code).toBe("P0011");
      expect(r2.message).toContain("accepted");
    }, 20_000);

    it("5 parallel upserts for same (rfq, supplier) all succeed with contiguous versions 1..5", async () => {
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

      // Independent clients so each call gets its own HTTP connection — more
      // faithfully models a concurrent retry-race from the supplier quote UI.
      const clients = Array.from({ length: 5 }, () => makeAdminClient());
      const results = await Promise.allSettled(
        clients.map((c, i) =>
          callUpsert(c, {
            rfq_id: rfq.id,
            supplier_id: supplier.id,
            author_id: supUser.id,
            event_id: event.id,
            event_starts_at: event.starts_at,
            event_ends_at: event.ends_at,
            notes: `parallel-${i}`,
          }),
        ),
      );

      const outcomes = results.map((r) =>
        r.status === "fulfilled"
          ? r.value
          : {
              kind: "error" as const,
              code: null,
              message: String(r.reason),
            },
      );
      const successes = outcomes.filter((o) => o.kind === "success");
      const failures = outcomes.filter((o) => o.kind === "error");

      expect(
        failures,
        `expected 0 failures, got: ${JSON.stringify(failures)}`,
      ).toHaveLength(0);
      expect(successes).toHaveLength(5);

      // Versions: 1..5 exactly, no duplicates, no gaps. All share quote_id.
      const versions = successes
        .filter((o): o is { kind: "success"; row: UpsertSuccess } => o.kind === "success")
        .map((o) => o.row.version)
        .sort((a, b) => a - b);
      expect(versions).toEqual([1, 2, 3, 4, 5]);

      const quoteIds = new Set(
        successes
          .filter((o): o is { kind: "success"; row: UpsertSuccess } => o.kind === "success")
          .map((o) => o.row.quote_id),
      );
      expect(quoteIds.size).toBe(1);

      // DB side: quote_revisions has 5 rows; current_revision_id points at v5.
      const [onlyQuoteId] = Array.from(quoteIds);
      const { data: revisions } = await admin
        .from("quote_revisions")
        .select("id, version")
        .eq("quote_id", onlyQuoteId)
        .order("version", { ascending: true });
      expect((revisions ?? []).map((r) => r.version)).toEqual([1, 2, 3, 4, 5]);

      const { data: quote } = await admin
        .from("quotes")
        .select("current_revision_id, status")
        .eq("id", onlyQuoteId)
        .single();
      const v5 = (revisions ?? []).find((r) => r.version === 5);
      expect(quote?.current_revision_id).toBe(v5?.id);
      expect(quote?.status).toBe("sent");
    }, 45_000);
  },
);
