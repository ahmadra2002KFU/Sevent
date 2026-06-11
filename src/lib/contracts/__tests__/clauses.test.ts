import { describe, it, expect } from "vitest";
import { ARTICLES, PLACEHOLDER_NOTICE_AR, PLACEHOLDER_NOTICE_EN } from "../clauses";

describe("contract clauses", () => {
  it("has exactly seven articles numbered 1..7", () => {
    expect(ARTICLES.map((a) => a.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("every article carries non-empty bilingual title + body", () => {
    for (const a of ARTICLES) {
      expect(a.title_en.trim().length).toBeGreaterThan(0);
      expect(a.title_ar.trim().length).toBeGreaterThan(0);
      expect(a.body_en.trim().length).toBeGreaterThan(0);
      expect(a.body_ar.trim().length).toBeGreaterThan(0);
    }
  });

  it("flags articles 1-3 as data-driven and 4-7 as placeholders", () => {
    for (const a of ARTICLES) {
      expect(a.isPlaceholder).toBe(a.id >= 4);
    }
  });

  it("dispute-resolution article (6) references an arbitration body + Saudi law/Sharia, no named individuals", () => {
    const art6 = ARTICLES.find((a) => a.id === 6)!;
    expect(art6.body_en).toMatch(/Saudi Center for Commercial Arbitration/i);
    expect(art6.body_en).toMatch(/SCCA/);
    expect(art6.body_en).toMatch(/Sharia/i);
    expect(art6.body_en).toMatch(/Kingdom of Saudi Arabia/i);
    expect(art6.body_ar).toContain("المركز السعودي للتحكيم التجاري");
    expect(art6.body_ar).toContain("الشريعة");

    // Guard against re-introducing the named arbitrators from the source PO.
    const combined = `${art6.body_en} ${art6.body_ar}`;
    for (const name of ["Al-Nesyan", "Al-Ghanam", "Abdullah", "Khalaf", "النسيان", "الغانم"]) {
      expect(combined).not.toContain(name);
    }
  });

  it("exposes bilingual placeholder notices", () => {
    expect(PLACEHOLDER_NOTICE_EN.trim().length).toBeGreaterThan(0);
    expect(PLACEHOLDER_NOTICE_AR.trim().length).toBeGreaterThan(0);
  });
});
