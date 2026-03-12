import { describe, it, expect, beforeEach } from "vitest";
import {
  getAllDocuments,
  getDocumentById,
  addDocument,
  addDocuments,
  updateDocument,
  deleteDocument,
  searchDocuments,
  searchDocumentsPaginated,
  getDocumentYears,
  getAllTags,
  getUsedCategories,
  getStatusCounts,
  getDocumentsByStatus,
  resetStore,
} from "@/services/documentStore";
import type { ArchiveDocument } from "@/types/document";

/** Helper to create a minimal ArchiveDocument for testing */
function makeDoc(overrides: Partial<ArchiveDocument> = {}): ArchiveDocument {
  return {
    id: overrides.id || `test-${Date.now()}-${Math.random()}`,
    title: "Test Document",
    description: "A test document for unit testing",
    author: "Test Author",
    year: 2024,
    category: "Research",
    type: "Report",
    tags: ["test", "unit"],
    keywords: ["testing"],
    fileUrl: "#",
    processingStatus: "processed",
    ocrStatus: "not_needed",
    extractedText: "This is test extracted text.",
    extractedMetadata: { wordCount: 6 },
    intakeSource: "file_upload",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    importedAt: "2024-01-01T00:00:00.000Z",
    processingHistory: [],
    needsReview: false,
    aiSummary: "Test summary.",
    ...overrides,
  };
}

