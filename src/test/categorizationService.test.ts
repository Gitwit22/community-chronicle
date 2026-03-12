import { describe, it, expect } from "vitest";
import { categorizeDocument, manualCategorize } from "@/services/categorizationService";
import type { ArchiveDocument } from "@/types/document";

/** Helper to create a minimal document for categorization testing */
function makeDoc(overrides: Partial<ArchiveDocument> = {}): ArchiveDocument {
  return {
    id: "cat-test",
    title: "",
    description: "",
    author: "Test",
    year: 2024,
    category: "Uncategorized",
    type: "Report",
    tags: [],
    keywords: [],
    fileUrl: "#",
    processingStatus: "processing",
    ocrStatus: "not_needed",
    extractedText: "",
    extractedMetadata: {},
    intakeSource: "file_upload",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    importedAt: new Date().toISOString(),
    processingHistory: [],
    needsReview: false,
    aiSummary: "",
    ...overrides,
  };
}

describe("categorizationService", () => {
  describe("categorizeDocument", () => {
    it("categorizes housing-related documents", () => {
      const doc = makeDoc({
        title: "Housing Segregation Patterns",
        keywords: ["housing", "segregation"],
      });
      const result = categorizeDocument(doc, "housing segregation residential patterns redlining");
      expect(result.category).toBe("Housing");
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.method).toBe("rule_based");
    });

    it("categorizes education documents", () => {
      const doc = makeDoc({ title: "School Funding Analysis" });
      const result = categorizeDocument(doc, "education school k-12 funding student curriculum");
      expect(result.category).toBe("Education");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("categorizes legal documents", () => {
      const doc = makeDoc({ title: "Legal Brief on Lending" });
      const result = categorizeDocument(doc, "legal court lawsuit predatory lending compliance");
      expect(result.category).toBe("Legal Documents");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("categorizes meeting minutes", () => {
      const doc = makeDoc({ title: "Board Meeting Minutes" });
      const result = categorizeDocument(doc, "meeting minutes agenda attendees motion quorum adjourned");
      expect(result.category).toBe("Meeting Minutes");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("returns Uncategorized when no keywords match", () => {
      const doc = makeDoc({ title: "XYZ" });
      const result = categorizeDocument(doc, "xyzabc123");
      expect(result.category).toBe("Uncategorized");
      expect(result.confidence).toBe(0);
    });

    it("generates suggested tags", () => {
      const doc = makeDoc({
        title: "Detroit Housing Report",
        keywords: ["Detroit", "housing"],
      });
      const result = categorizeDocument(doc, "Detroit housing racial equity community");
      expect(result.suggestedTags.length).toBeGreaterThan(0);
      expect(result.suggestedTags).toContain("Detroit");
      expect(result.suggestedTags).toContain("housing");
    });
  });

  describe("manualCategorize", () => {
    it("returns manual classification with full confidence", () => {
      const result = manualCategorize("Legal Documents", ["contract", "legal"]);
      expect(result.category).toBe("Legal Documents");
      expect(result.confidence).toBe(1.0);
      expect(result.method).toBe("manual");
      expect(result.suggestedTags).toEqual(["contract", "legal"]);
    });
  });
});
