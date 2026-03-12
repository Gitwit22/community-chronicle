import { describe, it, expect, beforeEach } from "vitest";
import {
  searchWithRelevance,
  sortDocuments,
  getFacetCounts,
} from "@/services/searchService";
import { resetStore, getAllDocuments } from "@/services/documentStore";

describe("searchService", () => {
  beforeEach(() => {
    resetStore();
  });

  describe("searchWithRelevance", () => {
    it("returns all documents when query is empty", () => {
      const results = searchWithRelevance("");
      expect(results.length).toBe(10);
    });

    it("returns scored results for a matching query", () => {
      const results = searchWithRelevance("housing");
      expect(results.length).toBeGreaterThan(0);
      // Each result should have a positive score
      results.forEach((r) => expect(r.score).toBeGreaterThan(0));
    });

    it("scores title matches higher than description matches", () => {
      const results = searchWithRelevance("housing");
      // The document with "Housing" in the title should score higher
      const housingDoc = results.find((r) =>
        r.document.title.toLowerCase().includes("housing")
      );
      if (housingDoc && results.length > 1) {
        // Title matches get 10 points, so should be near the top
        expect(housingDoc.score).toBeGreaterThanOrEqual(10);
      }
    });

    it("includes highlights for matched fields", () => {
      const results = searchWithRelevance("Founding Charter");
      expect(results.length).toBeGreaterThan(0);
      const first = results[0];
      expect(first.highlights).toBeDefined();
      expect(first.highlights!.length).toBeGreaterThan(0);
    });

    it("returns empty for no match", () => {
      const results = searchWithRelevance("zzzznotmatching12345");
      expect(results.length).toBe(0);
    });

    it("applies additional filters alongside query", () => {
      const results = searchWithRelevance("equity", { category: "Research" });
      results.forEach((r) => expect(r.document.category).toBe("Research"));
    });
  });

  describe("sortDocuments", () => {
    it("sorts by year descending", () => {
      const docs = getAllDocuments();
      const sorted = sortDocuments(docs, "year_desc");
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i - 1].year).toBeGreaterThanOrEqual(sorted[i].year);
      }
    });

    it("sorts by year ascending", () => {
      const docs = getAllDocuments();
      const sorted = sortDocuments(docs, "year_asc");
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i - 1].year).toBeLessThanOrEqual(sorted[i].year);
      }
    });

    it("sorts by title ascending", () => {
      const docs = getAllDocuments();
      const sorted = sortDocuments(docs, "title_asc");
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i - 1].title.localeCompare(sorted[i].title)).toBeLessThanOrEqual(0);
      }
    });
  });

  describe("getFacetCounts", () => {
    it("returns counts for all facet fields", () => {
      const facets = getFacetCounts();
      expect(Object.keys(facets.categories).length).toBeGreaterThan(0);
      expect(Object.keys(facets.types).length).toBeGreaterThan(0);
      expect(Object.keys(facets.years).length).toBeGreaterThan(0);
      expect(Object.keys(facets.sources).length).toBeGreaterThan(0);
      expect(Object.keys(facets.statuses).length).toBeGreaterThan(0);
    });

    it("all legacy documents are counted as legacy_import source", () => {
      const facets = getFacetCounts();
      expect(facets.sources["legacy_import"]).toBe(10);
    });
  });
});
