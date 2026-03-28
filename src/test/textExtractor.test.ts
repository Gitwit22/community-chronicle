import { describe, it, expect, beforeEach } from "vitest";
import { normalizeExtractedText, extractContentFromFile, extractTextFromFile } from "@/services/textExtractor";
import { resetStore } from "@/services/documentStore";

describe("textExtractor", () => {
  beforeEach(() => {
    resetStore();
  });

  describe("normalizeExtractedText", () => {
    it("replaces \\r\\n with \\n", () => {
      expect(normalizeExtractedText("hello\r\nworld")).toBe("hello\nworld");
    });

    it("replaces tabs with spaces", () => {
      expect(normalizeExtractedText("hello\tworld")).toBe("hello world");
    });

    it("collapses multiple spaces", () => {
      expect(normalizeExtractedText("hello    world")).toBe("hello world");
    });

    it("collapses excessive newlines", () => {
      expect(normalizeExtractedText("hello\n\n\n\nworld")).toBe("hello\n\nworld");
    });

    it("trims leading/trailing whitespace", () => {
      expect(normalizeExtractedText("  hello  ")).toBe("hello");
    });

    it("handles combined normalization", () => {
      const input = "  hello\r\n\r\n\r\nworld   foo  ";
      const result = normalizeExtractedText(input);
      expect(result).toBe("hello\n\nworld foo");
    });
  });

  describe("extractContentFromFile", () => {
    it("selects correct adapter for plain text files", async () => {
      const file = new File(["Hello, World!"], "test.txt", { type: "text/plain" });
      const { plainTextExtractor } = await import("@/services/extractorAdapters/plainTextExtractor");
      expect(plainTextExtractor.canHandle(file)).toBe(true);
    });

    it("selects correct adapter for CSV files", async () => {
      const file = new File(["a,b,c"], "data.csv", { type: "text/csv" });
      const { plainTextExtractor } = await import("@/services/extractorAdapters/plainTextExtractor");
      expect(plainTextExtractor.canHandle(file)).toBe(true);
    });

    it("attempts extraction for PDF files and returns structured output", async () => {
      const file = new File(["fake pdf"], "document.pdf", { type: "application/pdf" });
      const result = await extractContentFromFile(file);
      expect(typeof result.text).toBe("string");
      expect(result.confidence).toBeDefined();
      // For invalid fixture bytes, parser should fail gracefully with warnings.
      expect(result.warnings?.length ?? 0).toBeGreaterThan(0);
    });

    it("attempts OCR for image files and fails gracefully on invalid bytes", async () => {
      const file = new File(["fake image"], "photo.png", { type: "image/png" });
      const result = await extractContentFromFile(file);
      expect(typeof result.text).toBe("string");
      expect(result.confidence).toBeDefined();
      expect(result.warnings?.length ?? 0).toBeGreaterThan(0);
    });

    it("uses fallback for unknown file types", async () => {
      const file = new File(["some content"], "unknown.xyz", { type: "application/octet-stream" });
      const result = await extractContentFromFile(file);
      expect(result.confidence).toBeDefined();
      expect(result.warnings).toBeDefined();
    });

    it("selects correct adapter for image files", async () => {
      const file = new File(["fake"], "photo.jpg", { type: "image/jpeg" });
      const { imageOcrExtractor } = await import("@/services/extractorAdapters/imageOcrExtractor");
      expect(imageOcrExtractor.canHandle(file)).toBe(true);
    });

    it("selects correct adapter for PDF files", async () => {
      const file = new File(["fake"], "doc.pdf", { type: "application/pdf" });
      const { pdfExtractor } = await import("@/services/extractorAdapters/pdfExtractor");
      expect(pdfExtractor.canHandle(file)).toBe(true);
    });

    it("selects correct adapter for DOCX files", async () => {
      const file = new File(["fake"], "notes.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const { officeExtractor } = await import("@/services/extractorAdapters/officeExtractor");
      expect(officeExtractor.canHandle(file)).toBe(true);
    });

    it("extracts text from XLSX spreadsheets", async () => {
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.aoa_to_sheet([
        ["Name", "Value"],
        ["Budget", "5000"],
      ]);
      XLSX.utils.book_append_sheet(workbook, sheet, "Summary");
      const rawBytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const bytes = rawBytes instanceof ArrayBuffer
        ? new Uint8Array(rawBytes)
        : new Uint8Array(rawBytes as ArrayLike<number>);

      // Use a minimal File-like object to ensure deterministic binary read behavior in tests.
      const file = {
        name: "budget.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      } as unknown as File;

      const result = await extractContentFromFile(file);
      expect(result.text).toContain("Summary");
      expect(result.text).toContain("Budget");
      expect((result.confidence ?? 0)).toBeGreaterThan(0.8);
    });
  });

  describe("extractTextFromFile (legacy)", () => {
    it("returns a string from a PDF file", async () => {
      const file = new File(["fake pdf"], "test.pdf", { type: "application/pdf" });
      const result = await extractTextFromFile(file);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
