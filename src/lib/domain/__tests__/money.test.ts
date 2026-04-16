import { describe, expect, it } from "vitest";
import { sarToHalalas } from "@/lib/domain/money";

describe("sarToHalalas", () => {
  it("converts a SAR string to integer halalas", () => {
    expect(sarToHalalas("10.50")).toBe(1050);
  });
});
