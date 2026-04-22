import { describe, expect, it } from "vitest";
import { deriveChecklistStates } from "../verificationDisplay";

describe("deriveChecklistStates", () => {
  it("marks every row done when the supplier is approved", () => {
    const rows = deriveChecklistStates("approved");
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.state)).toEqual([
      "done",
      "done",
      "done",
      "done",
      "done",
    ]);
    expect(rows.map((r) => r.key)).toEqual([
      "wathq",
      "identity",
      "iban",
      "portfolio",
      "badge",
    ]);
  });

  it("marks every row failed when the supplier is rejected", () => {
    const rows = deriveChecklistStates("rejected");
    expect(rows.map((r) => r.state)).toEqual([
      "failed",
      "failed",
      "failed",
      "failed",
      "failed",
    ]);
  });

  it("produces the aspirational mix when the supplier is pending", () => {
    const rows = deriveChecklistStates("pending");
    expect(rows).toEqual([
      { key: "wathq", state: "done" },
      { key: "identity", state: "done" },
      { key: "iban", state: "running" },
      { key: "portfolio", state: "waiting" },
      { key: "badge", state: "waiting" },
    ]);
  });
});
