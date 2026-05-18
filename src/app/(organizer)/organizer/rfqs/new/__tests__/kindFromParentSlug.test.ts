import { describe, expect, it } from "vitest";
import { kindFromParentSlug } from "../kindFromParentSlug";
import { TAXONOMY } from "@/lib/domain/taxonomy";

describe("kindFromParentSlug", () => {
  it("maps tents_structures → venues", () => {
    expect(kindFromParentSlug("tents_structures")).toBe("venues");
  });

  it("maps catering_hospitality → catering", () => {
    expect(kindFromParentSlug("catering_hospitality")).toBe("catering");
  });

  it("maps photo_video → photography", () => {
    expect(kindFromParentSlug("photo_video")).toBe("photography");
  });

  it("falls back to generic for unknown slugs", () => {
    expect(kindFromParentSlug(undefined)).toBe("generic");
    expect(kindFromParentSlug("")).toBe("generic");
    expect(kindFromParentSlug("does_not_exist")).toBe("generic");
  });

  it("falls back to generic for every other seeded parent slug", () => {
    // Defense: every parent slug NOT in the explicit map should return
    // `generic`. Pre-Stage-4 this whole switch checked `venues`/`catering`/
    // `photography` — slugs that don't exist in the seeded taxonomy — so
    // every seeded parent (including `tents_structures` and friends)
    // collapsed to `generic`. This test guarantees the regression cannot
    // come back: any future taxonomy edit that introduces a NEW
    // specialized form must update both `kindFromParentSlug` AND this
    // case list.
    const SPECIALIZED = new Set([
      "tents_structures",
      "catering_hospitality",
      "photo_video",
    ]);
    for (const parent of TAXONOMY) {
      if (SPECIALIZED.has(parent.slug)) continue;
      expect(
        kindFromParentSlug(parent.slug),
        `seeded parent slug "${parent.slug}" should default to generic`,
      ).toBe("generic");
    }
  });

  it("every specialized seeded parent slug has a non-generic mapping", () => {
    // Sanity check: the three specialized slugs we claim exist in the
    // taxonomy actually do exist. Catches a future rename in
    // `taxonomy.ts` that would silently break the wizard.
    const seededSlugs = new Set(TAXONOMY.map((p) => p.slug));
    expect(seededSlugs.has("tents_structures")).toBe(true);
    expect(seededSlugs.has("catering_hospitality")).toBe(true);
    expect(seededSlugs.has("photo_video")).toBe(true);
  });
});
