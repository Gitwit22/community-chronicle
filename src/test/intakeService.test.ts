import { describe, it, expect, beforeEach } from "vitest";
import { createDocumentRecord, intakeManualEntry } from "@/services/intakeService";
import { resetStore, getDocumentById } from "@/services/documentStore";

describe("intakeService", () => {
  beforeEach(() => {
    resetStore();
  });

  describe("createDocumentRecord", () => {
    it("creates a normalized record with required fields", () => {
      const doc = createDocumentRecord({
        intakeSource: "file_upload",
        title: "Test Upload",
        description: "A test file",
      });

      expect(doc.id).toBeTruthy();
      expect(doc.title).toBe("Test Upload");
      expect(doc.intakeSource).toBe("file_upload");
      expect(doc.processingStatus).toBe("uploaded");
      expect(doc.createdAt).toBeTruthy();
      expect(doc.updatedAt).toBeTruthy();
      expect(doc.importedAt).toBeTruthy();
      expect(doc.processingHistory.length).toBe(1);
      expect(doc.processingHistory[0].action).toBe("intake");
    });

    it("generates a title from filename when no title provided", () => {
      const mockFile = new File(["content"], "my-test-document.pdf", {
        type: "application/pdf",
      });
      const doc = createDocumentRecord({
        intakeSource: "file_upload",
        file: mockFile,
      });

      expect(doc.title).toBe("My Test Document");
      expect(doc.originalFileName).toBe("my-test-document.pdf");
      expect(doc.mimeType).toBe("application/pdf");
    });

    it("defaults to Untitled Document when no title and no file", () => {
      const doc = createDocumentRecord({
        intakeSource: "manual_entry",
      });
      expect(doc.title).toBe("Untitled Document");
    });

    it("marks image files for OCR", () => {
      const mockImage = new File(["data"], "scan.png", { type: "image/png" });
      const doc = createDocumentRecord({
        intakeSource: "scanner_import",
        file: mockImage,
      });
      expect(doc.ocrStatus).toBe("pending");
      expect(doc.needsReview).toBe(true);
    });

    it("marks PDF files for OCR", () => {
      const mockPdf = new File(["data"], "scanned.pdf", { type: "application/pdf" });
      const doc = createDocumentRecord({
        intakeSource: "file_upload",
        file: mockPdf,
      });
      expect(doc.ocrStatus).toBe("pending");
    });

    it("marks text files as not needing OCR", () => {
      const mockTxt = new File(["text"], "notes.txt", { type: "text/plain" });
      const doc = createDocumentRecord({
        intakeSource: "file_upload",
        file: mockTxt,
      });
      expect(doc.ocrStatus).toBe("not_needed");
    });

    it("assigns correct intake source", () => {
      const sources = [
        "file_upload",
        "multi_upload",
        "drag_drop",
        "bulk_folder",
        "scanner_import",
        "manual_entry",
      ] as const;

      for (const source of sources) {
        const doc = createDocumentRecord({ intakeSource: source });
        expect(doc.intakeSource).toBe(source);
      }
    });

    it("preserves user-provided metadata", () => {
      const doc = createDocumentRecord({
        intakeSource: "manual_entry",
        title: "Custom Title",
        author: "Custom Author",
        year: 1990,
        category: "Legal Documents",
        type: "Brief",
        tags: ["legal", "custom"],
        department: "Legal Division",
      });
      expect(doc.title).toBe("Custom Title");
      expect(doc.author).toBe("Custom Author");
      expect(doc.year).toBe(1990);
      expect(doc.category).toBe("Legal Documents");
      expect(doc.type).toBe("Brief");
      expect(doc.tags).toEqual(["legal", "custom"]);
      expect(doc.department).toBe("Legal Division");
    });
  });

  describe("intakeManualEntry", () => {
    it("creates a document and adds it to the store", () => {
      const doc = intakeManualEntry({
        title: "Manual Record",
        description: "Created manually",
        author: "Staff Member",
      });

      expect(doc.intakeSource).toBe("manual_entry");
      expect(doc.processingStatus).toBe("needs_review");

      // Verify it was added to the store
      const found = getDocumentById(doc.id);
      expect(found).toBeDefined();
      expect(found!.title).toBe("Manual Record");
    });

    it("marks as processed when extractedText is provided", () => {
      const doc = intakeManualEntry({
        title: "Manual With Text",
        extractedText: "Some content that was pasted in.",
      });
      expect(doc.processingStatus).toBe("processed");
    });
  });
});