describe("documentStore", () => {
  beforeEach(() => {
    resetStore();
  });

  describe("getAllDocuments", () => {
    it("returns seeded documents on first load", () => {
      const docs = getAllDocuments();
      // Should be seeded with 10 legacy mock documents
      expect(docs.length).toBe(10);
      expect(docs[0].title).toBe("Founding Charter & Mission Statement");
    });

    it("returns ArchiveDocument format with all required fields", () => {
      const docs = getAllDocuments();
      const doc = docs[0];
      expect(doc).toHaveProperty("processingStatus");
      expect(doc).toHaveProperty("ocrStatus");
      expect(doc).toHaveProperty("extractedText");
      expect(doc).toHaveProperty("extractedMetadata");
      expect(doc).toHaveProperty("intakeSource");
      expect(doc).toHaveProperty("processingHistory");
      expect(doc).toHaveProperty("tags");
      expect(doc.intakeSource).toBe("legacy_import");
      expect(doc.processingStatus).toBe("processed");
    });
  });

  describe("getDocumentById", () => {
    it("returns a document when found", () => {
      const doc = getDocumentById("1");
      expect(doc).toBeDefined();
      expect(doc!.id).toBe("1");
    });

    it("returns undefined when not found", () => {
      const doc = getDocumentById("nonexistent");
      expect(doc).toBeUndefined();
    });
  });

  describe("addDocument", () => {
    it("adds a new document to the store", () => {
      const newDoc = makeDoc({ id: "new-1" });
      addDocument(newDoc);
      const found = getDocumentById("new-1");
      expect(found).toBeDefined();
      expect(found!.title).toBe("Test Document");
      expect(getAllDocuments().length).toBe(11);
    });
  });

  describe("addDocuments (batch)", () => {
    it("adds multiple documents at once", () => {
      const docs = [
        makeDoc({ id: "batch-1", title: "Batch 1" }),
        makeDoc({ id: "batch-2", title: "Batch 2" }),
        makeDoc({ id: "batch-3", title: "Batch 3" }),
      ];
      addDocuments(docs);
      expect(getAllDocuments().length).toBe(13);
      expect(getDocumentById("batch-2")!.title).toBe("Batch 2");
    });
  });

  describe("updateDocument", () => {
    it("updates fields on an existing document", () => {
      const updated = updateDocument("1", { title: "Updated Title", needsReview: true });
      expect(updated).toBeDefined();
      expect(updated!.title).toBe("Updated Title");
      expect(updated!.needsReview).toBe(true);
      expect(updated!.updatedAt).not.toBe(updated!.createdAt);
    });

    it("returns undefined for a non-existent document", () => {
      const result = updateDocument("nonexistent", { title: "X" });
      expect(result).toBeUndefined();
    });
  });

  describe("deleteDocument", () => {
    it("removes a document from the store", () => {
      expect(deleteDocument("1")).toBe(true);
      expect(getDocumentById("1")).toBeUndefined();
      expect(getAllDocuments().length).toBe(9);
    });

    it("returns false for non-existent document", () => {
      expect(deleteDocument("nonexistent")).toBe(false);
    });
  });

  describe("searchDocuments", () => {
    it("returns all documents with no filters", () => {
      const results = searchDocuments({});
      expect(results.length).toBe(10);
    });

    it("filters by search query in title", () => {
      const results = searchDocuments({ search: "Founding Charter" });
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("1");
    });

    it("filters by search query in keywords", () => {
      const results = searchDocuments({ search: "predatory lending" });
      expect(results.length).toBeGreaterThan(0);
    });

    it("filters by year", () => {
      const results = searchDocuments({ year: "1992" });
      expect(results.length).toBe(1);
      expect(results[0].year).toBe(1992);
    });

    it("filters by category", () => {
      const results = searchDocuments({ category: "Research" });
      expect(results.length).toBeGreaterThan(0);
      results.forEach((doc) => expect(doc.category).toBe("Research"));
    });

    it("filters by type", () => {
      const results = searchDocuments({ type: "Study" });
      expect(results.length).toBeGreaterThan(0);
      results.forEach((doc) => expect(doc.type).toBe("Study"));
    });

    it("filters by intake source", () => {
      const results = searchDocuments({ intakeSource: "legacy_import" });
      expect(results.length).toBe(10);
    });

    it("filters by processing status", () => {
      const results = searchDocuments({ processingStatus: "processed" });
      expect(results.length).toBe(10);
    });

    it("combines multiple filters", () => {
      const results = searchDocuments({
        category: "Research",
        type: "Study",
      });
      expect(results.length).toBeGreaterThan(0);
      results.forEach((doc) => {
        expect(doc.category).toBe("Research");
        expect(doc.type).toBe("Study");
      });
    });

    it("returns empty for no matches", () => {
      const results = searchDocuments({ search: "zzzzzzzzzznotfound" });
      expect(results.length).toBe(0);
    });
  });

  describe("searchDocumentsPaginated", () => {
    it("returns paginated results", () => {
      const result = searchDocumentsPaginated({}, 1, 3);
      expect(result.items.length).toBe(3);
      expect(result.total).toBe(10);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(3);
      expect(result.totalPages).toBe(4);
    });

    it("returns correct page", () => {
      const page2 = searchDocumentsPaginated({}, 2, 3);
      expect(page2.items.length).toBe(3);
      expect(page2.page).toBe(2);
    });
  });

  describe("getDocumentYears", () => {
    it("returns sorted unique years", () => {
      const years = getDocumentYears();
      expect(years.length).toBeGreaterThan(0);
      // Should be sorted descending
      for (let i = 1; i < years.length; i++) {
        expect(years[i - 1]).toBeGreaterThan(years[i]);
      }
    });
  });

  describe("getAllTags", () => {
    it("returns tags from all documents", () => {
      const tags = getAllTags();
      expect(tags.length).toBeGreaterThan(0);
    });
  });

  describe("getUsedCategories", () => {
    it("returns categories in use", () => {
      const cats = getUsedCategories();
      expect(cats.length).toBeGreaterThan(0);
      expect(cats).toContain("Research");
    });
  });

  describe("getStatusCounts", () => {
    it("returns counts by processing status", () => {
      const counts = getStatusCounts();
      expect(counts["processed"]).toBe(10);
    });
  });

  describe("getDocumentsByStatus", () => {
    it("filters by status", () => {
      const docs = getDocumentsByStatus("processed");
      expect(docs.length).toBe(10);
    });
  });
});
