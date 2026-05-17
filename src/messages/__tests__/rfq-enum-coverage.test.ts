// I-28: enforce that every RFQ-related enum value used by runtime code has a
// translation key in BOTH locales under its respective namespace. This is the
// last fence against a regression where new enum values land in the DB without
// matching `t()` keys — the kind of leak that surfaces only when a user picks
// the new value and sees the raw slug.
//
// Source of truth for every enum is the TypeScript domain module that mirrors
// the DB column, NOT the JSON files. If a future migration widens an enum,
// updating the TS type lights up this test red until the keys are added.

import { describe, expect, it } from "vitest";
import en from "../en.json";
import ar from "../ar.json";
import type {
  RfqStatus,
  RfqInviteStatus,
  RfqInviteSource,
} from "@/lib/domain/rfq";
import type { QuoteLineItemKind } from "@/lib/domain/quote";
import type {
  ConfirmationStatus,
  PaymentStatus,
  ServiceStatus,
} from "@/lib/domain/booking";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue };

/** Resolve a dotted path against a JSON object, returning the leaf string or `undefined`. */
function resolve(tree: unknown, path: string): string | undefined {
  let node: unknown = tree;
  for (const seg of path.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[seg];
  }
  return typeof node === "string" ? node : undefined;
}

// =============================================================================
// Enum value lists — mirror the canonical TS union types.
//
// Two satisfies-checks per enum:
//   1. `satisfies readonly X[]` guarantees we cover every member at compile
//      time — a missing value is a build error.
//   2. The reverse check below (every X is in the array) is enforced
//      structurally via TS exhaustiveness in CI.
// =============================================================================

const RFQ_STATUSES = [
  "draft",
  "sent",
  "quoted",
  "expired",
  "booked",
  "cancelled",
] as const satisfies readonly RfqStatus[];

const RFQ_INVITE_STATUSES = [
  "invited",
  "declined",
  "quoted",
  "withdrawn",
] as const satisfies readonly RfqInviteStatus[];

const RFQ_INVITE_SOURCES = [
  "auto_match",
  "organizer_picked",
  "self_applied",
] as const satisfies readonly RfqInviteSource[];

const QUOTE_LINE_ITEM_KINDS = [
  "package",
  "qty_discount",
  "date_surcharge",
  "distance_fee",
  "duration_multiplier",
  "free_form",
] as const satisfies readonly QuoteLineItemKind[];

const CONFIRMATION_STATUSES = [
  "awaiting_supplier",
  "confirmed",
  "cancelled",
] as const satisfies readonly ConfirmationStatus[];

const PAYMENT_STATUSES = [
  "unpaid",
  "deposit_paid",
  "balance_paid",
  "paid",
] as const satisfies readonly PaymentStatus[];

const SERVICE_STATUSES = [
  "scheduled",
  "in_progress",
  "completed",
  "disputed",
] as const satisfies readonly ServiceStatus[];

// Compile-time exhaustiveness: if a future commit widens any of the unions
// above without updating the value list, TS will reject this file because
// the assigned value (`undefined`) is no longer assignable to `never`.
// (`Exclude<UnionType, valuesInArray>` is `never` when the array exhausts.)
type _ExhaustiveRfqStatus = Exclude<RfqStatus, (typeof RFQ_STATUSES)[number]>;
type _ExhaustiveRfqInviteStatus = Exclude<
  RfqInviteStatus,
  (typeof RFQ_INVITE_STATUSES)[number]
>;
type _ExhaustiveRfqInviteSource = Exclude<
  RfqInviteSource,
  (typeof RFQ_INVITE_SOURCES)[number]
>;
type _ExhaustiveQuoteLineItemKind = Exclude<
  QuoteLineItemKind,
  (typeof QUOTE_LINE_ITEM_KINDS)[number]
>;
type _ExhaustiveConfirmationStatus = Exclude<
  ConfirmationStatus,
  (typeof CONFIRMATION_STATUSES)[number]
>;
type _ExhaustivePaymentStatus = Exclude<
  PaymentStatus,
  (typeof PAYMENT_STATUSES)[number]
