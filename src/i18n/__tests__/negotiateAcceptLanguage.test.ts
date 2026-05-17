// I-27 regression test: best-match negotiation across Accept-Language vs the
// supported locale set {en, ar}. The old implementation just split on `,`
// and took the first token, so `fr,ar;q=0.9` fell back to English instead
// of Arabic. The new negotiator parses q-weights and picks the highest-q
// supported match, with first-entry-wins for ties (RFC 9110 §12.5.4).

import { describe, expect, it } from "vitest";
import { negotiateAcceptLanguage as negotiate } from "../negotiateAcceptLanguage";

const SUPPORTED = ["en", "ar"] as const;

describe("negotiateAcceptLanguage (I-27)", () => {
  it("returns null on an empty header", () => {
    expect(negotiate("", SUPPORTED)).toBeNull();
  });

  it("picks the first supported locale when q-weights are absent", () => {
    expect(negotiate("ar", SUPPORTED)).toBe("ar");
    expect(negotiate("en", SUPPORTED)).toBe("en");
  });

  it("normalizes language-region tags to the base language", () => {
    expect(negotiate("ar-SA", SUPPORTED)).toBe("ar");
    expect(negotiate("en-GB,en-US;q=0.8", SUPPORTED)).toBe("en");
  });

  it("falls back to a later supported entry when the first is unsupported", () => {
    // The pre-Stage-4 bug: this returned null/`en` even though `ar` is
    // listed as the second preference.
    expect(negotiate("fr,ar;q=0.9", SUPPORTED)).toBe("ar");
    expect(negotiate("de,ar", SUPPORTED)).toBe("ar");
  });

  it("picks the entry with the highest q-weight, not the first", () => {
    // `ar` ranks higher than `en` here, so it should win even though `en`
    // appears first.
    expect(negotiate("en;q=0.5,ar;q=0.9", SUPPORTED)).toBe("ar");
  });

  it("breaks ties on q by preferring the earlier entry (RFC 9110 §12.5.4)", () => {
    // Equal q (default 1.0); `en` is listed first → `en` wins.
    expect(negotiate("en,ar", SUPPORTED)).toBe("en");
    expect(negotiate("ar,en", SUPPORTED)).toBe("ar");
  });

  it("treats q=0 as 'not acceptable' and skips the entry", () => {
    expect(negotiate("en;q=0,ar;q=0.5", SUPPORTED)).toBe("ar");
    // If every entry is q=0, no match.
    expect(negotiate("en;q=0,ar;q=0", SUPPORTED)).toBeNull();
  });

  it("rejects malformed q-values (NaN / out-of-range) as q=0", () => {
    // q=2 is invalid (must be 0..1) → entry skipped; `ar` wins.
    expect(negotiate("en;q=2,ar;q=0.4", SUPPORTED)).toBe("ar");
    // q=banana → NaN → q=0; ar wins.
    expect(negotiate("en;q=banana,ar;q=0.4", SUPPORTED)).toBe("ar");
  });

  it("returns null when no supported locale appears in the header", () => {
    expect(negotiate("fr,de,es", SUPPORTED)).toBeNull();
  });

  it("handles wildcard `*` against the supported set", () => {
    // Wildcard matches anything; default preference is the first entry
    // of `supported`, which is `en`.
    expect(negotiate("*", SUPPORTED)).toBe("en");
    // A specific match beats wildcard if its q is higher.
    expect(negotiate("*;q=0.1,ar;q=0.9", SUPPORTED)).toBe("ar");
  });

  it("tolerates whitespace and case", () => {
    expect(negotiate("AR-SA, EN;q=0.5", SUPPORTED)).toBe("ar");
    expect(negotiate("  fr  ,  ar  ", SUPPORTED)).toBe("ar");
  });
});
