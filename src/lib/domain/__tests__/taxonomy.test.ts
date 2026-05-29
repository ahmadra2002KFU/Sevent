import { describe, expect, it } from "vitest";
import {
  LEGACY_CHILD_CATEGORY_MAPPING,
  LEGACY_PARENT_CATEGORY_MAPPING,
  TAXONOMY,
  TAXONOMY_CHILD_SLUGS,
  TAXONOMY_PARENT_SLUGS,
  TAXONOMY_VERSION,
  findTaxonomyItem,
  taxonomyNameFor,
} from "../taxonomy";

describe("boss CSV taxonomy", () => {
  it("contains the locked active taxonomy shape", () => {
    expect(TAXONOMY_VERSION).toBe("boss_csv_2026_05");
    expect(TAXONOMY).toHaveLength(12);
    expect(TAXONOMY_CHILD_SLUGS).toHaveLength(75);
  });

  it("has unique parent and child slugs", () => {
    expect(new Set(TAXONOMY_PARENT_SLUGS).size).toBe(TAXONOMY_PARENT_SLUGS.length);
    expect(new Set(TAXONOMY_CHILD_SLUGS).size).toBe(TAXONOMY_CHILD_SLUGS.length);
  });

  it("maps every legacy slug to an active boss taxonomy slug", () => {
    for (const [legacySlug, activeSlug] of Object.entries(
      LEGACY_CHILD_CATEGORY_MAPPING,
    )) {
      expect(findTaxonomyItem(activeSlug), legacySlug).not.toBeNull();
    }
    for (const [legacySlug, activeSlug] of Object.entries(
      LEGACY_PARENT_CATEGORY_MAPPING,
    )) {
      expect(findTaxonomyItem(activeSlug), legacySlug).not.toBeNull();
    }
  });

  it("keeps legacy display fallback names on the new target", () => {
    expect(taxonomyNameFor("catering-plated", "en")).toBe("Food & Beverages");
    expect(taxonomyNameFor("venue-ballroom", "en")).toBe(
      "Project Setup Requirements",
    );
    expect(taxonomyNameFor("photo_video", "en")).toBe("Media Production");
  });
});