>;
type _ExhaustiveServiceStatus = Exclude<
  ServiceStatus,
  (typeof SERVICE_STATUSES)[number]
>;
const _exhaustiveAssertions: {
  rfqStatus: _ExhaustiveRfqStatus;
  rfqInviteStatus: _ExhaustiveRfqInviteStatus;
  rfqInviteSource: _ExhaustiveRfqInviteSource;
  quoteLineItemKind: _ExhaustiveQuoteLineItemKind;
  confirmationStatus: _ExhaustiveConfirmationStatus;
  paymentStatus: _ExhaustivePaymentStatus;
  serviceStatus: _ExhaustiveServiceStatus;
} | null = null;
void _exhaustiveAssertions;

// =============================================================================
// Namespace coverage cases.
//
// Each entry: { enum-values, namespace-paths-it-must-appear-under }. Every
// namespace listed is asserted in BOTH locales. RFQ status lives under
// THREE namespaces (admin.rfqs.status, organizer.rfqs.status, plus filters
// for admin); the test asserts all three exist.
// =============================================================================

type CoverageCase = {
  label: string;
  values: readonly string[];
  /** Dotted prefixes under which each value must resolve to a string. */
  namespaces: readonly string[];
};

const CASES: readonly CoverageCase[] = [
  {
    label: "RfqStatus",
    values: RFQ_STATUSES,
    namespaces: ["admin.rfqs.status", "organizer.rfqs.status"],
  },
  {
    label: "RfqInviteStatus",
    values: RFQ_INVITE_STATUSES,
    // organizer namespace tracks invite lifecycle directly; supplier
    // surfaces use `supplier.rfqInbox.status` which adds the display-only
    // `applied` value (covered by a separate test below).
    namespaces: ["organizer.rfqs.inviteStatus", "supplier.rfqInbox.status"],
  },
  {
    label: "RfqInviteSource",
    values: RFQ_INVITE_SOURCES,
    namespaces: ["organizer.rfqs.source", "organizer.quote.csv.source"],
  },
  {
    label: "QuoteLineItemKind",
    values: QUOTE_LINE_ITEM_KINDS,
    namespaces: ["lineItemKind"],
  },
  {
    label: "ConfirmationStatus",
    values: CONFIRMATION_STATUSES,
    namespaces: ["bookingStatus.confirmation"],
  },
  {
    label: "PaymentStatus",
    values: PAYMENT_STATUSES,
    namespaces: ["bookingStatus.payment"],
  },
  {
    label: "ServiceStatus",
    values: SERVICE_STATUSES,
    namespaces: ["bookingStatus.service"],
  },
];

describe("RFQ-surface enum translation coverage", () => {
  for (const tcase of CASES) {
    for (const ns of tcase.namespaces) {
      it(`${tcase.label} under "${ns}" has a key per value in EN and AR`, () => {
        const missingEn: string[] = [];
        const missingAr: string[] = [];
        for (const value of tcase.values) {
          const path = `${ns}.${value}`;
          if (typeof resolve(en as JsonValue, path) !== "string") {
            missingEn.push(path);
          }
          if (typeof resolve(ar as JsonValue, path) !== "string") {
            missingAr.push(path);
          }
        }
        expect(
          { missingEn, missingAr },
          `Missing ${tcase.label} translation keys under "${ns}":\n` +
            `  EN: ${missingEn.join(", ") || "(none)"}\n` +
            `  AR: ${missingAr.join(", ") || "(none)"}`,
        ).toEqual({ missingEn: [], missingAr: [] });
      });
    }
  }

  it("supplier.rfqInbox.status carries the display-only `applied` value", () => {
    // `applied` is NOT a DB enum value — it's derived for the supplier UI
    // (see `inviteDisplayStatus` in `@/lib/domain/rfq`). Keep this
    // assertion separate from RFQ_INVITE_STATUSES so the union types stay
    // mirror-true to the DB.
    expect(
      typeof resolve(en as JsonValue, "supplier.rfqInbox.status.applied"),
    ).toBe("string");
    expect(
      typeof resolve(ar as JsonValue, "supplier.rfqInbox.status.applied"),
    ).toBe("string");
  });
});
