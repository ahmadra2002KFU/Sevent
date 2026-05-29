import { describe, expect, it } from "vitest";
import { kindFromParentSlug } from "../kindFromParentSlug";
import { TAXONOMY } from "@/lib/domain/taxonomy";

describe("kindFromParentSlug", () => {
  it("maps hospitality to the catering requirements form", () => {
    expect(kindFromParentSlug("hospitality")).toBe("catering");
  });

  it("maps media_production to the photography requirements form", () => {
    expect(kindFromParentSlug("media_production")).toBe("photography");
  });

  it("falls back to generic for unknown slugs", () => {
    expect(kindFromParentSlug(undefined)).toBe("generic");
    expect(kindFromParentSlug("")).toBe("generic");
    expect(kindFromParentSlug("does_not_exist")).toBe("generic");
  });

  it("falls back to generic for every other seeded parent slug", () => {
    const SPECIALIZED = new Set(["hospitality", "media_production"]);
    for (const parent of TAXONOMY) {
      if (SPECIALIZED.has(parent.slug)) continue;
      expect(
        kindFromParentSlug(parent.slug),
        `seeded parent slug "${parent.slug}" should default to generic`,
      ).toBe("generic");
    }
  });

  it("every specialized seeded parent slug has a non-generic mapping", () => {
    const seededSlugs = new Set(TAXONOMY.map((p) => p.slug));
    expect(seededSlugs.has("hospitality")).toBe(true);
    expect(seededSlugs.has("media_production")).toBe(true);
  });
});
